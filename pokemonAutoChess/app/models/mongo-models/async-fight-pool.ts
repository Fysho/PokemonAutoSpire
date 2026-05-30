import { model, Schema } from "mongoose"

export interface IAsyncFightEntry {
  playerName: string
  avatar: string
  region: string
  snapshot: Record<string, any>
  submittedAt: Date
}

export interface IAsyncFightPool {
  stage: string
  entries: IAsyncFightEntry[]
}

const asyncFightEntrySchema = new Schema<IAsyncFightEntry>(
  {
    playerName: { type: String, required: true },
    avatar: { type: String, required: true },
    region: { type: String, default: "town" },
    snapshot: { type: Schema.Types.Mixed, required: true },
    submittedAt: { type: Date, default: Date.now }
  },
  { _id: false }
)

const asyncFightPoolSchema = new Schema<IAsyncFightPool>(
  {
    stage: { type: String, required: true, unique: true, index: true },
    entries: [asyncFightEntrySchema]
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

export const AsyncFightPool = model<IAsyncFightPool>("AsyncFightPool", asyncFightPoolSchema)
