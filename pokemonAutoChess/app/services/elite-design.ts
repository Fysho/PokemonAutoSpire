import {
  EliteDesign,
  IEliteDesign,
  IEliteDesignResult
} from "../models/mongo-models/elite-design"
import UserMetadata from "../models/mongo-models/user-metadata"
import type { SpireEncounter } from "../models/spire-encounters"
import { Role } from "../types"
import { Item } from "../types/enum/Item"
import { Pkm } from "../types/enum/Pokemon"
import { logger } from "../utils/logger"
import { parseEliteDesignExport } from "./elite-test"

// ⚠️ ACCEPTED RISK (2026-07): like the rest of the REST API, these mutating
// helpers trust the client-supplied `uid` — no Firebase token verification —
// and GET /api/elite-designs publishes each design's creatorUid, so a crafted
// request can impersonate any creator to edit/bump/delete their designs.
// Reviewed and accepted for the current trusted player base; worst case an
// admin restores from Mongo. Revisit if the API ever moves to token auth.

const MAX_DESIGNS_PER_CREATOR = 50

// Guests all share the "local-player" uid, which would make every guest a
// co-owner of one shared library bucket — so the library is sign-in only.
// The client blocks the whole Elite Designer for guests (elite-designer-modal);
// this is the server-side backstop.
function isGuestUid(uid: string): boolean {
  return !uid || uid === "local-player"
}

// ---------------------------------------------------------------------------
// Save-time content validation. The designer UI can only produce valid data,
// but import strings are a first-class feature (Discord paste), so crafted or
// corrupted JSON must be rejected here — admin approval is the only gate after
// this before a design reaches live Spire runs.
// ---------------------------------------------------------------------------

const VALID_PKM = new Set<string>(Object.values(Pkm))
const VALID_ITEMS = new Set<string>(Object.values(Item))
// Must match resolveDesignRewardItem in game-commands.ts / RANDOM_ITEM_TOKENS
// in elite-designer.tsx.
const RANDOM_ITEM_TOKENS = new Set([
  "RANDOM_COMPONENT",
  "RANDOM_CRAFTED",
  "RANDOM_BERRY",
  "RANDOM_TOOL",
  "RANDOM_SYNERGY_STONE",
  "RANDOM_SHINY"
])
const MAX_BOARD_UNITS = 24 // 8 columns × 3 rows (y 1-3)
const MAX_ITEMS_PER_UNIT = 3
const MAX_REWARD_POOL = 30
// Generous per-field bonus-stat bounds (Arceus-scale mains stay possible for
// admin-approved content, but crafted absurdities are rejected).
const BONUS_LIMITS: Record<string, [number, number]> = {
  bonusHP: [-500, 20000],
  bonusAtk: [-50, 500],
  bonusDef: [-50, 500],
  bonusSpeDef: [-50, 500],
  bonusAP: [-100, 2000],
  bonusPP: [-100, 255],
  mainBonusHP: [-500, 20000],
  mainBonusAtk: [-50, 500],
  mainBonusAP: [-100, 2000]
}

