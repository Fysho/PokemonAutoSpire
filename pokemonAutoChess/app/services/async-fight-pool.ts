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
