import { model, Schema } from "mongoose"

export interface IVictoryRecord {
  odToken: string
  name: string
  avatar: string
  difficulty: number
  totalVictories: number
  currentStreak: number
  longestStreak: number
}

const victoryRecordSchema = new Schema<IVictoryRecord>(
  {
    odToken: { type: String, required: true },
    name: { type: String, required: true },
    avatar: { type: String, required: true },
    difficulty: { type: Number, required: true },
    totalVictories: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 }
  },
  {
    toJSON: {
      transform: function (_doc, ret: any) {
        delete ret._id
        delete ret.__v
      }
    }
  }
)

victoryRecordSchema.index({ odToken: 1, difficulty: 1 }, { unique: true })
victoryRecordSchema.index({ difficulty: 1, totalVictories: -1 })
victoryRecordSchema.index({ difficulty: 1, longestStreak: -1 })

export const VictoryRecord = model<IVictoryRecord>("VictoryRecord", victoryRecordSchema)
