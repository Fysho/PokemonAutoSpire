import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { computeSynergies } from "../../../../../models/colyseus-models/synergies"
import PokemonFactory from "../../../../../models/pokemon-factory"
import { getPokemonData } from "../../../../../models/precomputed/precomputed-pokemon-data"
import { Emotion, type PkmWithCustom } from "../../../../../types"
import { Item } from "../../../../../types/enum/Item"
import { Pkm, PkmIndex } from "../../../../../types/enum/Pokemon"
import type { Synergy } from "../../../../../types/enum/Synergy"
import { useAppSelector } from "../../../hooks"
import type { IDetailledPokemon } from "../../../models/bot-v2"
import {
  createEliteTestRoom,
  isEliteTestActive,
  rooms,
  sendEliteTest
} from "../../../network"
import { LocalStoreKeys, localStore } from "../../utils/store"
import PokemonPortrait from "../pokemon-portrait"
import Synergies from "../synergy/synergies"
import { BOSS_PRESETS } from "./boss-presets"
import ItemPicker from "./item-picker"
import PokemonPicker from "./pokemon-picker"
import SelectedEntity from "./selected-entity"
import TeamEditor from "./team-editor"
import "./team-builder.css"
import "./elite-designer.css"

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

export type StageRange = "1-5" | "6-10" | "11-15" | "16-20"

// A single reward option = one Pokémon + an optional item.
// `item` is either a real Item enum value or one of the RANDOM_ITEM_TOKENS
// (resolved to pickRandomIn(category) when wired into the game).
export interface RewardOption {
  pokemon: Pkm
  item?: string
}

export interface EliteDesign {
  kind: "elite" | "boss"
  name: string
  act: number // 1-3
  stageRange: StageRange
  // Map icon sprite (the avatar shown with the red outline). Defaults to the
  // first board Pokémon when unset.
  iconPokemon?: Pkm
  board: IDetailledPokemon[]
  bonus: Record<string, number>
  winRewards: RewardOption[]
  lossRewards: RewardOption[]
  // How many options to draw at random from each pool per fight (pick 1).
  winRewardsShown: number
  lossRewardsShown: number
  // Boss-only act-completion rewards. Default switches preserve the existing
  // player-dependent signature grants and difficulty-aware Shiny/Tool choices.
  useDefaultBossGrantedItems: boolean
  bossGrantedItems: string[]
  useDefaultBossItemRewards: boolean
  bossItemRewards: string[]
  bossItemRewardsShown: number
  // Library entry this design was loaded from / saved to (own entries only).
  // Editor-side tracking only — never part of the export string. When set, the
  // save button becomes "Update Library" and a "Create New" button appears.
  libraryId?: string
}

export const DEFAULT_ELITE_DESIGN: EliteDesign = {
  kind: "elite",
  name: "",
  act: 1,
  stageRange: "16-20",
  iconPokemon: undefined,
  board: [],
  bonus: {},
  winRewards: [],
  lossRewards: [],
  winRewardsShown: 3,
  lossRewardsShown: 2,
  useDefaultBossGrantedItems: true,
  bossGrantedItems: [],
  useDefaultBossItemRewards: true,
  bossItemRewards: [],
  bossItemRewardsShown: 3
}

// "Random from category" reward tokens. Each maps to an exported array in
// app/types/enum/Item.ts so the server can resolve it via pickRandomIn(...).
export const RANDOM_ITEM_TOKENS: { token: string; label: string }[] = [
  { token: "RANDOM_COMPONENT", label: "Random Component" },
  { token: "RANDOM_CRAFTED", label: "Random Crafted" },
  { token: "RANDOM_BERRY", label: "Random Berry" },
  { token: "RANDOM_TOOL", label: "Random Tool" },
  { token: "RANDOM_SYNERGY_STONE", label: "Random Synergy Stone" },
  { token: "RANDOM_SHINY", label: "Random Shiny Item" }
]

const RANDOM_TOKEN_LABEL: Record<string, string> = Object.fromEntries(
  RANDOM_ITEM_TOKENS.map((r) => [r.token, r.label])
)

function isRealItem(item: string | undefined): item is Item {
  return item != null && Object.keys(Item).includes(item)
}

// Stage ranges offered per act. Act 1 skips 1-5 (no elites that early).
const STAGE_RANGES_BY_ACT: Record<number, StageRange[]> = {
  1: ["6-10", "11-15", "16-20"],
  2: ["1-5", "6-10", "11-15", "16-20"],
  3: ["1-5", "6-10", "11-15", "16-20"]
}

interface EliteRecommendation {
  pokemonCount: [number, number]
  maxStarsPerPokemon: number
  starBudget: [number, number]
  rarities: string[]
}

// Mirrors getDifficultyConfig() in app/models/spire-encounters.ts (Normal mode),
// sampled at the top floor of each stage range. Keep in sync with that function.
const RECOMMENDATIONS: Record<
  number,
  Record<StageRange, EliteRecommendation>
> = {
  1: {
    "1-5": {
      pokemonCount: [2, 3],
      maxStarsPerPokemon: 1,
      starBudget: [2, 3],
      rarities: ["COMMON", "UNCOMMON"]
    },
    "6-10": {
      pokemonCount: [3, 4],
      maxStarsPerPokemon: 2,
      starBudget: [4, 6],
      rarities: ["COMMON", "UNCOMMON"]
    },
    "11-15": {
      pokemonCount: [3, 5],
      maxStarsPerPokemon: 2,
      starBudget: [6, 8],
      rarities: ["UNCOMMON", "RARE"]
    },
    "16-20": {
      pokemonCount: [4, 5],
      maxStarsPerPokemon: 2,
      starBudget: [7, 9],
      rarities: ["UNCOMMON", "RARE"]
    }
  },
  2: {
    "1-5": {
      pokemonCount: [5, 7],
      maxStarsPerPokemon: 3,
      starBudget: [6, 10],
      rarities: ["RARE", "EPIC"]
    },
    "6-10": {
      pokemonCount: [6, 7],
      maxStarsPerPokemon: 3,
      starBudget: [8, 12],
      rarities: ["RARE", "EPIC"]
    },
    "11-15": {
      pokemonCount: [6, 7],
      maxStarsPerPokemon: 3,
      starBudget: [10, 14],
      rarities: ["EPIC", "ULTRA"]
    },
    "16-20": {
      pokemonCount: [7, 8],
      maxStarsPerPokemon: 3,
      starBudget: [12, 15],
      rarities: ["EPIC", "ULTRA"]
    }
  },
  3: {
    "1-5": {
      pokemonCount: [7, 8],
      maxStarsPerPokemon: 3,
      starBudget: [13, 18],
      rarities: ["EPIC", "ULTRA"]
    },
    "6-10": {
      pokemonCount: [7, 9],
      maxStarsPerPokemon: 3,
      starBudget: [15, 21],
      rarities: ["EPIC", "ULTRA"]
    },
    "11-15": {
      pokemonCount: [8, 9],
      maxStarsPerPokemon: 3,
      starBudget: [17, 23],
      rarities: ["EPIC", "ULTRA"]
    },
    "16-20": {
      pokemonCount: [8, 9],
      maxStarsPerPokemon: 3,
      starBudget: [17, 23],
      rarities: ["EPIC", "ULTRA"]
    }
  }
}

