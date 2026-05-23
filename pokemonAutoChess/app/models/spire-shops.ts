import {
  CraftableItems,
  Item,
  ItemComponentsNoFossilOrScarf,
  SynergyStones
} from "../types/enum/Item"
import { Pkm } from "../types/enum/Pokemon"
import { PRECOMPUTED_POKEMONS_PER_RARITY } from "./precomputed/precomputed-rarity"
import { pickNRandomIn, randomBetween } from "../utils/random"

export enum ShopType {
  POKEMON = "POKEMON",
  COMPONENT = "COMPONENT",
  ITEM = "ITEM",
  RARE_ITEM = "RARE_ITEM",
  MIXED = "MIXED"
}

export interface ShopItem {
  type: "item" | "pokemon"
  item?: Item
  pokemon?: Pkm
  price: number
}

const COMPONENT_PRICES: Record<string, number> = {}
ItemComponentsNoFossilOrScarf.forEach((item) => {
  COMPONENT_PRICES[item] = 2
})

function getCraftableItemPrice(): number {
  return randomBetween(4, 6)
}

function getRareItemPrice(): number {
  return randomBetween(7, 10)
}

function getPokemonPrice(act: number): number {
  return randomBetween(2, 3 + act)
}

export function getShopTypeForAct(act: number): ShopType {
  const roll = Math.random()
  switch (act) {
    case 1:
      if (roll < 0.4) return ShopType.COMPONENT
      if (roll < 0.7) return ShopType.POKEMON
      return ShopType.MIXED
    case 2:
      if (roll < 0.3) return ShopType.ITEM
      if (roll < 0.5) return ShopType.POKEMON
      if (roll < 0.7) return ShopType.COMPONENT
      return ShopType.MIXED
    case 3:
      if (roll < 0.3) return ShopType.RARE_ITEM
      if (roll < 0.5) return ShopType.ITEM
      if (roll < 0.7) return ShopType.POKEMON
      return ShopType.MIXED
    default:
      return ShopType.MIXED
  }
}

export function generateShopItems(shopType: ShopType, act: number): ShopItem[] {
  const count = randomBetween(4, 8)
  const items: ShopItem[] = []

  switch (shopType) {
    case ShopType.COMPONENT: {
      const components = pickNRandomIn(ItemComponentsNoFossilOrScarf, count)
      components.forEach((item) => {
        items.push({ type: "item", item, price: 2 })
      })
      break
    }
    case ShopType.ITEM: {
      const craftable = pickNRandomIn([...CraftableItems], count)
      craftable.forEach((item) => {
        items.push({ type: "item", item, price: getCraftableItemPrice() })
      })
      break
    }
    case ShopType.RARE_ITEM: {
      const rareItems = pickNRandomIn([...SynergyStones, ...CraftableItems], count)
      rareItems.forEach((item) => {
        items.push({ type: "item", item, price: getRareItemPrice() })
      })
      break
    }
    case ShopType.POKEMON: {
      const pool = act === 1
        ? PRECOMPUTED_POKEMONS_PER_RARITY.COMMON
        : act === 2
          ? [...PRECOMPUTED_POKEMONS_PER_RARITY.COMMON, ...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON]
          : [...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON, ...PRECOMPUTED_POKEMONS_PER_RARITY.RARE]
      const pokemons = pickNRandomIn(pool, count)
      pokemons.forEach((pkm) => {
        items.push({ type: "pokemon", pokemon: pkm, price: getPokemonPrice(act) })
      })
      break
    }
    case ShopType.MIXED: {
      const halfCount = Math.floor(count / 2)
      const components = pickNRandomIn(ItemComponentsNoFossilOrScarf, halfCount)
      components.forEach((item) => {
        items.push({ type: "item", item, price: 2 })
      })
      const pool = act <= 2
        ? PRECOMPUTED_POKEMONS_PER_RARITY.COMMON
        : PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON
      const pokemons = pickNRandomIn(pool, count - halfCount)
      pokemons.forEach((pkm) => {
        items.push({ type: "pokemon", pokemon: pkm, price: getPokemonPrice(act) })
      })
      break
    }
  }

  return items
}
