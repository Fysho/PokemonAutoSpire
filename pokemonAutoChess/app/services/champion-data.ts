import * as fs from "fs"
import * as path from "path"
import { Item } from "../types/enum/Item"
import { Pkm } from "../types/enum/Pokemon"

export interface PokemonStatBoosts {
  hp: number
  atk: number
  def: number
  speDef: number
  ap: number
  speed: number
}

export interface ChampionSlotData {
  name: string
  avatar: string
  board: [pkm: string, x: number, y: number][]
  items: string[][]
  statBoosts: PokemonStatBoosts[]
  inventory: string[]
  bonusHP: number
  bonusAtk: number
  bonusAP: number
}

export interface ChampionFileData {
  champion: ChampionSlotData
  eliteFour: [ChampionSlotData, ChampionSlotData, ChampionSlotData, ChampionSlotData]
}

export type DifficultyMode = 0 | 1 | 2

const DIFFICULTY_LABELS: Record<DifficultyMode, string> = {
  0: "Easy",
  1: "Normal",
  2: "Hard"
}

const DATA_DIR = path.resolve(__dirname, "../../")

function getDataFile(mode: DifficultyMode): string {
  const suffix = mode === 0 ? "-easy" : mode === 2 ? "-hard" : ""
  return path.join(DATA_DIR, `champion-data${suffix}.json`)
}

const DEFAULT_SLOT: ChampionSlotData = {
  name: "Fish",
  avatar: "0129/Normal",
  board: [["MAGIKARP", 4, 2]],
  items: [[]],
  statBoosts: [{ hp: 0, atk: 0, def: 0, speDef: 0, ap: 0, speed: 0 }],
  inventory: [],
  bonusHP: 0,
  bonusAtk: 0,
  bonusAP: 0
}

function getDefaultData(): ChampionFileData {
  return {
    champion: { ...DEFAULT_SLOT },
    eliteFour: [
      { ...DEFAULT_SLOT },
      { ...DEFAULT_SLOT },
      { ...DEFAULT_SLOT },
      { ...DEFAULT_SLOT }
    ]
  }
}

export function resetChampionData(mode?: DifficultyMode): void {
  try {
    if (mode !== undefined) {
      const file = getDataFile(mode)
      if (fs.existsSync(file)) fs.unlinkSync(file)
      console.log(`Champion/E4 data reset to default Fish for ${DIFFICULTY_LABELS[mode]} mode.`)
    } else {
      for (const m of [0, 1, 2] as DifficultyMode[]) {
        const file = getDataFile(m)
        if (fs.existsSync(file)) fs.unlinkSync(file)
      }
      console.log("Champion/E4 data reset to default Fish for all difficulties.")
    }
  } catch (e) {
    console.error("Failed to reset champion data:", e)
  }
}

export function loadChampionData(mode: DifficultyMode = 1): ChampionFileData {
  try {
    const file = getDataFile(mode)
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf-8")
      return JSON.parse(raw) as ChampionFileData
    }
  } catch (e) {
    console.error("Failed to load champion data, using defaults:", e)
  }
  return getDefaultData()
}

export function saveChampionData(data: ChampionFileData, mode: DifficultyMode = 1): void {
  try {
    fs.writeFileSync(getDataFile(mode), JSON.stringify(data, null, 2), "utf-8")
  } catch (e) {
    console.error("Failed to save champion data:", e)
  }
}

export function promoteNewChampion(
  winnerName: string,
  winnerAvatar: string,
  winnerBoard: [pkm: string, x: number, y: number][],
  winnerItems: string[][],
  winnerStatBoosts: PokemonStatBoosts[],
  winnerInventory: string[],
  mode: DifficultyMode = 1
): void {
  const data = loadChampionData(mode)
  const previousChampion = data.champion.name
  const e4Names = [data.eliteFour[0].name, data.eliteFour[1].name, data.eliteFour[2].name, data.eliteFour[3].name]
  const diffLabel = DIFFICULTY_LABELS[mode]

  // Cascade: E4[0] → gone, E4[1] → E4[0], E4[2] → E4[1], E4[3] → E4[2], champion → E4[3]
  data.eliteFour[0] = { ...data.eliteFour[1] }
  data.eliteFour[1] = { ...data.eliteFour[2] }
  data.eliteFour[2] = { ...data.eliteFour[3] }
  data.eliteFour[3] = {
    name: data.champion.name,
    avatar: data.champion.avatar,
    board: data.champion.board,
    items: data.champion.items,
    statBoosts: data.champion.statBoosts,
    inventory: data.champion.inventory,
    bonusHP: 0,
    bonusAtk: 0,
    bonusAP: 0
  }

  data.champion = {
    name: winnerName,
    avatar: winnerAvatar,
    board: winnerBoard,
    items: winnerItems,
    statBoosts: winnerStatBoosts,
    inventory: winnerInventory,
    bonusHP: 0,
    bonusAtk: 0,
    bonusAP: 0
  }

  saveChampionData(data, mode)

  const teamList = winnerBoard.map(([pkm], i) => {
    const items = winnerItems[i] && winnerItems[i].length > 0
      ? ` [${winnerItems[i].join(", ")}]`
      : ""
    return `    ${pkm}${items}`
  }).join("\n")

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              ★ NEW CHAMPION CROWNED (${diffLabel}) ★
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ${winnerName} defeated Champion ${previousChampion}!
║                                                              ║
║  ── Champion ${winnerName}'s Team ──
${teamList}
║                                                              ║
║  ── League Shuffle (${diffLabel}) ──
║  ${previousChampion} (Champion) → Elite Four #4
║  ${e4Names[3]} (E4 #4) → Elite Four #3
║  ${e4Names[2]} (E4 #3) → Elite Four #2
║  ${e4Names[1]} (E4 #2) → Elite Four #1
║  ${e4Names[0]} (E4 #1) has been removed from the Elite Four.
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`)
}

export function getChampionSlotAsEncounter(slot: ChampionSlotData) {
  return {
    name: `Champion ${slot.name}`,
    avatar: (slot.board[0]?.[0] ?? "MAGIKARP") as Pkm,
    board: slot.board.map(([pkm, x, y]) => [pkm as Pkm, x, y] as [Pkm, number, number]),
    items: slot.items.map(itemList => itemList.map(i => i as Item)),
    bonusHP: slot.bonusHP,
    bonusAtk: slot.bonusAtk,
    bonusAP: slot.bonusAP
  }
}

export function getEliteFourSlotAsEncounter(slot: ChampionSlotData, e4Index: number) {
  return {
    name: `E4 ${slot.name}`,
    avatar: (slot.board[0]?.[0] ?? "MAGIKARP") as Pkm,
    board: slot.board.map(([pkm, x, y]) => [pkm as Pkm, x, y] as [Pkm, number, number]),
    items: slot.items.map(itemList => itemList.map(i => i as Item)),
    bonusHP: slot.bonusHP,
    bonusAtk: slot.bonusAtk,
    bonusAP: slot.bonusAP
  }
}
