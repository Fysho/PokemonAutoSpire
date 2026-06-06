import { model, Schema } from "mongoose"

export interface IRunHistoryPokemon {
  name: string
  avatar: string
  items: string[]
}

export interface IRunHistorySynergy {
  type: string
  count: number
}

export interface IRunHistory {
  odToken: string
  // Stable per-run UUID (mirrors SavedRun.runId / state.runId). One run = one
  // history document: it's created when the run first ends/peaks and UPSERTED on
  // every later milestone (Act 3 win → Elite Four → Champion → Arceus), so a
  // single run can never appear twice. Optional only for legacy records written
  // before this field existed.
  runId?: string
  time: number
  currentAct: number
  currentFloor: number
  difficultyMode: number
  runHP: number
  arceusDamageDealt: number
  victory: boolean
  pokemons: IRunHistoryPokemon[]
  synergies?: IRunHistorySynergy[]
}

const runHistorySchema = new Schema<IRunHistory>(
  {
    odToken: { type: String, required: true, index: true },
    runId: { type: String, default: "", index: true },
    time: { type: Number, required: true },
    currentAct: { type: Number, required: true },
    currentFloor: { type: Number, required: true },
    difficultyMode: { type: Number, required: true },
    runHP: { type: Number, required: true },
    arceusDamageDealt: { type: Number, default: 0 },
    victory: { type: Boolean, default: false },
    pokemons: [{
      name: { type: String, required: true },
      avatar: { type: String, required: true },
      items: [{ type: String }]
    }],
    synergies: [{
      type: { type: String, required: true },
      count: { type: Number, required: true }
    }]
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

export const RunHistory = model<IRunHistory>("RunHistory", runHistorySchema)
