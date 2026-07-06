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
      { upsert: true, returnDocument: "after" }
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

// Admin tool: list every victory record for a difficulty WITH its odToken so
// the leaderboard manager can target a specific player for removal. The public
// getVictoryLeaderboard() intentionally omits odToken. Names/avatars are
// overlaid from UserMetadata (single source of truth) just like the public one.
export async function getVictoryRecordsForAdmin(difficulty: number): Promise<{
  odToken: string
  name: string
  avatar: string
  totalVictories: number
  longestStreak: number
  currentStreak: number
}[]> {
  try {
    const docs = await VictoryRecord.find({ difficulty })
      .sort({ totalVictories: -1, longestStreak: -1 })
      .limit(200)
      .lean()
    const odTokens = [...new Set(docs.map((r) => r.odToken))]
    const accounts = await UserMetadata.find(
      { uid: { $in: odTokens } },
      { uid: 1, displayName: 1, avatar: 1, _id: 0 }
    ).lean()
    const accountMap = new Map<string, { displayName?: string; avatar?: string }>(
      accounts.map((a: any) => [a.uid, { displayName: a.displayName, avatar: a.avatar }])
    )
    return docs.map((r: any) => {
      const acc = accountMap.get(r.odToken)
      return {
        odToken: r.odToken,
        name: acc?.displayName ?? r.name,
        avatar: acc?.avatar ?? r.avatar,
        totalVictories: r.totalVictories ?? 0,
        longestStreak: r.longestStreak ?? 0,
        currentStreak: r.currentStreak ?? 0
      }
    })
  } catch (e) {
    logger.error("Failed to get victory records for admin:", e)
    return []
  }
}

// Admin tool: delete one player's victory record for a difficulty.
export async function removeVictoryRecord(
  odToken: string,
  difficulty: number
): Promise<boolean> {
  try {
    const res = await VictoryRecord.deleteOne({ odToken, difficulty })
    return (res.deletedCount ?? 0) > 0
  } catch (e) {
    logger.error("Failed to remove victory record:", e)
    return false
  }
}

// Admin tool: wipe every victory record for one difficulty.
export async function resetVictoryRecords(difficulty: number): Promise<number> {
  try {
    const res = await VictoryRecord.deleteMany({ difficulty })
    return res.deletedCount ?? 0
  } catch (e) {
    logger.error("Failed to reset victory records:", e)
    return 0
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
    // Overlay the current account name/avatar (single source of truth) so the
    // leaderboard reflects the player's latest name across all difficulties,
    // not the denormalized copy that was only updated for the difficulty played.
    const odTokens = [...new Set([...byVictories, ...byStreak].map((r) => r.odToken))]
    const accounts = await UserMetadata.find(
      { uid: { $in: odTokens } },
      { uid: 1, displayName: 1, avatar: 1, _id: 0 }
    ).lean()
    const accountMap = new Map<string, { displayName?: string; avatar?: string }>(
      accounts.map((a: any) => [a.uid, { displayName: a.displayName, avatar: a.avatar }])
    )
    const resolve = (r: any) => {
      const acc = accountMap.get(r.odToken)
      return {
        name: acc?.displayName ?? r.name,
        avatar: acc?.avatar ?? r.avatar
      }
    }
    return {
      totalVictories: byVictories.map((r) => ({ ...resolve(r), value: r.totalVictories })),
      longestStreak: byStreak.map((r) => ({ ...resolve(r), value: r.longestStreak }))
    }
  } catch (e) {
    logger.error("Failed to get victory leaderboard:", e)
    return { totalVictories: [], longestStreak: [] }
  }
}