function getRecommendation(
  act: number,
  range: StageRange
): EliteRecommendation {
  return RECOMMENDATIONS[act]?.[range] ?? RECOMMENDATIONS[1]["16-20"]
}

// SpireEncounter bonus-stat fields (see app/models/spire-encounters.ts)
const BONUS_FIELDS: { key: string; label: string }[] = [
  { key: "bonusHP", label: "Team HP" },
  { key: "bonusAtk", label: "Team ATK" },
  { key: "bonusDef", label: "Team DEF" },
  { key: "bonusSpeDef", label: "Team Sp.DEF" },
  { key: "bonusAP", label: "Team AP" },
  { key: "bonusPP", label: "Team PP" },
  { key: "mainBonusHP", label: "Main HP" },
  { key: "mainBonusAtk", label: "Main ATK" },
  { key: "mainBonusAP", label: "Main AP" }
]

// ---------------------------------------------------------------------------
// Export / import (compact JSON matching SpireEncounter shape)
// ---------------------------------------------------------------------------

export function buildExportString(design: EliteDesign): string {
  const ordered = [...design.board].sort((a, b) => a.y - b.y || a.x - b.x)
  const board = ordered.map((p) => [p.name, p.x, p.y])
  const items = ordered.map((p) => p.items ?? [])
  const hasItems = items.some((arr) => arr.length > 0)
  const bonus = Object.fromEntries(
    Object.entries(design.bonus).filter(([, v]) => Number(v))
  )
  const obj: Record<string, unknown> = {
    kind: design.kind,
    name:
      design.name?.trim() ||
      (design.kind === "boss" ? "Custom Boss" : "Custom Elite"),
    act: design.act,
    stages: design.kind === "boss" ? "boss" : design.stageRange,
    board
  }
  if (design.iconPokemon) obj.icon = design.iconPokemon
  if (hasItems) obj.items = items
  if (Object.keys(bonus).length) obj.bonus = bonus
  const encodeRewards = (rewards: RewardOption[] = []) =>
    rewards.map((r) => (r.item ? [r.pokemon, r.item] : [r.pokemon]))
  const winRewards = encodeRewards(design.winRewards)
  const lossRewards = encodeRewards(design.lossRewards)
  if (winRewards.length) {
    obj.winRewards = winRewards
    obj.winRewardsShown = design.winRewardsShown
  }
  if (lossRewards.length) {
    obj.lossRewards = lossRewards
    obj.lossRewardsShown = design.lossRewardsShown
  }
  if (design.kind === "boss") {
    obj.useDefaultBossGrantedItems = design.useDefaultBossGrantedItems
    obj.useDefaultBossItemRewards = design.useDefaultBossItemRewards
    if (design.bossGrantedItems.length) {
      obj.bossGrantedItems = design.bossGrantedItems
    }
    if (design.bossItemRewards.length) {
      obj.bossItemRewards = design.bossItemRewards
      obj.bossItemRewardsShown = design.bossItemRewardsShown
    }
  }
  return JSON.stringify(obj)
}