// Returns an error code, or null when the design content is valid.
// (Exported for tests only — saveEliteDesign is the real entry point.)
export function validateEliteDesignContent(raw: any): string | null {
  if (!Array.isArray(raw.board) || raw.board.length === 0) return "empty_design"
  if (raw.board.length > MAX_BOARD_UNITS) return "board_too_large"
  const cells = new Set<string>()
  for (const entry of raw.board) {
    if (!Array.isArray(entry)) return "malformed"
    const [name, x, y] = entry
    if (!VALID_PKM.has(String(name))) return "invalid_pokemon"
    if (!Number.isInteger(x) || x < 0 || x > 7) return "bad_position"
    if (!Number.isInteger(y) || y < 1 || y > 3) return "bad_position"
    const cell = `${x},${y}`
    if (cells.has(cell)) return "bad_position" // two units on one cell
    cells.add(cell)
  }
  if (raw.items !== undefined) {
    if (!Array.isArray(raw.items)) return "malformed"
    for (const unitItems of raw.items) {
      if (!Array.isArray(unitItems)) return "malformed"
      if (unitItems.length > MAX_ITEMS_PER_UNIT) return "bad_items"
      for (const item of unitItems) {
        if (!VALID_ITEMS.has(String(item))) return "bad_items"
      }
    }
  }
  if (raw.bonus !== undefined) {
    if (typeof raw.bonus !== "object" || raw.bonus === null) return "malformed"
    for (const [key, value] of Object.entries(raw.bonus)) {
      const limits = BONUS_LIMITS[key]
      if (!limits) return "bad_stats" // unknown bonus field
      const n = Number(value)
      if (!Number.isFinite(n) || n < limits[0] || n > limits[1]) {
        return "bad_stats"
      }
    }
  }
  for (const poolKey of ["winRewards", "lossRewards"] as const) {
    const pool = raw[poolKey]
    if (pool === undefined) continue
    if (!Array.isArray(pool) || pool.length > MAX_REWARD_POOL) {
      return "bad_rewards"
    }
    for (const option of pool) {
      if (!Array.isArray(option)) return "bad_rewards"
      const [pokemon, item] = option
      if (!VALID_PKM.has(String(pokemon))) return "bad_rewards"
      if (
        item !== undefined &&
        !VALID_ITEMS.has(String(item)) &&
        !RANDOM_ITEM_TOKENS.has(String(item))
      ) {
        return "bad_rewards"
      }
    }
  }
  for (const shownKey of ["winRewardsShown", "lossRewardsShown"] as const) {
    const shown = raw[shownKey]
    if (shown === undefined) continue
    if (!Number.isInteger(shown) || shown < 1 || shown > MAX_REWARD_POOL) {
      return "bad_rewards"
    }
  }
  if (raw.icon !== undefined && !VALID_PKM.has(String(raw.icon))) {
    return "invalid_pokemon"
  }
  return null
}

// Saves (or re-saves — upsert by creatorUid + name) an Elite Designer export to
// the library. Name/act/stage-range/icon are extracted server-side from the
// export string so the stored metadata can't disagree with the design itself.
//
// Two modes:
// - `id` given → UPDATE that entry in place (creator only; renames allowed but
//   must stay unique among the creator's designs). Measurement results are kept
//   when the design content is byte-identical (e.g. a pure rename), cleared
//   when the board/bonus actually changed (stale rates on a changed design lie).
// - no `id` → CREATE a new entry; a name collision with the creator's existing
//   designs is an error (no silent overwrite — the client offers Update for that).
export async function saveEliteDesign(
  uid: string,
  designJson: string,
  id?: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (isGuestUid(uid)) return { ok: false, error: "guest" }
  const parsed = parseEliteDesignExport(designJson)
  if (!parsed || parsed.board.length === 0) {
    return { ok: false, error: "empty_design" }
  }
  let act = 1
  let stageRange = ""
  try {
    const raw = JSON.parse(designJson)
    act = Number(raw.act)
    stageRange = String(raw.stages ?? "")
    const contentError = validateEliteDesignContent(raw)
    if (contentError) return { ok: false, error: contentError }
  } catch {
    return { ok: false, error: "malformed" }
  }
  // Validate against the real stage ladder, not just the range list — act 1 has
  // no "1-5" elite bracket (matches STAGE_RANGES_BY_ACT in the client designer),
  // and a design saved outside the ladder can't be bumped or drawn by Spire.
  if (!STAGE_LADDER.some((s) => s.act === act && s.stageRange === stageRange)) {
    return { ok: false, error: "bad_stage" }
  }
  if (designJson.length > 20000) return { ok: false, error: "too_large" }

  const name = parsed.name.trim().slice(0, 60) || "Custom Elite"
  const icon = parsed.icon ?? parsed.board[0]?.name ?? ""
  try {
    if (id) {
      const existing = await EliteDesign.findById(id)
      if (!existing) return { ok: false, error: "not_found" }
      const designChanged = existing.designJson !== designJson
      // Editing in place: the creator, or an admin (matches bump/delete). The
      // role is also needed when the creator edits an APPROVED design (see the
      // approval-clear below), so look it up in either case.
      let isAdmin = false
      if (existing.creatorUid !== uid || (designChanged && existing.approved)) {
        const user = await UserMetadata.findOne({ uid }, { role: 1 }).lean()
        isAdmin = user?.role === Role.ADMIN
        if (existing.creatorUid !== uid && !isAdmin) {
          return { ok: false, error: "forbidden" }
        }
      }
      // Name uniqueness is scoped to the design's OWNER, not whoever is editing
      // (an admin editing someone else's design must not clash against their own
      // library, nor skip the owner's other designs). creatorUid is unchanged.
      const nameClash = await EliteDesign.findOne({
        creatorUid: existing.creatorUid,
        name,
        _id: { $ne: existing._id }
      }).lean()
      if (nameClash) return { ok: false, error: "name_taken" }
      existing.name = name
      existing.act = act
      existing.stageRange = stageRange
      existing.icon = icon
      existing.designJson = designJson
      if (designChanged) existing.results = []
      // Approval gates live Spire content — a non-admin changing an approved
      // design's content must send it back through admin review, otherwise
      // "get a tame design approved, then edit it" bypasses the gate entirely.
      // Pure renames (byte-identical designJson) and admin edits keep it.
      if (designChanged && existing.approved && !isAdmin) {
        existing.approved = false
      }
      await existing.save()
      return { ok: true, id: existing._id.toString() }
    }

    const nameClash = await EliteDesign.findOne({
      creatorUid: uid,
      name
    }).lean()
    if (nameClash) return { ok: false, error: "name_taken" }
    const count = await EliteDesign.countDocuments({ creatorUid: uid })
    if (count >= MAX_DESIGNS_PER_CREATOR) {
      return { ok: false, error: "library_full" }
    }
    const user = await UserMetadata.findOne(
      { uid },
      { displayName: 1 }
    ).lean()
    const creatorName =
      user?.displayName && !["Player", "Username"].includes(user.displayName)
        ? user.displayName
        : "Player"
    const doc = await EliteDesign.create({
      name,
      act,
      stageRange,
      icon,
      designJson,
      creatorUid: uid,
      creatorName,
      approved: false,
      createdAt: new Date(),
      results: []
    })
    return { ok: true, id: doc._id.toString() }
  } catch (e: any) {
    if (e?.code === 11000) return { ok: false, error: "name_taken" } // unique-index race
    logger.error("Failed to save elite design:", e)
    return { ok: false, error: "db_error" }
  }
}

