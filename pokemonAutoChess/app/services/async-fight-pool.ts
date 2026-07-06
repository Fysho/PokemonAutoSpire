import { AsyncFightPool, IAsyncFightEntry } from "../models/mongo-models/async-fight-pool"
import { TeamSnapshot } from "./team-snapshot"
import { Pkm } from "../types/enum/Pokemon"
import { logger } from "../utils/logger"

const MAX_ENTRIES_PER_STAGE = 100
const ASYNC_FLOORS = [5, 10, 15, 20]

export interface AsyncFightOpponent {
  playerName: string
  avatar: string
  region: string
  snapshot: TeamSnapshot
}

export async function submitAsyncFight(
  stage: string,
  playerName: string,
  avatar: string,
  region: string,
  snapshot: TeamSnapshot
): Promise<void> {
  try {
    await AsyncFightPool.findOneAndUpdate(
      { stage },
      {
        $push: {
          entries: {
            $each: [{ playerName, avatar, region, snapshot, submittedAt: new Date() }],
            $slice: -MAX_ENTRIES_PER_STAGE
          }
        }
      },
      { upsert: true }
    )
  } catch (e) {
    logger.error("Failed to submit async fight:", e)
  }
}

export async function getAsyncFightOpponents(
  stage: string,
  count: number = 4
): Promise<AsyncFightOpponent[]> {
  try {
    const doc = await AsyncFightPool.findOne({ stage }).lean()
    if (doc && doc.entries.length > 0) {
      const shuffled = [...doc.entries].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, count).map(entryToOpponent)
    }
    const fallback = await findFallbackOpponents(stage, count)
    if (fallback.length > 0) return fallback
  } catch (e) {
    logger.error("Failed to get async fight opponents:", e)
  }
  return Array.from({ length: count }, () => buildFallbackMagikarpOpponent())
}

// Lists every ENDLESS stage that currently has at least one saved team, with its
// entry count. Used by the Elite Designer test feature (stage picker) — empty
// stages are omitted so the designer only offers stages it can actually fight
// against. The regex keeps the classic difficulty-testing archives
// ("classic-<difficulty>-actN-floorM" keys, same collection) out of the picker.
export async function getPopulatedAsyncStages(): Promise<
  { stage: string; count: number }[]
> {
  try {
    const docs = await AsyncFightPool.aggregate([
      {
        $project: {
          _id: 0,
          stage: 1,
          count: { $size: { $ifNull: ["$entries", []] } }
        }
      },
      { $match: { count: { $gt: 0 }, stage: { $regex: /^act\d+-floor\d+$/ } } }
    ])
    return (docs as { stage: string; count: number }[]).sort((a, b) =>
      compareStages(a.stage, b.stage)
    )
  } catch (e) {
    logger.error("Failed to get populated async stages:", e)
    return []
  }
}

// Returns one random saved team for an exact stage, with NO fallback to previous
// stages or the Magikarp default. The Elite Designer test refuses to fight when a
// stage is empty (so you only test against real player teams), unlike the live
// async-fight path which always produces an opponent.
export async function getRandomAsyncOpponentNoFallback(
  stage: string
): Promise<AsyncFightOpponent | null> {
  try {
    const doc = await AsyncFightPool.findOne({ stage }).lean()
    if (doc && doc.entries.length > 0) {
      const entry =
        doc.entries[Math.floor(Math.random() * doc.entries.length)]
      return entryToOpponent(entry)
    }
  } catch (e) {
    logger.error("Failed to get random async opponent:", e)
  }
  return null
}

// Returns EVERY saved team for an exact stage (no fallback, no Magikarp default).
// Used by the elite-design success-rate measurement, which fights a design against
// the entire pool of a bracketing stage.
export async function getAllAsyncOpponentsForStage(
  stage: string
): Promise<AsyncFightOpponent[]> {
  try {
    const doc = await AsyncFightPool.findOne({ stage }).lean()
    if (doc && doc.entries.length > 0) {
      return doc.entries.map(entryToOpponent)
    }
  } catch (e) {
    logger.error("Failed to get all async opponents:", e)
  }
  return []
}

// Sorts stage keys ("act{N}-floor{M}") by act, then floor.
function compareStages(a: string, b: string): number {
  const pa = a.match(/^act(\d+)-floor(\d+)$/)
  const pb = b.match(/^act(\d+)-floor(\d+)$/)
  if (!pa || !pb) return a.localeCompare(b)
  const actDiff = parseInt(pa[1]) - parseInt(pb[1])
  return actDiff !== 0 ? actDiff : parseInt(pa[2]) - parseInt(pb[2])
}

async function findFallbackOpponents(
  stage: string,
  count: number
): Promise<AsyncFightOpponent[]> {
  const prev = getPreviousAsyncStage(stage)
  if (!prev) return []
  const doc = await AsyncFightPool.findOne({ stage: prev }).lean()
  if (doc && doc.entries.length > 0) {
    const shuffled = [...doc.entries].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count).map(entryToOpponent)
  }
  return findFallbackOpponents(prev, count)
}

function getPreviousAsyncStage(stage: string): string | null {
  const match = stage.match(/^act(\d+)-floor(\d+)$/)
  if (!match) return null
  const act = parseInt(match[1])
  const floor = parseInt(match[2])
  const idx = ASYNC_FLOORS.indexOf(floor)
  if (idx > 0) return `act${act}-floor${ASYNC_FLOORS[idx - 1]}`
  if (act > 1) return `act${act - 1}-floor${ASYNC_FLOORS[ASYNC_FLOORS.length - 1]}`
  return null
}

function entryToOpponent(entry: IAsyncFightEntry): AsyncFightOpponent {
  return {
    playerName: entry.playerName,
    avatar: entry.avatar,
    region: entry.region || "town",
    snapshot: entry.snapshot as TeamSnapshot
  }
}

function buildFallbackMagikarpOpponent(): AsyncFightOpponent {
  return {
    playerName: "Fish",
    avatar: "0129/Normal",
    region: "town",
    snapshot: {
      name: "Fish",
      avatar: "0129/Normal",
      pokemon: [
        {
          name: Pkm.MAGIKARP,
          x: 4,
          y: 1,
          items: []
        }
      ],
      inventory: [],
      groundHoles: [],
      lightX: -1,
      lightY: -1
    }
  }
}
