import { Schema, type } from "@colyseus/schema"
import type { Item } from "../../types/enum/Item"
import type { PkmProposition } from "../../types/enum/Pokemon"

export type PlayerChoiceType =
  | "item"
  | "addPick"
  | "starter"
  | "unique"
  | "legendary"
  | "mission_order"
  | "wand"
  | "wildReward"
  | "wildRewardRerolled"
  | "gymReward"
  | "eliteReward"
  | "unlockReward"
  // Spire STS-style rewards screen — "instant" claimable rows (no sub-picker):
  | "gold"
  | "heal"
  | "xp"
  // Claim a single item straight to the bag (items[0]); used for Spire post-fight
  // ticket/berry drops.
  | "itemGrant"

export class PlayerChoice extends Schema {
  @type("string") id: string
  @type("string") type: PlayerChoiceType
  @type(["string"]) items: Item[] = []
  @type(["string"]) pokemons: PkmProposition[] = []
  // Per-option relic reward (Spire mode). relics[i] is the Relic id granted by
  // picking option i, or "" for options that grant a pokemon/item instead.
  @type(["string"]) relics: string[] = []
  // Numeric payload for instant reward rows (gold amount / HP healed / XP gained).
  @type("number") value: number = 0

  constructor(args: {
    type: PlayerChoiceType
    items?: Item[]
    pokemons?: PkmProposition[]
    relics?: string[]
    value?: number
  }) {
    super()
    this.id = crypto.randomUUID()
    this.type = args.type
    if (args.items) this.items = args.items
    if (args.pokemons) this.pokemons = args.pokemons
    if (args.relics) this.relics = args.relics
    if (args.value) this.value = args.value
  }
}
