import {
  CraftableItems,
  Item,
  ItemComponentsNoFossilOrScarf,
  NonSpecialBerries
} from "../types/enum/Item"
import { Pkm } from "../types/enum/Pokemon"
import { Rarity } from "../types/enum/Game"
import { getPokemonData } from "./precomputed/precomputed-pokemon-data"
import { PRECOMPUTED_POKEMONS_PER_RARITY } from "./precomputed/precomputed-rarity"
import { pickNRandomIn, pickRandomIn, randomBetween } from "../utils/random"

export interface ShopItem {
  type: "item" | "pokemon"
  item?: Item
  pokemon?: Pkm
  price: number
}

const RARITY_BASE_PRICE: Record<string, number> = {
  [Rarity.COMMON]: 2,
  [Rarity.UNCOMMON]: 6,
  [Rarity.RARE]: 10,
  [Rarity.EPIC]: 16,
  [Rarity.ULTRA]: 24,
  [Rarity.UNIQUE]: 20,
  [Rarity.LEGENDARY]: 30,
  [Rarity.HATCH]: 6,
  [Rarity.SPECIAL]: 10
}

const STAR_BONUS_PRICE = 6

function getPokemonPrice(pkm: Pkm): number {
  const data = getPokemonData(pkm)
  const base = RARITY_BASE_PRICE[data.rarity] ?? 3
  const starBonus = (data.stars - 1) * STAR_BONUS_PRICE
  return base + starBonus
}

function getItemPrice(item: Item): number {
  if (item === Item.RECYCLE_TICKET || item === Item.EXCHANGE_TICKET) return 2
  if ((NonSpecialBerries as readonly Item[]).includes(item)) return 4
  if ((ItemComponentsNoFossilOrScarf as readonly Item[]).includes(item)) return 6
  if ((CraftableItems as readonly Item[]).includes(item)) return 10
  return 6
}

function pickShopPokemon(act: number): Pkm[] {
  const pool: Pkm[] = []

  // Ditto is common in shops
  for (let i = 0; i < 3; i++) pool.push(Pkm.DITTO)

  if (act === 1) {
    pool.push(...PRECOMPUTED_POKEMONS_PER_RARITY.COMMON)
    pool.push(...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON)
  } else if (act === 2) {
    pool.push(...PRECOMPUTED_POKEMONS_PER_RARITY.COMMON)
    pool.push(...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON)
    pool.push(...PRECOMPUTED_POKEMONS_PER_RARITY.RARE)
  } else {
    pool.push(...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON)
    pool.push(...PRECOMPUTED_POKEMONS_PER_RARITY.RARE)
    pool.push(...PRECOMPUTED_POKEMONS_PER_RARITY.EPIC)
  }

  return pickNRandomIn(pool, 6)
}

function pickShopItems(): Item[] {
  const items: Item[] = []

  // Always include 1-2 recycle/exchange tickets
  items.push(pickRandomIn([Item.RECYCLE_TICKET, Item.EXCHANGE_TICKET]))
  if (Math.random() < 0.5) {
    items.push(pickRandomIn([Item.RECYCLE_TICKET, Item.EXCHANGE_TICKET]))
  }

  // Mix of components and crafted items
  const componentCount = randomBetween(2, 3)
  items.push(...pickNRandomIn(ItemComponentsNoFossilOrScarf, componentCount))

  const craftedCount = randomBetween(1, 2)
  items.push(...pickNRandomIn([...CraftableItems], craftedCount))

  // Fill remaining with berries or extra components
  while (items.length < 6) {
    if (Math.random() < 0.4) {
      items.push(pickRandomIn(NonSpecialBerries))
    } else {
      items.push(pickRandomIn(ItemComponentsNoFossilOrScarf))
    }
  }

  return items.slice(0, 6)
}

export function generateShopItems(act: number): ShopItem[] {
  const result: ShopItem[] = []

  const pokemons = pickShopPokemon(act)
  pokemons.forEach((pkm) => {
    result.push({
      type: "pokemon",
      pokemon: pkm,
      price: getPokemonPrice(pkm)
    })
  })

  if (act <= 2) {
    for (let i = 0; i < 2; i++) {
      result.push({
        type: "pokemon",
        pokemon: Pkm.EGG,
        price: 12
      })
    }
  }

  const items = pickShopItems()
  items.forEach((item) => {
    result.push({
      type: "item",
      item,
      price: getItemPrice(item)
    })
  })

  return result
}
