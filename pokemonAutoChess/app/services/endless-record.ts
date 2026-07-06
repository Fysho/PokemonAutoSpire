import * as fs from "fs"
import * as path from "path"
import { TeamSnapshot } from "./team-snapshot"
import { logger } from "../utils/logger"

export interface EndlessRecord {
  playerName: string
  avatar: string
  act: number
  floor: number
  team: TeamSnapshot
  date: string
}

export interface EndlessLeaderboard {
  records: EndlessRecord[]
}

const MAX_RECORDS = 5
const DATA_DIR = path.resolve(__dirname, "../../")
const DATA_FILE = path.join(DATA_DIR, "endless-record.json")

export function loadEndlessLeaderboard(): EndlessLeaderboard {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"))
      if (Array.isArray(raw?.records)) return raw as EndlessLeaderboard
    }
  } catch (e) {
    logger.error("Failed to load endless leaderboard:", e)
  }
  return { records: [] }
}

function saveEndlessLeaderboard(lb: EndlessLeaderboard): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(lb, null, 2), "utf-8")
  } catch (e) {
    logger.error("Failed to save endless leaderboard:", e)
  }
}

function compareProgress(a: { act: number; floor: number }, b: { act: number; floor: number }): number {
  if (a.act !== b.act) return b.act - a.act
  return b.floor - a.floor
}

export function checkAndUpdateEndlessRecord(
  playerName: string,
  avatar: string,
  act: number,
  floor: number,
  team: TeamSnapshot
): { isNewRecord: boolean; rank: number } {
  const lb = loadEndlessLeaderboard()
  const rank = lb.records.filter((r) => compareProgress(r, { act, floor }) <= 0).length
  const totalProgress = act * 100 + floor
  const wouldRank = lb.records.filter((r) => (r.act * 100 + r.floor) >= totalProgress).length

  if (wouldRank >= MAX_RECORDS) {
    return { isNewRecord: false, rank: -1 }
  }

  const entry: EndlessRecord = {
    playerName,
    avatar,
    act,
    floor,
    team,
    date: new Date().toISOString()
  }

  lb.records.push(entry)
  lb.records.sort(compareProgress)
  lb.records = lb.records.slice(0, MAX_RECORDS)

  saveEndlessLeaderboard(lb)

  const finalRank = lb.records.findIndex(
    (r) => r.playerName === playerName && r.act === act && r.floor === floor && r.date === entry.date
  )

  logger.info(
    `Endless leaderboard update! #${finalRank + 1} ${playerName}: Act ${act} Floor ${floor}`
  )

  return { isNewRecord: finalRank === 0, rank: finalRank }
}

export function getEndlessLeaderboardForClient(): {
  name: string
  avatar: string
  act: number
  floor: number
  pokemon: { name: string; items: string[] }[]
}[] {
  const lb = loadEndlessLeaderboard()
  return lb.records.map((r) => ({
    name: r.playerName,
    avatar: r.avatar,
    act: r.act,
    floor: r.floor,
    pokemon: r.team.pokemon
      .filter((p) => p.y > 0)
      .map((p) => ({ name: p.name, items: [...p.items] }))
  }))
}

// Admin tool: remove a single record by its index (rank) in the top-5 list.
export function removeEndlessRecord(index: number): boolean {
  const lb = loadEndlessLeaderboard()
  if (index < 0 || index >= lb.records.length) return false
  lb.records.splice(index, 1)
  saveEndlessLeaderboard(lb)
  logger.info(`Admin removed endless record #${index + 1}`)
  return true
}

export function resetEndlessLeaderboard(): void {
  try {
    if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE)
    logger.info("Endless leaderboard reset")
  } catch (e) {
    logger.error("Failed to reset endless leaderboard:", e)
  }
}
