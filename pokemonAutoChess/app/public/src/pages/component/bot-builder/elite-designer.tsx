import type React from "react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { computeSynergies } from "../../../../../models/colyseus-models/synergies"
import { getPokemonData } from "../../../../../models/precomputed/precomputed-pokemon-data"
import PokemonFactory from "../../../../../models/pokemon-factory"
import { Emotion, type PkmWithCustom } from "../../../../../types"
import { Item } from "../../../../../types/enum/Item"
import { Pkm, PkmIndex } from "../../../../../types/enum/Pokemon"
import type { Synergy } from "../../../../../types/enum/Synergy"
import type { IDetailledPokemon } from "../../../models/bot-v2"
import PokemonPortrait from "../pokemon-portrait"
import Synergies from "../synergy/synergies"
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
}

export const DEFAULT_ELITE_DESIGN: EliteDesign = {
  name: "",
  act: 1,
  stageRange: "16-20",
  iconPokemon: undefined,
  board: [],
  bonus: {},
  winRewards: [],
  lossRewards: [],
  winRewardsShown: 3,
  lossRewardsShown: 2
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
const RECOMMENDATIONS: Record<number, Record<StageRange, EliteRecommendation>> = {
  1: {
    "1-5": { pokemonCount: [2, 3], maxStarsPerPokemon: 1, starBudget: [2, 3], rarities: ["COMMON", "UNCOMMON"] },
    "6-10": { pokemonCount: [3, 4], maxStarsPerPokemon: 2, starBudget: [4, 6], rarities: ["COMMON", "UNCOMMON"] },
    "11-15": { pokemonCount: [3, 5], maxStarsPerPokemon: 2, starBudget: [6, 8], rarities: ["UNCOMMON", "RARE"] },
    "16-20": { pokemonCount: [4, 5], maxStarsPerPokemon: 2, starBudget: [7, 9], rarities: ["UNCOMMON", "RARE"] }
  },
  2: {
    "1-5": { pokemonCount: [5, 7], maxStarsPerPokemon: 3, starBudget: [6, 10], rarities: ["RARE", "EPIC"] },
    "6-10": { pokemonCount: [6, 7], maxStarsPerPokemon: 3, starBudget: [8, 12], rarities: ["RARE", "EPIC"] },
    "11-15": { pokemonCount: [6, 7], maxStarsPerPokemon: 3, starBudget: [10, 14], rarities: ["EPIC", "ULTRA"] },
    "16-20": { pokemonCount: [7, 8], maxStarsPerPokemon: 3, starBudget: [12, 15], rarities: ["EPIC", "ULTRA"] }
  },
  3: {
    "1-5": { pokemonCount: [7, 8], maxStarsPerPokemon: 3, starBudget: [13, 18], rarities: ["EPIC", "ULTRA"] },
    "6-10": { pokemonCount: [7, 9], maxStarsPerPokemon: 3, starBudget: [15, 21], rarities: ["EPIC", "ULTRA"] },
    "11-15": { pokemonCount: [8, 9], maxStarsPerPokemon: 3, starBudget: [17, 23], rarities: ["EPIC", "ULTRA"] },
    "16-20": { pokemonCount: [8, 9], maxStarsPerPokemon: 3, starBudget: [17, 23], rarities: ["EPIC", "ULTRA"] }
  }
}

function getRecommendation(act: number, range: StageRange): EliteRecommendation {
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
    name: design.name?.trim() || "Custom Elite",
    act: design.act,
    stages: design.stageRange,
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
      name: typeof obj.name === "string" ? obj.name : "",
      act: typeof obj.act === "number" ? obj.act : 1,
      stageRange: (obj.stages as StageRange) ?? "16-20",
      iconPokemon: typeof obj.icon === "string" ? (obj.icon as Pkm) : undefined,
      board,
      bonus: obj.bonus ?? {},
      winRewards: decodeRewards(obj.winRewards),
      lossRewards: decodeRewards(obj.lossRewards),
      winRewardsShown:
        typeof obj.winRewardsShown === "number" ? obj.winRewardsShown : 3,
      lossRewardsShown:
        typeof obj.lossRewardsShown === "number" ? obj.lossRewardsShown : 2
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
  // The reward option currently being edited (picker/item clicks route to it).
  const [activeReward, setActiveReward] = useState<{
    set: "winRewards" | "lossRewards"
    index: number
  } | null>(null)

  function updateBoard(nextBoard: IDetailledPokemon[]) {
    updateDesign({ ...design, board: nextBoard })
  }

  // --- rewards ---
  function setRewards(set: "winRewards" | "lossRewards", rewards: RewardOption[]) {
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
        if (selectedPokemon && selectedPokemon.x === x && selectedPokemon.y === y) {
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
    updateDesign({ ...DEFAULT_ELITE_DESIGN, act: design.act, stageRange: design.stageRange })
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
            <button className="bubbly blue small" onClick={() => addReward(set)}>
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
              active={
                activeReward?.set === set && activeReward?.index === i
              }
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

  return (
    <div id="team-builder" className="elite-designer">
      <div className="synergies-container my-box">
        <Synergies synergies={synergies} tooltipPortal={false} />
      </div>

      <div className="actions elite-top">
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
        <label className="elite-field">
          <span>{t("elite_designer_stage")}</span>
          <select
            value={design.stageRange}
            onChange={(e) =>
              updateDesign({ ...design, stageRange: e.target.value as StageRange })
            }
          >
            {STAGE_RANGES_BY_ACT[design.act].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="elite-field elite-name">
          <span>{t("elite_designer_name")}</span>
          <input
            type="text"
            value={design.name}
            placeholder="Custom Elite"
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
                maxStarPlaced > rec.maxStarsPerPokemon ? "elite-stat-over" : ""
              }
            >
              {maxStarPlaced} / {rec.maxStarsPerPokemon}★
            </span>
            <span>{t("elite_designer_rarities")}</span>
            <span>{rec.rarities.join(", ")}</span>
          </div>
          <p className="elite-rec-note">{t("elite_designer_not_a_limit")}</p>
        </div>

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
          <textarea readOnly value={exportString} onFocus={(e) => e.target.select()} />
          <div className="elite-export-actions">
            <button className="bubbly blue" onClick={copyExport}>
              {copied ? t("elite_designer_copied") : t("elite_designer_copy")}
            </button>
            <button className="bubbly dark" onClick={importFromPrompt}>
              {t("elite_designer_import")}
            </button>
          </div>
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