export function parseImportString(str: string): EliteDesign | null {
  try {
    const obj = JSON.parse(str)
    if (!obj || !Array.isArray(obj.board)) return null
    const items: Item[][] = Array.isArray(obj.items) ? obj.items : []
    const board: IDetailledPokemon[] = obj.board.map(
      (entry: [Pkm, number, number], i: number) => ({
        name: entry[0],
        x: entry[1],
        y: entry[2],
        items: items[i] ?? [],
        shiny: false,
        emotion: Emotion.NORMAL
      })
    )
    const decodeRewards = (raw: unknown): RewardOption[] =>
      Array.isArray(raw)
        ? raw
            .filter((o) => Array.isArray(o) && o[0])
            .map((o: [Pkm, string?]) => ({ pokemon: o[0], item: o[1] }))
        : []
    return {
      kind: obj.kind === "boss" ? "boss" : "elite",
      name: typeof obj.name === "string" ? obj.name : "",
      act: typeof obj.act === "number" ? obj.act : 1,
      stageRange:
        obj.kind === "boss" ? "16-20" : ((obj.stages as StageRange) ?? "16-20"),
      iconPokemon: typeof obj.icon === "string" ? (obj.icon as Pkm) : undefined,
      board,
      bonus: obj.bonus ?? {},
      winRewards: decodeRewards(obj.winRewards),
      lossRewards: decodeRewards(obj.lossRewards),
      winRewardsShown:
        typeof obj.winRewardsShown === "number" ? obj.winRewardsShown : 3,
      lossRewardsShown:
        typeof obj.lossRewardsShown === "number" ? obj.lossRewardsShown : 2,
      useDefaultBossGrantedItems: obj.useDefaultBossGrantedItems !== false,
      bossGrantedItems: Array.isArray(obj.bossGrantedItems)
        ? obj.bossGrantedItems.map(String)
        : [],
      useDefaultBossItemRewards: obj.useDefaultBossItemRewards !== false,
      bossItemRewards: Array.isArray(obj.bossItemRewards)
        ? obj.bossItemRewards.map(String)
        : [],
      bossItemRewardsShown:
        typeof obj.bossItemRewardsShown === "number"
          ? obj.bossItemRewardsShown
          : 3
    }
  } catch (e) {
    return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EliteDesigner(props: {
  design: EliteDesign
  updateDesign: (design: EliteDesign) => void
  onRequestClose?: () => void
}) {
  const { t } = useTranslation()
  const { design, updateDesign } = props
  const board = design.board

  const [selection, setSelection] = useState<Item | PkmWithCustom>({
    name: Pkm.MAGIKARP,
    shiny: false,
    emotion: Emotion.NORMAL
  })
  const [selectedPokemon, setSelectedPokemon] = useState<IDetailledPokemon>()
  const [copied, setCopied] = useState(false)
  const uid = useAppSelector((state) => state.network.uid)
  const [saveState, setSaveState] = useState<
    | "idle"
    | "saving"
    | "saved"
    | "error"
    | "full"
    | "taken"
    | "missing"
    | "invalid"
  >("idle")
  // The reward option currently being edited (picker/item clicks route to it).
  const [activeReward, setActiveReward] = useState<{
    set: "winRewards" | "lossRewards"
    index: number
  } | null>(null)

  function updateBoard(nextBoard: IDetailledPokemon[]) {
    updateDesign({ ...design, board: nextBoard })
  }

  // --- rewards ---
  function setRewards(
    set: "winRewards" | "lossRewards",
    rewards: RewardOption[]
  ) {
    updateDesign({ ...design, [set]: rewards })
  }

  function addReward(set: "winRewards" | "lossRewards") {
    const pokemon = isPokemonSelection(selection)
      ? (selection as PkmWithCustom).name
      : Pkm.MAGIKARP
    const next = [...design[set], { pokemon }]
    setRewards(set, next)
    setActiveReward({ set, index: next.length - 1 })
  }

  function addBoardToRewards(set: "winRewards" | "lossRewards") {
    const seen = new Set(design[set].map((r) => r.pokemon))
    const additions = [...board]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((p) => p.name)
      .filter((name) => !seen.has(name))
      .map((pokemon) => ({ pokemon }))
    if (additions.length) setRewards(set, [...design[set], ...additions])
  }

  function removeReward(set: "winRewards" | "lossRewards", index: number) {
    setRewards(
      set,
      design[set].filter((_, i) => i !== index)
    )
    setActiveReward(null)
  }

  function updateActiveReward(patch: Partial<RewardOption>) {
    if (!activeReward) return
    const { set, index } = activeReward
    setRewards(
      set,
      design[set].map((r, i) => (i === index ? { ...r, ...patch } : r))
    )
  }

  function isPokemonSelection(e: Item | PkmWithCustom): boolean {
    return typeof e === "object" && e != null && "name" in e
  }

  // Picker clicks route to the active reward option when one is being edited,
  // otherwise they drive the board selection like the team planner.
  function onPickerSelect(e: PkmWithCustom | Item) {
    if (activeReward) {
      if (isPokemonSelection(e)) {
        updateActiveReward({ pokemon: (e as PkmWithCustom).name })
        return
      }
      if (typeof e === "string") {
        updateActiveReward({ item: e })
        return
      }
    }
    setSelection(e)
  }

  // Icon dropdown is populated from the board (the icon is normally a fight
  // Pokémon); keep the current pick listed even if it leaves the board.
  const iconOptions = useMemo(() => {
    const set = new Set<string>(board.map((p) => p.name))
    if (design.iconPokemon) set.add(design.iconPokemon)
    return [...set].sort()
  }, [board, design.iconPokemon])

  const synergies: [Synergy, number][] = useMemo(() => {
    const map = computeSynergies(
      board.map((p) => {
        const pkm = PokemonFactory.createPokemonFromName(p.name, {
          emotion: p.emotion,
          shiny: p.shiny
        })
        pkm.positionX = p.x
        pkm.positionY = p.y
        p.items.forEach((item) => pkm.items.add(item))
        return pkm
      })
    )
    return [...map.entries()]
  }, [board])

  // --- board editing (mirrors team-builder.tsx) ---
  function addPokemon(x: number, y: number, pkm: PkmWithCustom) {
    let existingItems
    const i = board.findIndex((p) => p.x === x && p.y === y)
    const next = [...board]
    if (i >= 0) {
      existingItems = next[i].items
      next.splice(i, 1)
    }
    const newPokemon: IDetailledPokemon = {
      ...pkm,
      x,
      y,
      items: existingItems ?? []
    }
    setSelectedPokemon(newPokemon)
    updateBoard([...next, newPokemon])
  }

  function addItem(x: number, y: number, item: Item) {
    const next = board.map((p) => ({ ...p, items: [...p.items] }))
    const p = next.find((p) => p.x === x && p.y === y)
    if (p && p.items.length < 3) {
      p.items.push(item)
    } else if (p && p.items.length >= 3) {
      p.items = [item]
    }
    updateBoard(next)
  }

  function handleEditorClick(
    x: number,
    y: number,
    rightClick: boolean,
    itemIndex?: number
  ) {
    // Interacting with the board exits reward-edit mode so the pickers
    // go back to driving board placement.
    if (activeReward) setActiveReward(null)
    const pokemonOnCell = board.find((p) => p.x === x && p.y === y)
    if (rightClick) {
      if (itemIndex !== undefined && pokemonOnCell) {
        const next = board.map((p) =>
          p === pokemonOnCell
            ? { ...p, items: p.items.filter((_, j) => j !== itemIndex) }
            : p
        )
        updateBoard(next)
      } else {
        updateBoard(board.filter((p) => p !== pokemonOnCell))
        if (
          selectedPokemon &&
          selectedPokemon.x === x &&
          selectedPokemon.y === y
        ) {
          setSelectedPokemon(undefined)
        }
      }
    } else if (pokemonOnCell) {
      setSelection(pokemonOnCell)
      setSelectedPokemon(pokemonOnCell)
    } else if (Object.values(Pkm).includes((selection as PkmWithCustom).name)) {
      addPokemon(x, y, selection as PkmWithCustom)
    } else if (Object.keys(Item).includes(selection as Item)) {
      addItem(x, y, selection as Item)
    }
  }

  function handleDrop(x: number, y: number, e: React.DragEvent) {
    e.stopPropagation()
    e.preventDefault()
    const data = e.dataTransfer.getData("text/plain")
    if (data.startsWith("cell")) {
      const [, originX, originY] = data.split(",").map(Number)
      const next = board.map((p) => ({ ...p }))
      const pkm = next.find((p) => p.x === originX && p.y === originY)
      const otherPokemonOnCell = next.find((p) => p.x === x && p.y === y)
      if (pkm) {
        if (otherPokemonOnCell) {
          otherPokemonOnCell.x = originX
          otherPokemonOnCell.y = originY
        }
        pkm.x = x
        pkm.y = y
        updateBoard(next)
      }
    } else if (data.startsWith("pokemon")) {
      const [, name] = data.split(",") as [string, Pkm]
      const pkm: PkmWithCustom = { name, emotion: Emotion.NORMAL, shiny: false }
      addPokemon(x, y, pkm)
      setSelection(pkm)
    } else if (data.startsWith("item")) {
      const [, item] = data.split(",") as [string, Item]
      addItem(x, y, item)
      setSelection(item)
    }
  }

  function getFirstEmptyCell(): { x: number; y: number } | null {
    for (let y = 1; y <= 3; y++) {
      for (let x = 0; x < 8; x++) {
        if (board.find((p) => p.x === x && p.y === y) === undefined) {
          return { x, y }
        }
      }
    }
    return null
  }

  function addPokemonOnFirstEmptyCell(entity: PkmWithCustom) {
    const firstEmptyCell = getFirstEmptyCell()
    if (firstEmptyCell) addPokemon(firstEmptyCell.x, firstEmptyCell.y, entity)
  }

  function updateSelectedPokemon(pkm: PkmWithCustom) {
    setSelection(pkm)
    if (selectedPokemon != null) {
      const next = board.map((p) =>
        p === selectedPokemon
          ? { ...p, emotion: pkm.emotion, shiny: pkm.shiny }
          : p
      )
      updateBoard(next)
    }
  }

  // --- config controls ---
  function setKind(kind: "elite" | "boss") {
    updateDesign({ ...design, kind, libraryId: undefined })
    setActiveReward(null)
  }

  function loadBossPreset(index: number) {
    const preset = BOSS_PRESETS[index]
    if (!preset) return
    updateDesign({
      ...DEFAULT_ELITE_DESIGN,
      kind: "boss",
      name: preset.name,
      act: preset.act,
      stageRange: "16-20",
      iconPokemon: preset.icon,
      board: preset.board.map(([name, x, y], unitIndex) => ({
        name,
        x,
        y,
        items: [...(preset.items[unitIndex] ?? [])],
        shiny: false,
        emotion: Emotion.NORMAL
      })),
      bonus: { ...preset.bonus },
      // Explicitly preserve the current live boss reward behavior.
      useDefaultBossGrantedItems: true,
      useDefaultBossItemRewards: true
    })
    setSelectedPokemon(undefined)
    setActiveReward(null)
  }

  function setAct(act: number) {
    const ranges = STAGE_RANGES_BY_ACT[act]
    const stageRange = ranges.includes(design.stageRange)
      ? design.stageRange
      : ranges[ranges.length - 1]
    updateDesign({ ...design, act, stageRange })
  }

  function setBonus(key: string, value: number) {
    const bonus = { ...design.bonus }
    if (value) bonus[key] = value
    else delete bonus[key]
    updateDesign({ ...design, bonus })
  }

  function reset() {
    updateDesign({
      ...DEFAULT_ELITE_DESIGN,
      kind: design.kind,
      act: design.act,
      stageRange: design.stageRange
    })
    setSelectedPokemon(undefined)
    setActiveReward(null)
  }

  // --- recommendation / live tracker ---
  const rec = getRecommendation(design.act, design.stageRange)
  const placedCount = board.length
  const starsUsed = board.reduce(
    (s, p) => s + (getPokemonData(p.name)?.stars ?? 0),
    0
  )
  const maxStarPlaced = board.reduce(
    (m, p) => Math.max(m, getPokemonData(p.name)?.stars ?? 0),
    0
  )

  function status(value: number, [min, max]: [number, number]): string {
    if (value < min) return "elite-stat-under"
    if (value > max) return "elite-stat-over"
    return "elite-stat-ok"
  }

  // --- export ---
  const exportString = useMemo(() => buildExportString(design), [design])

  function copyExport() {
    navigator.clipboard?.writeText(exportString).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {}
    )
  }

  // --- save to library ---
  // With design.libraryId set (loaded from / previously saved to the library),
  // "Update Library" overwrites that entry in place and "Create New" makes a
  // separate entry (needs a unique name). Without it, "Save to Library" creates
  // one and remembers its id so subsequent saves become updates.
  async function saveToLibrary(asNew: boolean) {
    if (saveState === "saving") return
    setSaveState("saving")
    try {
      const res = await fetch("/api/elite-designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: uid || "local-player",
          design: exportString,
          id: asNew ? undefined : design.libraryId
        })
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setSaveState("saved")
        if (body?.id && body.id !== design.libraryId) {
          updateDesign({ ...design, libraryId: body.id })
        }
      } else {
        // Server-side content validation codes (crafted/corrupted imports —
        // the designer UI itself can't produce these).
        const invalidCodes = [
          "invalid_pokemon",
          "bad_position",
          "bad_items",
          "bad_stats",
          "bad_rewards",
          "board_too_large",
          "bad_stage"
        ]
        setSaveState(
          body?.error === "library_full"
            ? "full"
            : body?.error === "name_taken"
              ? "taken"
              : body?.error === "not_found"
                ? "missing"
                : invalidCodes.includes(body?.error)
                  ? "invalid"
                  : "error"
        )
      }
    } catch {
      setSaveState("error")
    }
    setTimeout(() => setSaveState("idle"), 2500)
  }

  function importFromPrompt() {
    const str = window.prompt(t("elite_designer_import_prompt"))
    if (!str) return
    const parsed = parseImportString(str)
    if (parsed) {
      updateDesign(parsed)
      setSelectedPokemon(undefined)
      setActiveReward(null)
    } else {
      alert(t("elite_designer_import_error"))
    }
  }

  function renderRewardSet(
    set: "winRewards" | "lossRewards",
    label: string,
    shownKey: "winRewardsShown" | "lossRewardsShown"
  ) {
    const pool = design[set].length
    return (
      <div className="elite-reward-set">
        <div className="elite-reward-head">
          <span>{label}</span>
          <span className="elite-reward-buttons">
            <button
              className="bubbly blue small"
              onClick={() => addReward(set)}
            >
              + {t("elite_designer_reward_add")}
            </button>
            <button
              className="bubbly dark small"
              onClick={() => addBoardToRewards(set)}
            >
              + {t("elite_designer_reward_board")}
            </button>
          </span>
        </div>
        <div className="elite-reward-shown">
          <span>{t("elite_designer_reward_show")}</span>
          <input
            type="number"
            min={1}
            value={design[shownKey]}
            onChange={(e) =>
              updateDesign({
                ...design,
                [shownKey]: Math.max(1, Math.round(Number(e.target.value) || 1))
              })
            }
          />
          <span>
            {t("elite_designer_reward_of", { count: pool })} ·{" "}
            {t("elite_designer_reward_pick_one")}
          </span>
        </div>
        <div className="elite-reward-list">
          {design[set].length === 0 && (
            <span className="elite-rec-note">
              {t("elite_designer_reward_empty")}
            </span>
          )}
          {design[set].map((option, i) => (
            <RewardChip
              key={i}
              option={option}
              active={activeReward?.set === set && activeReward?.index === i}
              onSelect={() =>
                setActiveReward((cur) =>
                  cur && cur.set === set && cur.index === i
                    ? null
                    : { set, index: i }
                )
              }
              onRemove={() => removeReward(set, i)}
              onClearItem={() =>
                setRewards(
                  set,
                  design[set].map((r, j) =>
                    j === i ? { ...r, item: undefined } : r
                  )
                )
              }
            />
          ))}
        </div>
      </div>
    )
  }

  function renderBossItemPool(
    field: "bossGrantedItems" | "bossItemRewards",
    label: string,
    includeRandom: boolean
  ) {
    const items = design[field]
    const addItem = (item: string) => {
      if (item && !items.includes(item)) {
        updateDesign({ ...design, [field]: [...items, item] })
      }
    }
    return (
      <div className="elite-reward-set">
        <div className="elite-reward-head">
          <span>{label}</span>
          <select value="" onChange={(event) => addItem(event.target.value)}>
            <option value="">+ Add item</option>
            {Object.values(Item).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
            {includeRandom &&
              RANDOM_ITEM_TOKENS.map(({ token, label: tokenLabel }) => (
                <option key={token} value={token}>
                  {tokenLabel}
                </option>
              ))}
          </select>
        </div>
        <div className="elite-boss-item-list">
          {items.length === 0 && (
            <span className="elite-rec-note">No custom items selected.</span>
          )}
          {items.map((item) => (
            <button
              key={item}
              className="bubbly dark small"
              onClick={() =>
                updateDesign({
                  ...design,
                  [field]: items.filter((candidate) => candidate !== item)
                })
              }
              title="Remove item"
            >
              {RANDOM_TOKEN_LABEL[item] ?? item} ×
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div id="team-builder" className="elite-designer">
      <div className="synergies-container my-box">
        <Synergies synergies={synergies} tooltipPortal={false} />
      </div>

      <div className="actions elite-top">
        <label className="elite-field">
          <span>Design</span>
          <select
            value={design.kind}
            onChange={(event) =>
              setKind(event.target.value === "boss" ? "boss" : "elite")
            }
          >
            <option value="elite">Elite</option>
            <option value="boss">Act Boss</option>
          </select>
        </label>
        <label className="elite-field">
          <span>{t("elite_designer_act")}</span>
          <select
            value={design.act}
            onChange={(e) => setAct(Number(e.target.value))}
          >
            {[1, 2, 3].map((a) => (
              <option key={a} value={a}>
                {t("elite_designer_act")} {a}
              </option>
            ))}
          </select>
        </label>
        {design.kind === "elite" ? (
          <label className="elite-field">
            <span>{t("elite_designer_stage")}</span>
            <select
              value={design.stageRange}
              onChange={(e) =>
                updateDesign({
                  ...design,
                  stageRange: e.target.value as StageRange
                })
              }
            >
              {STAGE_RANGES_BY_ACT[design.act].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="elite-field">
            <span>Example boss</span>
            <select
              value=""
              onChange={(event) => loadBossPreset(Number(event.target.value))}
            >
              <option value="">Load preset…</option>
              {BOSS_PRESETS.map((preset, index) => (
                <option key={`${preset.act}-${preset.name}`} value={index}>
                  Act {preset.act} · {preset.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="elite-field elite-name">
          <span>{t("elite_designer_name")}</span>
          <input
            type="text"
            value={design.name}
            placeholder={
              design.kind === "boss" ? "Custom Boss" : "Custom Elite"
            }
            onChange={(e) => updateDesign({ ...design, name: e.target.value })}
          />
        </label>
        <label className="elite-field">
          <span>{t("elite_designer_icon")}</span>
          <div className="elite-icon-select">
            {design.iconPokemon && (
              <PokemonPortrait
                portrait={{ index: PkmIndex[design.iconPokemon] }}
              />
            )}
            <select
              value={design.iconPokemon ?? ""}
              onChange={(e) =>
                updateDesign({
                  ...design,
                  iconPokemon: e.target.value
                    ? (e.target.value as Pkm)
                    : undefined
                })
              }
            >
              <option value="">{t("elite_designer_icon_auto")}</option>
              {iconOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </label>
        <EliteTestControls
          design={design}
          onRequestClose={props.onRequestClose}
        />
        <button className="bubbly red" onClick={reset}>
          <img src="assets/ui/trash.svg" /> {t("reset")}
        </button>
      </div>

      <TeamEditor
        board={board}
        handleEditorClick={handleEditorClick}
        handleDrop={handleDrop}
        showBench={false}
      />

      <div className="elite-sidebar">
        {design.kind === "elite" ? (
          <div className="my-box elite-rec">
            <h4>
              {t("elite_designer_recommended")} · {t("elite_designer_act")}{" "}
              {design.act} · {design.stageRange}
            </h4>
            <div className="elite-rec-grid">
              <span>{t("elite_designer_pokemon")}</span>
              <span className={status(placedCount, rec.pokemonCount)}>
                {placedCount} / {rec.pokemonCount[0]}–{rec.pokemonCount[1]}
              </span>
              <span>{t("elite_designer_stars")}</span>
              <span className={status(starsUsed, rec.starBudget)}>
                {starsUsed} / {rec.starBudget[0]}–{rec.starBudget[1]}
              </span>
              <span>{t("elite_designer_max_stars")}</span>
              <span
                className={
                  maxStarPlaced > rec.maxStarsPerPokemon
                    ? "elite-stat-over"
                    : ""
                }
              >
                {maxStarPlaced} / {rec.maxStarsPerPokemon}★
              </span>
              <span>{t("elite_designer_rarities")}</span>
              <span>{rec.rarities.join(", ")}</span>
            </div>
            <p className="elite-rec-note">{t("elite_designer_not_a_limit")}</p>
          </div>
        ) : (
          <div className="my-box elite-rec">
            <h4>Act {design.act} Boss</h4>
            <p className="elite-rec-note">
              Boss measurements use 100 recorded teams from Act {design.act}{" "}
              Floor 15 and 100 from Floor 20 at each difficulty.
            </p>
          </div>
        )}

        <div className="my-box elite-rewards">
          <h4>{t("elite_designer_rewards")}</h4>
          {renderRewardSet(
            "winRewards",
            t("elite_designer_win_rewards"),
            "winRewardsShown"
          )}
          {renderRewardSet(
            "lossRewards",
            t("elite_designer_loss_rewards"),
            "lossRewardsShown"
          )}
          {activeReward && (
            <div className="elite-random-palette">
              <div className="elite-reward-editing">
                <span className="elite-rec-note">
                  {t("elite_designer_reward_hint")}
                </span>
                <button
                  className="bubbly green small"
                  onClick={() => setActiveReward(null)}
                >
                  {t("elite_designer_reward_done")}
                </button>
              </div>
              <div className="elite-random-tokens">
                {RANDOM_ITEM_TOKENS.map((rt) => (
                  <button
                    key={rt.token}
                    className="bubbly dark small"
                    onClick={() => updateActiveReward({ item: rt.token })}
                  >
                    {rt.label}
                  </button>
                ))}
                <button
                  className="bubbly red small"
                  onClick={() => updateActiveReward({ item: undefined })}
                >
                  {t("elite_designer_reward_no_item")}
                </button>
              </div>
            </div>
          )}
          {design.kind === "boss" && (
            <div className="elite-boss-rewards">
              <h4>Boss act-completion rewards</h4>
              <label className="elite-boss-default">
                <input
                  type="checkbox"
                  checked={design.useDefaultBossGrantedItems}
                  onChange={(event) =>
                    updateDesign({
                      ...design,
                      useDefaultBossGrantedItems: event.target.checked
                    })
                  }
                />
                Use current player-dependent signature item grants
              </label>
              {!design.useDefaultBossGrantedItems &&
                renderBossItemPool(
                  "bossGrantedItems",
                  "Items granted immediately on a win",
                  false
                )}
              <label className="elite-boss-default">
                <input
                  type="checkbox"
                  checked={design.useDefaultBossItemRewards}
                  onChange={(event) =>
                    updateDesign({
                      ...design,
                      useDefaultBossItemRewards: event.target.checked
                    })
                  }
                />
                Use current difficulty-aware Shiny/Tool choices
              </label>
              {!design.useDefaultBossItemRewards && (
                <>
                  {renderBossItemPool(
                    "bossItemRewards",
                    "Act-completion item choice pool",
                    true
                  )}
                  <label className="elite-reward-shown">
                    Show on win
                    <input
                      type="number"
                      min={1}
                      value={design.bossItemRewardsShown}
                      onChange={(event) =>
                        updateDesign({
                          ...design,
                          bossItemRewardsShown: Math.max(
                            1,
                            Math.round(Number(event.target.value) || 1)
                          )
                        })
                      }
                    />
                    (losses show one)
                  </label>
                </>
              )}
            </div>
          )}
        </div>

        <details className="my-box elite-bonus">
          <summary>{t("elite_designer_bonus_stats")}</summary>
          <div className="elite-bonus-grid">
            {BONUS_FIELDS.map((f) => (
              <label key={f.key}>
                <span>{f.label}</span>
                <input
                  type="number"
                  value={design.bonus[f.key] ?? ""}
                  placeholder="0"
                  onChange={(e) =>
                    setBonus(f.key, Math.round(Number(e.target.value) || 0))
                  }
                />
              </label>
            ))}
          </div>
        </details>

        <div className="my-box elite-export">
          <h4>{t("elite_designer_export")}</h4>
          <textarea
            readOnly
            value={exportString}
            onFocus={(e) => e.target.select()}
          />
          <div className="elite-export-actions">
            <button className="bubbly blue" onClick={copyExport}>
              {copied ? t("elite_designer_copied") : t("elite_designer_copy")}
            </button>
            <button className="bubbly dark" onClick={importFromPrompt}>
              {t("elite_designer_import")}
            </button>
            <button
              className="bubbly green"
              onClick={() => saveToLibrary(false)}
              disabled={board.length === 0 || saveState === "saving"}
              title={
                board.length === 0
                  ? "Place some Pokémon first"
                  : design.libraryId
                    ? "Overwrite the library entry this design was loaded from (changing an approved design's content clears its approval — an admin must re-approve)"
                    : "Save to the shared library (Library tab) for success-rate measurement"
              }
            >
              {design.libraryId ? "Update Library" : "Save to Library"}
            </button>
            {design.libraryId && (
              <button
                className="bubbly dark"
                onClick={() => saveToLibrary(true)}
                disabled={board.length === 0 || saveState === "saving"}
                title="Save as a separate new library entry (give it a different name first)"
              >
                Create New
              </button>
            )}
          </div>
          {saveState !== "idle" && (
            <p className="elite-rec-note elite-save-status">
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved to library ✓"
                  : saveState === "taken"
                    ? "Name already used — rename the design first"
                    : saveState === "full"
                      ? "Library full (50 designs max)"
                      : saveState === "missing"
                        ? "Original entry was deleted — use Create New"
                        : saveState === "invalid"
                          ? "Design contains invalid data (Pokémon, items, positions, stats or stage) — re-import or rebuild it"
                          : "Save failed"}
            </p>
          )}
          <p className="elite-rec-note">{t("elite_designer_export_hint")}</p>
        </div>

        <SelectedEntity entity={selection} onChange={updateSelectedPokemon} />
      </div>

      <ItemPicker
        selectEntity={(e) => onPickerSelect(e as Item)}
        selected={selection}
      />
      <PokemonPicker
        selectEntity={(e) => onPickerSelect(e as PkmWithCustom | Item)}
        addEntity={addPokemonOnFirstEmptyCell}
        selected={selection}
      />
    </div>
  )
}

// Human-friendly label for an async-fight stage key ("act5-floor10").
function formatStageLabel(s: string): string {
  const m = s.match(/^act(\d+)-floor(\d+)$/)
  return m ? `Act ${m[1]} · Floor ${m[2]}` : s
}

// Tab-row button (rendered next to Designer/Library in elite-designer-modal)
// that creates and joins the elite test sandbox room. Disabled when already in
// test mode or mid-run.
export function EnterTestModeTab(props: { onRequestClose?: () => void }) {
  const navigate = useNavigate()
  const uid = useAppSelector((state) => state.network.uid)
  // NEVER use state.network.displayName here — that is the Firebase/Google auth
  // name (the player's real name) and showing it in-game is a doxxing leak. Use
  // the chosen in-game username, resolved exactly like spire-lobby does.
  const profileName = useAppSelector(
    (state) => state.network.profile?.displayName
  )
  const avatar = useAppSelector((state) => state.network.profile?.avatar)
  const [entering, setEntering] = useState(false)

  const inTestRoom = isEliteTestActive()
  const inOtherRoom = !!rooms.game && !inTestRoom

  async function enterTestMode() {
    if (entering || inTestRoom || inOtherRoom) return
    setEntering(true)
    try {
      // In-game username, resolved like spire-lobby: DB-backed SPIRE_PLAYER_NAME
      // wins, the "Username"/"Player" placeholders count as unset, then the
      // profile name, then a generic fallback. Never the Google account name.
      const localName = localStore.get(LocalStoreKeys.SPIRE_PLAYER_NAME)
      const inGameName =
        (typeof localName === "string" &&
          localName.trim() &&
          localName !== "Username" &&
          localName !== "Player" &&
          localName.trim()) ||
        profileName ||
        "EliteTester"
      await createEliteTestRoom({
        uid: uid || "local-player",
        displayName: inGameName,
        avatar: avatar || "0019/Normal"
      })
      props.onRequestClose?.()
      navigate("/game")
    } catch (e) {
      setEntering(false)
    }
  }

  return (
    <button
      className={`bubbly ${inTestRoom ? "green" : "orange"}`}
      onClick={enterTestMode}
      disabled={entering || inTestRoom || inOtherRoom}
      title={
        inTestRoom
          ? "You are already in test mode"
          : inOtherRoom
            ? "Test mode is unavailable during a run"
            : "Load a sandbox room so you can test fights and measure designs without starting a run"
      }
    >
      {inTestRoom
        ? "In Test Mode ✓"
        : entering
          ? "Loading…"
          : "Enter Test Mode"}
    </button>
  )
}

// Test controls: stage the current design against a live encounter, saved
// Endless team, or another shared library design. Requires the dedicated test
// sandbox; the modal closes so the preview and fight remain visible.
type EliteTestDifficulty = 0 | 1 | 2 | 3

const ELITE_TEST_DIFFICULTIES: {
  value: EliteTestDifficulty
  label: string
}[] = [
  { value: 0, label: "Easy" },
  { value: 1, label: "Normal" },
  { value: 2, label: "Hard" },
  { value: 3, label: "Impossible" }
]

const SPECIAL_TEST_STAGES = [
  { stage: "boss-act1", label: "Act 1 Boss (live pool)" },
  { stage: "boss-act2", label: "Act 2 Boss (live pool)" },
  { stage: "boss-act3", label: "Act 3 Boss (live pool)" },
  { stage: "arceus", label: "Arceus" }
] as const

type EliteTestOpponentType = "stage" | "design"

interface EliteTestLibraryDesign {
  id: string
  kind: "elite" | "boss"
  name: string
  act: number
  creatorName: string
}

function EliteTestControls(props: {
  design: EliteDesign
  onRequestClose?: () => void
}) {
  const { design, onRequestClose } = props

  const [opponentType, setOpponentType] = useState<EliteTestOpponentType>(() =>
    localStore.get(LocalStoreKeys.ELITE_TEST_OPPONENT_TYPE) === "design"
      ? "design"
      : "stage"
  )
  const [stages, setStages] = useState<{ stage: string; count: number }[]>([])
  const [stage, setStage] = useState<string>(
    () => localStore.get(LocalStoreKeys.ELITE_TEST_STAGE) ?? "boss-act1"
  )
  const [libraryDesigns, setLibraryDesigns] = useState<
    EliteTestLibraryDesign[]
  >([])
  const [opponentDesignId, setOpponentDesignId] = useState<string>(
    () => localStore.get(LocalStoreKeys.ELITE_TEST_DESIGN_ID) ?? ""
  )
  const [difficulty, setDifficulty] = useState<EliteTestDifficulty>(() => {
    const stored = localStore.get(LocalStoreKeys.ELITE_TEST_DIFFICULTY)
    return ELITE_TEST_DIFFICULTIES.some(({ value }) => value === stored)
      ? stored
      : 1
  })

  const inTestRoom = isEliteTestActive()
  const inOtherRoom = !!rooms.game && !inTestRoom

  useEffect(() => {
    let cancelled = false
    fetch("/api/async-stages")
      .then((res) => res.json())
      .then((data: { stage: string; count: number }[]) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        setStages(list)
        setStage((current) => {
          const isSpecial = SPECIAL_TEST_STAGES.some(
            ({ stage: value }) => value === current
          )
          return isSpecial || list.some(({ stage: value }) => value === current)
            ? current
            : (list[0]?.stage ?? "boss-act1")
        })
      })
      .catch(() => {})
    fetch("/api/elite-designs")
      .then((res) => res.json())
      .then((data: EliteTestLibraryDesign[]) => {
        if (cancelled) return
        const list = (Array.isArray(data) ? data : []).sort(
          (left, right) =>
            left.kind.localeCompare(right.kind) ||
            left.act - right.act ||
            left.name.localeCompare(right.name) ||
            left.creatorName.localeCompare(right.creatorName)
        )
        setLibraryDesigns(list)
        setOpponentDesignId((current) =>
          list.some(({ id }) => id === current) ? current : (list[0]?.id ?? "")
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    localStore.set(LocalStoreKeys.ELITE_TEST_OPPONENT_TYPE, opponentType)
  }, [opponentType])

  useEffect(() => {
    if (stage) localStore.set(LocalStoreKeys.ELITE_TEST_STAGE, stage)
  }, [stage])

  useEffect(() => {
    if (opponentDesignId) {
      localStore.set(LocalStoreKeys.ELITE_TEST_DESIGN_ID, opponentDesignId)
    }
  }, [opponentDesignId])

  useEffect(() => {
    localStore.set(LocalStoreKeys.ELITE_TEST_DIFFICULTY, difficulty)
  }, [difficulty])

  const hasOpponent =
    opponentType === "stage" ? stage !== "" : opponentDesignId !== ""

  function runTest() {
    if (!inTestRoom || !hasOpponent || design.board.length === 0) return
    sendEliteTest(
      buildExportString(design),
      opponentType === "stage"
        ? { type: "stage", stage, difficulty }
        : { type: "design", designId: opponentDesignId }
    )
    onRequestClose?.()
  }

  if (inOtherRoom) {
    return (
      <span className="elite-rec-note elite-test-note">
        Test mode is unavailable during a run.
      </span>
    )
  }

  return (
    <span className="elite-test-controls">
      <label className="elite-field">
        <span>Opponent type</span>
        <select
          value={opponentType}
          onChange={(event) =>
            setOpponentType(event.target.value as EliteTestOpponentType)
          }
        >
          <option value="stage">Stage encounter</option>
          <option value="design">Library design</option>
        </select>
      </label>
      {opponentType === "stage" ? (
        <label className="elite-field">
          <span>Test stage</span>
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            title="Live act bosses, Arceus, or a saved Endless team"
          >
            <optgroup label="Act-end encounters">
              {SPECIAL_TEST_STAGES.map((option) => (
                <option key={option.stage} value={option.stage}>
                  {option.label}
                </option>
              ))}
            </optgroup>
            {stages.length > 0 && (
              <optgroup label="Saved Endless teams">
                {stages.map((option) => (
                  <option key={option.stage} value={option.stage}>
                    {formatStageLabel(option.stage)} ({option.count})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      ) : (
        <label className="elite-field">
          <span>Designed opponent</span>
          <select
            value={opponentDesignId}
            onChange={(event) => setOpponentDesignId(event.target.value)}
            disabled={libraryDesigns.length === 0}
            title="All shared elite and boss designs"
          >
            {libraryDesigns.length === 0 && (
              <option value="">No shared designs</option>
            )}
            {(["elite", "boss"] as const).map((kind) => {
              const options = libraryDesigns.filter(
                (candidate) => candidate.kind === kind
              )
              return options.length > 0 ? (
                <optgroup
                  key={kind}
                  label={kind === "elite" ? "Elites" : "Bosses"}
                >
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      Act {option.act} · {option.name} — {option.creatorName}
                    </option>
                  ))}
                </optgroup>
              ) : null
            })}
          </select>
        </label>
      )}
      <label className="elite-field">
        <span>Difficulty</span>
        <select
          value={difficulty}
          onChange={(event) =>
            setDifficulty(Number(event.target.value) as EliteTestDifficulty)
          }
          disabled={opponentType === "design"}
          title={
            opponentType === "design"
              ? "Library designs use their exact authored items and bonuses"
              : "Difficulty passed to the selected live encounter"
          }
        >
          {ELITE_TEST_DIFFICULTIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="bubbly green"
        onClick={runTest}
        disabled={!inTestRoom || !hasOpponent || design.board.length === 0}
        title={
          !inTestRoom
            ? "Enter Test Mode first (button at the top of this window)"
            : design.board.length === 0
              ? "Place some Pokémon first"
              : !hasOpponent
                ? "No opponent is available"
                : "Stage a fight against the selected opponent"
        }
      >
        ▶ Test
      </button>
    </span>
  )
}

function RewardChip(props: {
  option: RewardOption
  active: boolean
  onSelect: () => void
  onRemove: () => void
  onClearItem: () => void
}) {
  const { option, active, onSelect, onRemove, onClearItem } = props
  return (
    <div className={"elite-reward-chip" + (active ? " active" : "")}>
      <button className="elite-reward-remove" onClick={onRemove} title="Remove">
        ×
      </button>
      <div className="elite-reward-portrait" onClick={onSelect}>
        <PokemonPortrait portrait={{ index: PkmIndex[option.pokemon] }} />
      </div>
      {option.item ? (
        isRealItem(option.item) ? (
          <img
            className="elite-reward-item"
            src={"assets/item/" + option.item + ".png"}
            onClick={onClearItem}
            title="Click to clear"
          />
        ) : (
          <span
            className="elite-reward-token"
            onClick={onClearItem}
            title="Click to clear"
          >
            {RANDOM_TOKEN_LABEL[option.item] ?? option.item}
          </span>
        )
      ) : (
        <span className="elite-reward-noitem">—</span>
      )}
    </div>
  )
}
