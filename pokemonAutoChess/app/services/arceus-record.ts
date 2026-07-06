import * as fs from "fs"
import * as path from "path"
import { TeamSnapshot } from "./team-snapshot"
import { logger } from "../utils/logger"

export interface ArceusRecord {
  playerName: string
  damage: number
  team: TeamSnapshot
  date: string
}

export interface ArceusLeaderboard {
  records: ArceusRecord[]
}

export type DifficultyMode = 0 | 1 | 2 | 3

const MAX_RECORDS = 5

const DIFFICULTY_LABELS: Record<DifficultyMode, string> = {
  0: "Easy",
  1: "Normal",
  2: "Hard",
  3: "Impossible"
}

const DATA_DIR = path.resolve(__dirname, "../../")

function getDataFile(mode: DifficultyMode): string {
  const suffix = mode === 0 ? "-easy" : mode === 2 ? "-hard" : mode === 3 ? "-impossible" : ""
  return path.join(DATA_DIR, `arceus-record${suffix}.json`)
}

function migrateIfNeeded(raw: any): ArceusLeaderboard {
  if (Array.isArray(raw?.records)) return raw as ArceusLeaderboard
  if (raw?.playerName && raw?.damage) {
    return { records: [raw as ArceusRecord] }
  }
  return { records: [] }
}

export function resetArceusLeaderboard(mode?: DifficultyMode): void {
  try {
    if (mode !== undefined) {
      const file = getDataFile(mode)
      if (fs.existsSync(file)) fs.unlinkSync(file)
    } else {
      for (const m of [0, 1, 2, 3] as DifficultyMode[]) {
        const file = getDataFile(m)
        if (fs.existsSync(file)) fs.unlinkSync(file)
      }
    }
    logger.info(`Arceus leaderboard reset${mode !== undefined ? ` for ${DIFFICULTY_LABELS[mode]}` : " for all difficulties"}`)
  } catch (e) {
    logger.error("Failed to reset Arceus leaderboard:", e)
  }
}

export function loadArceusLeaderboard(mode: DifficultyMode = 1): ArceusLeaderboard {
  try {
    const file = getDataFile(mode)
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf-8"))
      return migrateIfNeeded(raw)
    }
  } catch (e) {
    logger.error("Failed to load Arceus leaderboard:", e)
  }
  return { records: [] }
}

function saveArceusLeaderboard(lb: ArceusLeaderboard, mode: DifficultyMode = 1): void {
  try {
    fs.writeFileSync(getDataFile(mode), JSON.stringify(lb, null, 2), "utf-8")
  } catch (e) {
    logger.error("Failed to save Arceus leaderboard:", e)
  }
}

export function checkAndUpdateArceusRecord(
  playerName: string,
  damage: number,
  team: TeamSnapshot,
  mode: DifficultyMode = 1
): { isNewRecord: boolean; rank: number; previousRecord: ArceusRecord | null } {
  const lb = loadArceusLeaderboard(mode)
  const previousTopRecord = lb.records.length > 0 ? lb.records[0] : null

  const rank = lb.records.filter((r) => r.damage >= damage).length
  if (rank >= MAX_RECORDS) {
    return { isNewRecord: false, rank: -1, previousRecord: previousTopRecord }
  }

  const entry: ArceusRecord = {
    playerName,
    damage,
    team,
    date: new Date().toISOString()
  }

  lb.records.push(entry)
  lb.records.sort((a, b) => b.damage - a.damage)
  lb.records = lb.records.slice(0, MAX_RECORDS)

  saveArceusLeaderboard(lb, mode)

  const isNewRecord = rank === 0
  const diffLabel = DIFFICULTY_LABELS[mode]
  const prevInfo = previousTopRecord
    ? `Previous #1: ${previousTopRecord.damage.toLocaleString()} by ${previousTopRecord.playerName}`
    : "First record set!"

  logger.info(
    `Arceus leaderboard update (${diffLabel})! #${rank + 1} ${playerName}: ${damage.toLocaleString()} | ${prevInfo}`
  )

  return { isNewRecord, rank: rank, previousRecord: previousTopRecord }
}

// Admin tool: remove a single record by its index (rank) in the top-5 list.
export function removeArceusRecord(index: number, mode: DifficultyMode = 1): boolean {
  const lb = loadArceusLeaderboard(mode)
  if (index < 0 || index >= lb.records.length) return false
  lb.records.splice(index, 1)
  saveArceusLeaderboard(lb, mode)
  logger.info(`Admin removed Arceus record #${index + 1} (${DIFFICULTY_LABELS[mode]})`)
  return true
}

export function getArceusLeaderboardForClient(mode: DifficultyMode = 1): {
  name: string
  avatar: string
  damage: number
  pokemon: { name: string; items: string[] }[]
  inventory: string[]
}[] {
  const lb = loadArceusLeaderboard(mode)
  return lb.records.map((r) => ({
    name: r.playerName,
    avatar: r.team.avatar,
    damage: r.damage,
    pokemon: r.team.pokemon
      .filter((p) => p.y > 0)
      .map((p) => ({ name: p.name, items: [...p.items] })),
    inventory: r.team.inventory ? [...r.team.inventory] : []
  }))
}
