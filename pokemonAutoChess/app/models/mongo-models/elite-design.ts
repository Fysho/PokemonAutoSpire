import { model, Schema } from "mongoose"

// A saved Elite Designer creation. One document per (creatorUid, name) — re-saving
// a design with the same name updates it in place. `designJson` is the compact
// export string from the Elite Designer (re-importable into the editor and parsed
// server-side by parseEliteDesignExport).
//
// `results` holds the latest success-rate measurement: one entry per classic
// difficulty and bracketing milestone pool. Each completed measurement uses
// exactly 100 fights at both bracket edges: 200 fights per difficulty.
// `sampleSize` + `testedAt` identify the exact snapshot.
export interface IEliteDesignResult {
  difficulty?: "easy" | "normal" | "hard" | "impossible"
  stage: string // async pool key, e.g. "act1-floor5"
  wins: number // elite design beat the player team
  draws: number // neither side dead at the time cap
  losses: number
  sampleSize: number
  testedAt: Date
}

export interface IEliteDesign {
  kind: "elite" | "boss"
  name: string
  act: number
  stageRange: string // elite bracket (e.g. "6-10") or "boss"
  icon: string // Pkm of the design's map avatar
  designJson: string
  creatorUid: string
  creatorName: string
  approved: boolean // future hook: admin-promoted into the live elite pool
  createdAt: Date
  results: IEliteDesignResult[]
}

const eliteDesignResultSchema = new Schema<IEliteDesignResult>(
  {
    // Optional only for backward compatibility with pre-classic Endless result
    // rows. Every newly written measurement supplies a difficulty.
    difficulty: {
      type: String,
      enum: ["easy", "normal", "hard", "impossible"]
    },
    stage: { type: String, required: true },
    wins: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    sampleSize: { type: Number, default: 0 },
    testedAt: { type: Date, default: Date.now }
  },
  { _id: false }
)

const eliteDesignSchema = new Schema<IEliteDesign>(
  {
    kind: { type: String, enum: ["elite", "boss"], default: "elite" },
    name: { type: String, required: true },
    act: { type: Number, required: true },
    stageRange: { type: String, required: true },
    icon: { type: String, default: "" },
    designJson: { type: String, required: true },
    creatorUid: { type: String, required: true },
    creatorName: { type: String, default: "Player" },
    approved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    results: [eliteDesignResultSchema]
  },
  {
    toJSON: {
      transform: function (_doc, ret: any) {
        ret.id = ret._id?.toString()
        delete ret._id
        delete ret.__v
      }
    }
  }
)

eliteDesignSchema.index({ creatorUid: 1, name: 1 }, { unique: true })

export const EliteDesign = model<IEliteDesign>("EliteDesign", eliteDesignSchema)
