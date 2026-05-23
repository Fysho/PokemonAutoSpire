import { ArraySchema } from "@colyseus/schema"
import { Item } from "../types/enum/Item"
import { pickNRandomIn } from "../utils/random"

export const PASSIVE_ITEMS = [
  Item.SHELL_BELL,
  Item.LEFTOVERS,
  Item.SCOPE_LENS,
  Item.AMULET_COIN,
  Item.EXP_SHARE,
  Item.SMOKE_BALL,
  Item.WIDE_LENS,
  Item.MUSCLE_BAND,
  Item.CHARCOAL,
  Item.LUCKY_RIBBON,
  Item.MAX_REVIVE,
  Item.SWIFT_WING,
  Item.OLD_AMBER,
  Item.ASSAULT_VEST,
  Item.POKERUS_VIAL
] as const

export interface PassiveItemDefinition {
  id: Item
  name: string
  description: string
}

export const PASSIVE_ITEM_DEFINITIONS: Partial<Record<Item, PassiveItemDefinition>> = {
  [Item.LUCKY_RIBBON]: {
    id: Item.LUCKY_RIBBON,
    name: "Lucky Ribbon",
    description: "+3 bonus gold from battles"
  },
  [Item.AMULET_COIN]: {
    id: Item.AMULET_COIN,
    name: "Amulet Coin",
    description: "Shop rerolls cost 0 gold"
  },
  [Item.EXP_SHARE]: {
    id: Item.EXP_SHARE,
    name: "Exp Share",
    description: "Gain 4 free XP after each battle"
  },
  [Item.SHELL_BELL]: {
    id: Item.SHELL_BELL,
    name: "Shell Bell",
    description: "Heal 5 HP after winning a battle"
  },
  [Item.LEFTOVERS]: {
    id: Item.LEFTOVERS,
    name: "Leftovers",
    description: "Heal 3 HP after every battle"
  },
  [Item.MAX_REVIVE]: {
    id: Item.MAX_REVIVE,
    name: "Max Revive",
    description: "Pokemon Center heals 20 extra HP"
  },
  [Item.SMOKE_BALL]: {
    id: Item.SMOKE_BALL,
    name: "Smoke Ball",
    description: "Take 3 less damage when losing"
  },
  [Item.WIDE_LENS]: {
    id: Item.WIDE_LENS,
    name: "Wide Lens",
    description: "Get 4 Pokemon choices instead of 3"
  },
  [Item.MUSCLE_BAND]: {
    id: Item.MUSCLE_BAND,
    name: "Muscle Band",
    description: "Your team starts with +2 ATK"
  },
  [Item.CHARCOAL]: {
    id: Item.CHARCOAL,
    name: "Charcoal",
    description: "Your team starts with +10 AP"
  },
  [Item.ASSAULT_VEST]: {
    id: Item.ASSAULT_VEST,
    name: "Assault Vest",
    description: "Your team starts with +50 HP"
  },
  [Item.SWIFT_WING]: {
    id: Item.SWIFT_WING,
    name: "Swift Wing",
    description: "Your team starts with +10 Speed"
  },
  [Item.SCOPE_LENS]: {
    id: Item.SCOPE_LENS,
    name: "Scope Lens",
    description: "+10% crit chance for your team"
  },
  [Item.OLD_AMBER]: {
    id: Item.OLD_AMBER,
    name: "Old Amber",
    description: "Your team starts with +15 DEF/SPE_DEF"
  },
  [Item.POKERUS_VIAL]: {
    id: Item.POKERUS_VIAL,
    name: "Pokerus Vial",
    description: "Mystery encounters give double rewards"
  }
}

function hasItem(items: ArraySchema<string>, item: Item): boolean {
  return items.includes(item)
}

export function getRelicBonusGold(items: ArraySchema<string>): number {
  return hasItem(items, Item.LUCKY_RIBBON) ? 3 : 0
}

export function getRelicPostBattleHeal(items: ArraySchema<string>, won: boolean): number {
  let heal = 0
  if (hasItem(items, Item.SHELL_BELL) && won) heal += 5
  if (hasItem(items, Item.LEFTOVERS)) heal += 3
  return heal
}

export function getRelicDamageReduction(items: ArraySchema<string>): number {
  return hasItem(items, Item.SMOKE_BALL) ? 3 : 0
}

export function getRelicPokemonOfferCount(items: ArraySchema<string>): number {
  return hasItem(items, Item.WIDE_LENS) ? 4 : 3
}

export function getRelicBonusXP(items: ArraySchema<string>): number {
  return hasItem(items, Item.EXP_SHARE) ? 4 : 0
}

export function getRelicRestHealBonus(items: ArraySchema<string>): number {
  return hasItem(items, Item.MAX_REVIVE) ? 20 : 0
}

export function getRelicFreeReroll(items: ArraySchema<string>): boolean {
  return hasItem(items, Item.AMULET_COIN)
}

export function getRandomItemChoices(existing: ArraySchema<string>, count: number = 3): Item[] {
  const available = [...PASSIVE_ITEMS].filter(r => !existing.includes(r))
  return pickNRandomIn(available, Math.min(count, available.length))
}