export async function listEliteDesigns(): Promise<
  (IEliteDesign & { id: string })[]
> {
  try {
    const docs = await EliteDesign.find().lean()
    return docs
      .map((d: any) => ({ ...d, id: d._id.toString(), _id: undefined }))
      .sort(
        (a, b) =>
          a.act - b.act ||
          parseInt(a.stageRange) - parseInt(b.stageRange) ||
          a.name.localeCompare(b.name)
      )
  } catch (e) {
    logger.error("Failed to list elite designs:", e)
    return []
  }
}

// Approve/unapprove a design for live Spire runs — admin only. Only approved
// designs are drawn as Spire elite fights.
export async function setEliteDesignApproved(
  id: string,
  uid: string,
  approved: boolean
): Promise<boolean> {
  try {
    const user = await UserMetadata.findOne({ uid }, { role: 1 }).lean()
    if (user?.role !== Role.ADMIN) return false
    const res = await EliteDesign.updateOne({ _id: id }, { $set: { approved } })
    return res.matchedCount > 0
  } catch (e) {
    logger.error("Failed to set elite design approval:", e)
    return false
  }
}

// All approved designs for one act + stage-range bracket (Spire elite pool).
export async function getApprovedEliteDesigns(
  act: number,
  stageRange: string
): Promise<(IEliteDesign & { id: string })[]> {
  try {
    const docs = await EliteDesign.find({
      act,
      stageRange,
      approved: true
    }).lean()
    return docs.map((d: any) => ({ ...d, id: d._id.toString(), _id: undefined }))
  } catch (e) {
    logger.error("Failed to get approved elite designs:", e)
    return []
  }
}

// ============================================================================
// Design → live Spire encounter conversion
// ============================================================================

export interface SpireEliteRewardOption {
  pokemon: string // Pkm
  item?: string // real Item or a RANDOM_* token (resolved at reward time)
}

export interface SpireEliteDesignData {
  designId: string
  name: string
  icon: string // Pkm shown as the map node avatar
  encounter: SpireEncounter
  winRewards: SpireEliteRewardOption[]
  winRewardsShown: number
  lossRewards: SpireEliteRewardOption[]
  lossRewardsShown: number
}

