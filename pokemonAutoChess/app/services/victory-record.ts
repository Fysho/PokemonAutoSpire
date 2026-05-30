import { VictoryRecord } from "../models/mongo-models/victory-record"
import UserMetadata from "../models/mongo-models/user-metadata"
import { logger } from "../utils/logger"

// Admin panic button: reset every player name to "Player" across both the
// account profiles and the victory leaderboard. In-place update only — does
// not delete or reseed records. Triggered by the Discord /wipeplayernames command.
export async function wipeAllPlayerNames(): Promise<{ users: number; records: number }> {
  const userRes = await UserMetadata.updateMany({}, { $set: { displayName: "Player" } })
  const recordRes = await VictoryRecord.updateMany({}, { $set: { name: "Player" } })
  return {
    users: userRes.modifiedCount ?? 0,
    records: recordRes.modifiedCount ?? 0
  }
}

export async function recordVictory(
  odToken: string,
  name: string,
  avatar: string,
  difficulty: number
): Promise<void> {
  try {
    const doc = await VictoryRecord.findOneAndUpdate(
      { odToken, difficulty },
      {
        $inc: { totalVictories: 1, currentStreak: 1 },
        $set: { name, avatar }
      },
      { upsert: true, new: true }
    )
    if (doc && doc.currentStreak > doc.longestStreak) {
      doc.longestStreak = doc.currentStreak
      await doc.save()
    }
  } catch (e) {
    logger.error("Failed to record victory:", e)
  }
}

export async function recordLoss(
  odToken: string,
  name: string,
  avatar: string,
  difficulty: number
): Promise<void> {
  try {
    const doc = await VictoryRecord.findOne({ odToken, difficulty })
    if (!doc) return
    if (doc.currentStreak > doc.longestStreak) {
      doc.longestStreak = doc.currentStreak
    }
    doc.currentStreak = 0
    doc.name = name
    doc.avatar = avatar
    await doc.save()
  } catch (e) {
    logger.error("Failed to record loss:", e)
  }
}

export async function getVictoryLeaderboard(difficulty: number): Promise<{
  totalVictories: { name: string; avatar: string; value: number }[]
  longestStreak: { name: string; avatar: string; value: number }[]
}> {
  try {
    const [byVictories, byStreak] = await Promise.all([
      VictoryRecord.find({ difficulty, totalVictories: { $gt: 0 } })
        .sort({ totalVictories: -1 })
        .limit(10)
        .lean(),
      VictoryRecord.find({ difficulty, longestStreak: { $gt: 0 } })
        .sort({ longestStreak: -1 })
        .limit(10)
        .lean()
    ])
    return {
      totalVictories: byVictories.map((r) => ({ name: r.name, avatar: r.avatar, value: r.totalVictories })),
      longestStreak: byStreak.map((r) => ({ name: r.name, avatar: r.avatar, value: r.longestStreak }))
    }
  } catch (e) {
    logger.error("Failed to get victory leaderboard:", e)
    return { totalVictories: [], longestStreak: [] }
  }
}
