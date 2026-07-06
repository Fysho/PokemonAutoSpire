import { Rarity } from "../../types/enum/Game"

export const SHOP_SIZE = 6
export const NB_STARTERS = 3
export const NB_UNIQUE_PROPOSITIONS = 6

export const RarityHpCost: { [key in Rarity]: number } = Object.freeze({
  [Rarity.COMMON]: 1,
  [Rarity.UNCOMMON]: 1,
  [Rarity.RARE]: 2,
  [Rarity.EPIC]: 2,
  [Rarity.ULTRA]: 3,
  [Rarity.UNIQUE]: 3,
  [Rarity.LEGENDARY]: 3,
  [Rarity.SPECIAL]: 1,
  [Rarity.HATCH]: 4
})

// used to evaluate unit value, even if some categories are not found in shop
export const RarityCost: { [key in Rarity]: number } = Object.freeze({
  [Rarity.SPECIAL]: 0, // many edgecases with custom buy/sell prices
  [Rarity.COMMON]: 1,
  [Rarity.UNCOMMON]: 2,
  [Rarity.RARE]: 3,
  [Rarity.EPIC]: 4,
  [Rarity.ULTRA]: 5,
  [Rarity.HATCH]: 9,
  [Rarity.UNIQUE]: 10,
  [Rarity.LEGENDARY]: 20
})

export const RarityColor: { [key in Rarity]: string } = {
  [Rarity.COMMON]: "var(--color-rarity-common)",
  [Rarity.UNCOMMON]: "var(--color-rarity-uncommon)",
  [Rarity.RARE]: "var(--color-rarity-rare)",
  [Rarity.EPIC]: "var(--color-rarity-epic)",
  [Rarity.ULTRA]: "var(--color-rarity-ultra)",
  [Rarity.UNIQUE]: "var(--color-rarity-unique)",
  [Rarity.LEGENDARY]: "var(--color-rarity-legendary)",
  [Rarity.SPECIAL]: "var(--color-rarity-special)",
  [Rarity.HATCH]: "var(--color-rarity-hatch)"
}

export const BoosterRarityProbability: { [key in Rarity]: number } = {
  [Rarity.COMMON]: 0.12,
  [Rarity.UNCOMMON]: 0.2,
  [Rarity.RARE]: 0.2,
  [Rarity.EPIC]: 0.18,
  [Rarity.ULTRA]: 0.04,
  [Rarity.UNIQUE]: 0.1,
  [Rarity.LEGENDARY]: 0.06,
  [Rarity.HATCH]: 0.05,
  [Rarity.SPECIAL]: 0.05
}

// Levels 10-13 are reachable in Endless mode only (ENDLESS_MAX_LEVEL) — the
// table must cover them or every consumer (encounter-rate HUD chips, shop
// rolls, Meltan magnet pull) crashes on an undefined row at level 10+.
export const RarityProbabilityPerLevel: { [key: number]: number[] } = {
  1: [1, 0, 0, 0, 0],
  2: [1, 0, 0, 0, 0],
  3: [0.7, 0.3, 0, 0, 0],
  4: [0.5, 0.4, 0.1, 0, 0],
  5: [0.36, 0.42, 0.2, 0.02, 0],
  6: [0.25, 0.4, 0.3, 0.05, 0],
  7: [0.16, 0.33, 0.35, 0.15, 0.01],
  8: [0.11, 0.27, 0.35, 0.22, 0.05],
  9: [0.05, 0.2, 0.35, 0.3, 0.1],
  10: [0.03, 0.15, 0.32, 0.34, 0.16],
  11: [0.02, 0.1, 0.28, 0.37, 0.23],
  12: [0.01, 0.07, 0.24, 0.38, 0.3],
  13: [0.01, 0.05, 0.2, 0.38, 0.36]
}

// Safe accessor: any level beyond the table reuses its last row instead of
// returning undefined (which crashed the client HUD and would crash the
// server's random-pool rolls). Use this instead of indexing the table raw.
export function getRarityProbabilities(level: number): number[] {
  return (
    RarityProbabilityPerLevel[level] ??
    RarityProbabilityPerLevel[
      Math.max(...Object.keys(RarityProbabilityPerLevel).map(Number))
    ]
  )
}

/* Special Pokemon rates */
export const DITTO_RATE = 0.005
export const MIN_STAGE_FOR_DITTO = 6
export const EEVEE_RATE = 1 / 20
export const KECLEON_RATE = 1 / 400
export const ARCEUS_RATE = 1 / 400
export const UNOWN_PSY3_NB_SHOPS_INTERVAL = 5
export const UNOWN_PSY5_NB_SHOPS_INTERVAL = 3
export const UNOWN_PSY7_NB_SHOPS_INTERVAL = 10
export const FALINKS_TROOPER_RATE = 4 / 100
export const REMORAID_RATE = 1 / 3

export const PVE_WILD_CHANCE = 5 / 100

export const INCENSE_CHANCE = 5 / 100
export const HONEY_CHANCE = 5 / 100
export const REPEAT_BALL_LEGENDARY_CAP = 120
export const REPEAT_BALL_UNIQUE_CAP = 80
export const REPEAT_BALL_UNIQUE_INTERVAL = 10

export const AQUA_MONICA_CHANCE = 5 / 100
export const FIERY_DRUM_CHANCE = 5 / 100
export const GRASS_CORNET_CHANCE = 5 / 100
export const ICY_FLUTE_CHANCE = 5 / 100
export const ROCK_HORN_CHANCE = 5 / 100
export const SKY_MELODICA_CHANCE = 5 / 100
export const TERRA_CYMBAL_CHANCE = 5 / 100

export const HIGH_ROLLER_CHANCE = 2 / 100

/* sell prices */
export const SellPrices = {
  EGG: 2,
  SHINY_EGG: 10,
  DITTO: 5,
  EEVEE: 1,
  FALINKS_TROOPER: 3,
  MELTAN: 0,
  MAGIKARP: 0,
  GYARADOS: 10,
  FEEBAS: 1,
  MILOTIC: 10,
  WISHIWASHI: 3,
  WISHIWASHI_SCHOOL: 10,
  REMORAID: 2,
  OCTILLERY: 7,
  UNOWN: 1,
  HATCH: [3, 4, 5],
  UNIQUE: 10,
  UNIQUE_DUO: 6,
  LEGENDARY: 20,
  LEGENDARY_DUO: 10
}

export const BuyPrices = {
  DITTO: 5,
  FALINKS_TROOPER: 3,
  MELTAN: 0,
  UNOWN: 1
}
