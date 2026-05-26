import * as fs from "fs"
import * as path from "path"
import { Emotion } from "../types"
import { Item } from "../types/enum/Item"
import { Pkm } from "../types/enum/Pokemon"
import {
  TeamSnapshot,
  SnapshotPokemon,
  encodeSnapshotForClient
} from "./team-snapshot"

export interface ChampionFileData {
  champion: TeamSnapshot
  eliteFour: [TeamSnapshot, TeamSnapshot, TeamSnapshot, TeamSnapshot]
}

// Legacy format for migration
interface LegacyChampionSlotData {
  name: string
  avatar: string
  board: [pkm: string, x: number, y: number][]
  items: string[][]
  statBoosts: { hp: number; atk: number; def: number; speDef: number; ap: number; speed: number }[]
  inventory: string[]
  bonusHP: number
  bonusAtk: number
  bonusAP: number
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

const DEFAULT_SNAPSHOT: TeamSnapshot = {
  name: "Fish",
  avatar: "0129/Normal",
  pokemon: [
    { name: "MAGIKARP" as Pkm, x: 4, y: 2, items: [] }
  ],
  inventory: [],
  groundHoles: [],
  lightX: 3,
  lightY: 2
}

function getDefaultData(): ChampionFileData {
  return {
    champion: { ...DEFAULT_SNAPSHOT, pokemon: [...DEFAULT_SNAPSHOT.pokemon] },
    eliteFour: [
      { ...DEFAULT_SNAPSHOT, pokemon: [...DEFAULT_SNAPSHOT.pokemon] },
      { ...DEFAULT_SNAPSHOT, pokemon: [...DEFAULT_SNAPSHOT.pokemon] },
      { ...DEFAULT_SNAPSHOT, pokemon: [...DEFAULT_SNAPSHOT.pokemon] },
      { ...DEFAULT_SNAPSHOT, pokemon: [...DEFAULT_SNAPSHOT.pokemon] }
    ]
  }
}

function migrateLegacySlot(slot: LegacyChampionSlotData): TeamSnapshot {
  const pokemon: SnapshotPokemon[] = slot.board.map(([pkm, x, y], i) => {
    const snap: SnapshotPokemon = {
      name: pkm as Pkm,
      x,
      y,
      items: (slot.items[i] || []) as Item[]
    }
    const b = slot.statBoosts?.[i]
    if (b && (b.hp || b.atk || b.def || b.speDef || b.ap || b.speed)) {
      snap.statBoosts = b
    }
    return snap
  })

  return {
    name: slot.name,
    avatar: slot.avatar,
    pokemon,
    inventory: (slot.inventory || []) as Item[],
    groundHoles: [],
    lightX: 3,
    lightY: 2
  }
}

function isLegacyFormat(data: any): boolean {
  const slot = data?.champion
  if (!slot) return false
  return Array.isArray(slot.board) && slot.board.length > 0 && Array.isArray(slot.board[0])
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
      const data = JSON.parse(raw)

      if (isLegacyFormat(data)) {
        const migrated: ChampionFileData = {
          champion: migrateLegacySlot(data.champion),
          eliteFour: [
            migrateLegacySlot(data.eliteFour[0]),
            migrateLegacySlot(data.eliteFour[1]),
            migrateLegacySlot(data.eliteFour[2]),
            migrateLegacySlot(data.eliteFour[3])
          ]
        }
        saveChampionData(migrated, mode)
        return migrated
      }

      return data as ChampionFileData
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
  winnerSnapshot: TeamSnapshot,
  mode: DifficultyMode = 1
): void {
  const data = loadChampionData(mode)
  const previousChampion = data.champion.name
  const e4Names = data.eliteFour.map((e) => e.name)
  const diffLabel = DIFFICULTY_LABELS[mode]

  data.eliteFour[0] = { ...data.eliteFour[1] }
  data.eliteFour[1] = { ...data.eliteFour[2] }
  data.eliteFour[2] = { ...data.eliteFour[3] }
  data.eliteFour[3] = { ...data.champion }
  data.champion = winnerSnapshot

  saveChampionData(data, mode)

  const teamList = winnerSnapshot.pokemon
    .filter((p) => p.y > 0)
    .map((p) => {
      const items = p.items.length > 0 ? ` [${p.items.join(", ")}]` : ""
      return `    ${p.name}${items}`
    })
    .join("\n")

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              ★ NEW CHAMPION CROWNED (${diffLabel}) ★
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ${winnerSnapshot.name} defeated Champion ${previousChampion}!
║                                                              ║
║  ── Champion ${winnerSnapshot.name}'s Team ──
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

export function getChampionSlotForEncounter(slot: TeamSnapshot) {
  return {
    name: `Champion ${slot.name}`,
    avatar: (slot.pokemon[0]?.name ?? "MAGIKARP") as Pkm,
    encodedBoard: encodeSnapshotForClient(slot),
    snapshot: slot
  }
}

export function getEliteFourSlotForEncounter(slot: TeamSnapshot, e4Index: number) {
  return {
    name: `E4 ${slot.name}`,
    avatar: (slot.pokemon[0]?.name ?? "MAGIKARP") as Pkm,
    encodedBoard: encodeSnapshotForClient(slot),
    snapshot: slot
  }
}
