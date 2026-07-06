import UserMetadata from "../models/mongo-models/user-metadata"
import { Role } from "../types"
import { logger } from "../utils/logger"
import {
  DifficultyMode,
  resetChampionData,
  removeChampionLadderEntry
} from "./champion-data"
import {
  resetArceusLeaderboard,
  removeArceusRecord
} from "./arceus-record"
import {
  resetEndlessLeaderboard,
  removeEndlessRecord
} from "./endless-record"
import {
  resetVictoryRecords,
  removeVictoryRecord
} from "./victory-record"

// The four Spire roguelike boards an admin can manage from the lobby.
export type SpireBoard = "champion" | "arceus" | "endless" | "victory"

export type AdminResult = { ok: true } | { ok: false; error: string }

async function isAdmin(uid: string): Promise<boolean> {
  if (!uid) return false
  const user = await UserMetadata.findOne({ uid }, { role: 1 }).lean()
  return user?.role === Role.ADMIN
}

function isDifficultyMode(value: unknown): value is DifficultyMode {
  return value === 0 || value === 1 || value === 2 || value === 3
}

// Wipe a whole board for ONE difficulty (Endless has no per-difficulty split,
// so it ignores the difficulty and wipes its single file).
export async function wipeLeaderboard(
  uid: string,
  board: SpireBoard,
  difficulty?: number
): Promise<AdminResult> {
  if (!(await isAdmin(uid))) return { ok: false, error: "forbidden" }
  try {
    switch (board) {
      case "champion":
        if (!isDifficultyMode(difficulty)) return { ok: false, error: "bad_difficulty" }
        resetChampionData(difficulty)
        return { ok: true }
      case "arceus":
        if (!isDifficultyMode(difficulty)) return { ok: false, error: "bad_difficulty" }
        resetArceusLeaderboard(difficulty)
        return { ok: true }
      case "endless":
        resetEndlessLeaderboard()
        return { ok: true }
      case "victory":
        if (!isDifficultyMode(difficulty)) return { ok: false, error: "bad_difficulty" }
        await resetVictoryRecords(difficulty)
        return { ok: true }
      default:
        return { ok: false, error: "bad_board" }
    }
  } catch (e) {
    logger.error("Failed to wipe leaderboard:", e)
    return { ok: false, error: "internal" }
  }
}

// Remove a single entry from a board. The required identifier depends on the
// board: champion → slot ("champion" | 0..3) + difficulty; arceus → index +
// difficulty; endless → index; victory → odToken + difficulty.
export async function removeLeaderboardEntry(
  uid: string,
  board: SpireBoard,
  opts: { difficulty?: number; slot?: "champion" | number; index?: number; odToken?: string }
): Promise<AdminResult> {
  if (!(await isAdmin(uid))) return { ok: false, error: "forbidden" }
  try {
    switch (board) {
      case "champion": {
        if (!isDifficultyMode(opts.difficulty)) return { ok: false, error: "bad_difficulty" }
        const slot = opts.slot
        const valid = slot === "champion" || slot === 0 || slot === 1 || slot === 2 || slot === 3
        if (!valid) return { ok: false, error: "bad_slot" }
        removeChampionLadderEntry(slot as "champion" | 0 | 1 | 2 | 3, opts.difficulty)
        return { ok: true }
      }
      case "arceus": {
        if (!isDifficultyMode(opts.difficulty)) return { ok: false, error: "bad_difficulty" }
        if (typeof opts.index !== "number") return { ok: false, error: "bad_index" }
        return removeArceusRecord(opts.index, opts.difficulty)
          ? { ok: true }
          : { ok: false, error: "not_found" }
      }
      case "endless": {
        if (typeof opts.index !== "number") return { ok: false, error: "bad_index" }
        return removeEndlessRecord(opts.index)
          ? { ok: true }
          : { ok: false, error: "not_found" }
      }
      case "victory": {
        if (!isDifficultyMode(opts.difficulty)) return { ok: false, error: "bad_difficulty" }
        if (typeof opts.odToken !== "string" || !opts.odToken) {
          return { ok: false, error: "bad_odtoken" }
        }
        return (await removeVictoryRecord(opts.odToken, opts.difficulty))
          ? { ok: true }
          : { ok: false, error: "not_found" }
      }
      default:
        return { ok: false, error: "bad_board" }
    }
  } catch (e) {
    logger.error("Failed to remove leaderboard entry:", e)
    return { ok: false, error: "internal" }
  }
}

// Admin-gated read of victory records (with odToken) for the manager UI.
export async function listVictoryRecordsAsAdmin(
  uid: string,
  difficulty: number
): Promise<AdminResult & { records?: unknown[] }> {
  if (!(await isAdmin(uid))) return { ok: false, error: "forbidden" }
  if (!isDifficultyMode(difficulty)) return { ok: false, error: "bad_difficulty" }
  const { getVictoryRecordsForAdmin } = await import("./victory-record")
  return { ok: true, records: await getVictoryRecordsForAdmin(difficulty) }
}