// Converts a stored design into the SpireEncounter the fight machinery consumes,
// plus its reward pools. The icon Pokémon is moved to board[0] because the live
// elite path applies mainBonus* stats and the dojo-ticket "main" to board[0].
export function designToSpireEliteData(doc: {
  id?: string
  name: string
  designJson: string
}): SpireEliteDesignData | null {
  let raw: any
  try {
    raw = JSON.parse(doc.designJson)
  } catch {
    return null
  }
  if (!Array.isArray(raw.board) || raw.board.length === 0) return null
  const board: [string, number, number][] = raw.board
    .filter((e: any) => Array.isArray(e) && e[0])
    .map((e: any) => [String(e[0]), Number(e[1]), Number(e[2])])
  if (board.length === 0) return null
  const items: string[][] = board.map((_, i) =>
    Array.isArray(raw.items?.[i]) ? raw.items[i] : []
  )
  const icon: string =
    typeof raw.icon === "string" && raw.icon ? raw.icon : board[0][0]
  const mainIdx = board.findIndex(([p]) => p === icon)
  if (mainIdx > 0) {
    const [b] = board.splice(mainIdx, 1)
    board.unshift(b)
    const [it] = items.splice(mainIdx, 1)
    items.unshift(it)
  }
  const bonus = raw.bonus && typeof raw.bonus === "object" ? raw.bonus : {}
  const num = (k: string) => Math.round(Number(bonus[k]) || 0) || undefined
  const encounter: SpireEncounter = {
    name: doc.name || raw.name || "Custom Elite",
    avatar: icon as SpireEncounter["avatar"],
    board: board as SpireEncounter["board"],
    items: items as SpireEncounter["items"],
    bonusHP: num("bonusHP"),
    bonusAtk: num("bonusAtk"),
    bonusDef: num("bonusDef"),
    bonusSpeDef: num("bonusSpeDef"),
    bonusAP: num("bonusAP"),
    bonusPP: num("bonusPP"),
    mainBonusHP: num("mainBonusHP"),
    mainBonusAtk: num("mainBonusAtk"),
    mainBonusAP: num("mainBonusAP")
  }
  const decodeRewards = (rw: unknown): SpireEliteRewardOption[] =>
    Array.isArray(rw)
      ? rw
          .filter((o: any) => Array.isArray(o) && o[0])
          .map((o: any) => ({
            pokemon: String(o[0]),
            item: o[1] ? String(o[1]) : undefined
          }))
      : []
  return {
    designId: String(doc.id ?? ""),
    name: encounter.name,
    icon,
    encounter,
    winRewards: decodeRewards(raw.winRewards),
    winRewardsShown:
      typeof raw.winRewardsShown === "number" ? raw.winRewardsShown : 3,
    lossRewards: decodeRewards(raw.lossRewards),
    lossRewardsShown:
      typeof raw.lossRewardsShown === "number" ? raw.lossRewardsShown : 2
  }
}

// Spire acts are 16 floors; treat them as quarters mapping onto the library's
// 20-floor stage ranges: floors 1-4 → "1-5", 5-8 → "6-10", 9-12 → "11-15",
// 13-16 → "16-20".
export function spireFloorToStageRange(floor: number): string {
  if (floor <= 4) return "1-5"
  if (floor <= 8) return "6-10"
  if (floor <= 12) return "11-15"
  return "16-20"
}

// Classic/Endless 20-floor acts map directly onto the library brackets. Act 1
// has no "1-5" bracket (the designer never offers it — see STAGE_LADDER) and
// no elites should appear that early: floors ≤5 in act 1 return "" (no
// bracket), which makes populateEliteDesignNodes convert any elite node there
// to a wild battle.
export function classicFloorToStageRange(act: number, floor: number): string {
  const range =
    floor <= 5 ? "1-5" : floor <= 10 ? "6-10" : floor <= 15 ? "11-15" : "16-20"
  return act === 1 && range === "1-5" ? "" : range
}

// The full stage ladder a design can be bumped along. Act 1 has no 1-5 elite
// range (matches STAGE_RANGES_BY_ACT in the client designer); bumping walks
// across act boundaries and caps at both ends.
const STAGE_LADDER: { act: number; stageRange: string }[] = [
  { act: 1, stageRange: "6-10" },
  { act: 1, stageRange: "11-15" },
  { act: 1, stageRange: "16-20" },
  { act: 2, stageRange: "1-5" },
  { act: 2, stageRange: "6-10" },
  { act: 2, stageRange: "11-15" },
  { act: 2, stageRange: "16-20" },
  { act: 3, stageRange: "1-5" },
  { act: 3, stageRange: "6-10" },
  { act: 3, stageRange: "11-15" },
  { act: 3, stageRange: "16-20" }
]

