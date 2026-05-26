import { model, Schema } from "mongoose"

export interface ISavedRunSummary {
  odToken: string
  savedAt: Date
  currentAct: number
  currentFloor: number
  difficultyMode: number
  runHP: number
  teamPreview: string[]
}

export interface ISavedRun extends ISavedRunSummary {
  data: Record<string, any>
}

const savedRunSchema = new Schema<ISavedRun>(
  {
    odToken: { type: String, required: true, unique: true, index: true },
    savedAt: { type: Date, default: Date.now },
    currentAct: { type: Number, required: true },
    currentFloor: { type: Number, required: true },
    difficultyMode: { type: Number, required: true },
    runHP: { type: Number, required: true },
    teamPreview: [{ type: String }],
    data: { type: Schema.Types.Mixed, required: true }
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

export const SavedRun = model<ISavedRun>("SavedRun", savedRunSchema)
