import { ArraySchema } from "@colyseus/schema"
import { Item } from "../types/enum/Item"

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
  Item.OLD_AMBER,
  Item.ASSAULT_VEST,
  Item.POKERUS_VIAL
] as const

function hasItem(items: ArraySchema<string>, item: Item): boolean {
  return items.includes(item)
}

export function getPassiveItemBonusGold(items: ArraySchema<string>): number {
  return hasItem(items, Item.LUCKY_RIBBON) ? 3 : 0
}

export function getPassiveItemPostBattleHeal(items: ArraySchema<string>, won: boolean): number {
  let heal = 0
  if (hasItem(items, Item.SHELL_BELL) && won) heal += 5
  if (hasItem(items, Item.LEFTOVERS)) heal += 3
  return heal
}

export function getPassiveItemDamageReduction(items: ArraySchema<string>): number {
  return hasItem(items, Item.SMOKE_BALL) ? 3 : 0
}

export function getPassiveItemPokemonOfferCount(items: ArraySchema<string>): number {
  return hasItem(items, Item.WIDE_LENS) ? 4 : 3
}

export function getPassiveItemBonusXP(items: ArraySchema<string>): number {
  return hasItem(items, Item.EXP_SHARE) ? 4 : 0
}

export function getPassiveItemRestHealBonus(items: ArraySchema<string>): number {
  return hasItem(items, Item.MAX_REVIVE) ? 20 : 0
}

export function getPassiveItemFreeReroll(items: ArraySchema<string>): boolean {
  return hasItem(items, Item.AMULET_COIN)
}