// Moves a design one step up/down the stage ladder (creator or admin only).
// Rewrites act/stages INSIDE designJson too — the stored metadata is always
// derived from the export string, so they must never disagree. Clears results
// (rates were measured against the old bracket stages).
export async function bumpEliteDesign(
  id: string,
  uid: string,
  direction: "up" | "down"
): Promise<
  { ok: true; act: number; stageRange: string } | { ok: false; error: string }
> {
  if (isGuestUid(uid)) return { ok: false, error: "forbidden" }
  try {
    const doc = await EliteDesign.findById(id)
    if (!doc) return { ok: false, error: "not_found" }
    // Creator or admin (role also needed for the approval-clear below when the
    // creator bumps an approved design).
    let isAdmin = false
    if (doc.creatorUid !== uid || doc.approved) {
      const user = await UserMetadata.findOne({ uid }, { role: 1 }).lean()
      isAdmin = user?.role === Role.ADMIN
      if (doc.creatorUid !== uid && !isAdmin) {
        return { ok: false, error: "forbidden" }
      }
    }
    const idx = STAGE_LADDER.findIndex(
      (s) => s.act === doc.act && s.stageRange === doc.stageRange
    )
    if (idx === -1) return { ok: false, error: "bad_stage" }
    const nextIdx = idx + (direction === "up" ? 1 : -1)
    if (nextIdx < 0 || nextIdx >= STAGE_LADDER.length) {
      return { ok: false, error: "at_limit" }
    }
    const target = STAGE_LADDER[nextIdx]
    let raw: any
    try {
      raw = JSON.parse(doc.designJson)
    } catch {
      return { ok: false, error: "malformed" }
    }
    raw.act = target.act
    raw.stages = target.stageRange
    doc.act = target.act
    doc.stageRange = target.stageRange
    doc.designJson = JSON.stringify(raw)
    doc.results = []
    // Approval was granted for the OLD bracket — a non-admin moving an approved
    // design (e.g. an end-game team bumped into the 1-5 bracket) must go back
    // through admin review. Admin bumps keep it.
    if (doc.approved && !isAdmin) doc.approved = false
    await doc.save()
    return { ok: true, act: target.act, stageRange: target.stageRange }
  } catch (e) {
    logger.error("Failed to bump elite design:", e)
    return { ok: false, error: "db_error" }
  }
}

// Deletes a design — only the creator or an admin may.
export async function deleteEliteDesign(
  id: string,
  uid: string
): Promise<boolean> {
  if (isGuestUid(uid)) return false
  try {
    const doc = await EliteDesign.findById(id).lean()
    if (!doc) return false
    if (doc.creatorUid !== uid) {
      const user = await UserMetadata.findOne({ uid }, { role: 1 }).lean()
      if (user?.role !== Role.ADMIN) return false
    }
    await EliteDesign.deleteOne({ _id: id })
    return true
  } catch (e) {
    logger.error("Failed to delete elite design:", e)
    return false
  }
}

export async function getEliteDesignById(
  id: string
): Promise<(IEliteDesign & { id: string }) | null> {
  try {
    const doc: any = await EliteDesign.findById(id).lean()
    if (!doc) return null
    return { ...doc, id: doc._id.toString() }
  } catch (e) {
    logger.error("Failed to get elite design:", e)
    return null
  }
}

// Persists a measurement's results. `expectedDesignJson` (the designJson the
// measurement actually ran against) guards a mid-measure edit/bump: both clear
// `results` because stale rates lie, so a measure completing afterwards must
// not write rates for the OLD content back onto the changed design. A bump
// rewrites designJson too, so this one check covers both.
export async function saveEliteDesignResults(
  id: string,
  results: Omit<IEliteDesignResult, "testedAt">[],
  expectedDesignJson?: string
): Promise<void> {
  try {
    const query: Record<string, unknown> = { _id: id }
    if (expectedDesignJson !== undefined) {
      query.designJson = expectedDesignJson
    }
    const res = await EliteDesign.updateOne(query, {
      $set: { results: results.map((r) => ({ ...r, testedAt: new Date() })) }
    })
    if (res.matchedCount === 0) {
      logger.info(
        `Elite design ${id} changed mid-measure — discarding stale results`
      )
    }
  } catch (e) {
    logger.error("Failed to save elite design results:", e)
  }
}
