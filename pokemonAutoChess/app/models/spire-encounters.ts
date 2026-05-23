import { RegionDetails } from "../config"
import { PRECOMPUTED_REGIONAL_MONS } from "./precomputed/precomputed-pokemon-data"
import { getPokemonData } from "./precomputed/precomputed-pokemon-data"
import { PRECOMPUTED_POKEMONS_PER_TYPE } from "./precomputed/precomputed-types"
import { DungeonPMDO } from "../types/enum/Dungeon"
import { Pkm } from "../types/enum/Pokemon"
import { Item } from "../types/enum/Item"
import { Synergy } from "../types/enum/Synergy"
import { pickNRandomIn, pickRandomIn, randomBetween } from "../utils/random"

export type SpireEncounter = {
  name: string
  avatar: Pkm
  board: [pkm: Pkm, x: number, y: number][]
  items?: Item[][]
}

export type SpireEncounterTemplate = {
  name: string
  avatar: Pkm
  tiers: {
    [key: number]: [pkm: Pkm, x: number, y: number][]
  }
}

const WILD_ENCOUNTERS: SpireEncounterTemplate[] = [
  {
    name: "Rock Cave",
    avatar: Pkm.GEODUDE,
    tiers: {
      1: [[Pkm.GEODUDE, 3, 1], [Pkm.GEODUDE, 5, 1]],
      2: [[Pkm.GEODUDE, 2, 1], [Pkm.GEODUDE, 4, 1], [Pkm.GEODUDE, 6, 1]],
      3: [[Pkm.GEODUDE, 2, 1], [Pkm.GEODUDE, 4, 1], [Pkm.GEODUDE, 6, 1], [Pkm.GRAVELER, 4, 2]]
    }
  },
  {
    name: "Bug Forest",
    avatar: Pkm.CATERPIE,
    tiers: {
      1: [[Pkm.CATERPIE, 3, 1], [Pkm.WEEDLE, 5, 1]],
      2: [[Pkm.CATERPIE, 2, 1], [Pkm.CATERPIE, 4, 1], [Pkm.WEEDLE, 6, 1]],
      3: [[Pkm.METAPOD, 2, 1], [Pkm.METAPOD, 4, 1], [Pkm.KAKUNA, 6, 1], [Pkm.BUTTERFREE, 4, 2]]
    }
  },
  {
    name: "Water Shore",
    avatar: Pkm.MAGIKARP,
    tiers: {
      1: [[Pkm.MAGIKARP, 3, 1], [Pkm.MAGIKARP, 5, 1]],
      2: [[Pkm.MAGIKARP, 2, 1], [Pkm.MAGIKARP, 4, 1], [Pkm.POLIWAG, 6, 1]],
      3: [[Pkm.MAGIKARP, 2, 1], [Pkm.POLIWAG, 4, 1], [Pkm.POLIWAG, 6, 1], [Pkm.POLIWHIRL, 4, 2]]
    }
  },
  {
    name: "Grass Meadow",
    avatar: Pkm.ODDISH,
    tiers: {
      1: [[Pkm.ODDISH, 3, 1], [Pkm.ODDISH, 5, 1]],
      2: [[Pkm.ODDISH, 2, 1], [Pkm.ODDISH, 4, 1], [Pkm.BELLSPROUT, 6, 1]],
      3: [[Pkm.ODDISH, 2, 1], [Pkm.GLOOM, 4, 2], [Pkm.BELLSPROUT, 6, 1], [Pkm.WEEPINBELL, 3, 2]]
    }
  },
  {
    name: "Rat Pack",
    avatar: Pkm.RATTATA,
    tiers: {
      1: [[Pkm.RATTATA, 3, 1], [Pkm.RATTATA, 5, 1]],
      2: [[Pkm.RATTATA, 2, 1], [Pkm.RATTATA, 4, 1], [Pkm.RATTATA, 6, 1]],
      3: [[Pkm.RATICATE, 3, 1], [Pkm.RATICATE, 5, 1], [Pkm.RATTATA, 2, 1], [Pkm.RATTATA, 6, 1]]
    }
  },
  {
    name: "Fire Mountain",
    avatar: Pkm.VULPIX,
    tiers: {
      1: [[Pkm.VULPIX, 3, 1], [Pkm.GROWLITHE, 5, 1]],
      2: [[Pkm.VULPIX, 2, 1], [Pkm.VULPIX, 4, 1], [Pkm.GROWLITHE, 6, 1]],
      3: [[Pkm.NINETALES, 4, 2], [Pkm.VULPIX, 2, 1], [Pkm.GROWLITHE, 6, 1], [Pkm.GROWLITHE, 3, 1]]
    }
  },
  {
    name: "Ghost Tower",
    avatar: Pkm.GASTLY,
    tiers: {
      1: [[Pkm.GASTLY, 3, 1], [Pkm.GASTLY, 5, 1]],
      2: [[Pkm.GASTLY, 2, 1], [Pkm.GASTLY, 4, 1], [Pkm.GASTLY, 6, 1]],
      3: [[Pkm.HAUNTER, 3, 2], [Pkm.GASTLY, 2, 1], [Pkm.GASTLY, 5, 1], [Pkm.HAUNTER, 6, 2]]
    }
  },
  {
    name: "Electric Field",
    avatar: Pkm.PICHU,
    tiers: {
      1: [[Pkm.PICHU, 3, 1], [Pkm.PICHU, 5, 1]],
      2: [[Pkm.PICHU, 2, 1], [Pkm.PIKACHU, 4, 1], [Pkm.PICHU, 6, 1]],
      3: [[Pkm.PIKACHU, 3, 1], [Pkm.PIKACHU, 5, 1], [Pkm.PICHU, 2, 1], [Pkm.PICHU, 6, 1]]
    }
  }
]

const GYM_LEADERS: SpireEncounter[] = [
  // --- Kanto ---
  {
    name: "Brock",
    avatar: Pkm.ONIX,
    board: [[Pkm.GEODUDE, 2, 1], [Pkm.GEODUDE, 6, 1], [Pkm.ONIX, 4, 2]]
  },
  {
    name: "Misty",
    avatar: Pkm.STARMIE,
    board: [[Pkm.STARYU, 2, 1], [Pkm.STARYU, 6, 1], [Pkm.STARMIE, 4, 2]]
  },
  {
    name: "Lt. Surge",
    avatar: Pkm.RAICHU,
    board: [[Pkm.PIKACHU, 2, 1], [Pkm.PIKACHU, 6, 1], [Pkm.RAICHU, 4, 2], [Pkm.VOLTORB, 4, 1]]
  },
  {
    name: "Erika",
    avatar: Pkm.VILEPLUME,
    board: [[Pkm.ODDISH, 2, 1], [Pkm.BELLSPROUT, 6, 1], [Pkm.VILEPLUME, 4, 2], [Pkm.GLOOM, 3, 1]]
  },
  {
    name: "Sabrina",
    avatar: Pkm.ALAKAZAM,
    board: [[Pkm.ABRA, 2, 1], [Pkm.KADABRA, 6, 1], [Pkm.ALAKAZAM, 4, 2], [Pkm.ABRA, 5, 1]]
  },
  {
    name: "Blaine",
    avatar: Pkm.ARCANINE,
    board: [[Pkm.GROWLITHE, 2, 1], [Pkm.GROWLITHE, 6, 1], [Pkm.ARCANINE, 4, 2], [Pkm.VULPIX, 4, 1]]
  },
  {
    name: "Koga",
    avatar: Pkm.MUK,
    board: [[Pkm.KOFFING, 2, 1], [Pkm.GRIMER, 6, 1], [Pkm.MUK, 4, 2], [Pkm.KOFFING, 5, 1]]
  },
  {
    name: "Giovanni",
    avatar: Pkm.NIDOKING,
    board: [[Pkm.RHYHORN, 2, 1], [Pkm.NIDORINO, 6, 1], [Pkm.NIDOKING, 4, 2], [Pkm.DUGTRIO, 4, 1]]
  },
  // --- Johto ---
  {
    name: "Morty",
    avatar: Pkm.GENGAR,
    board: [[Pkm.GASTLY, 2, 1], [Pkm.HAUNTER, 6, 1], [Pkm.GENGAR, 4, 2], [Pkm.MISDREAVUS, 3, 1]]
  },
  {
    name: "Chuck",
    avatar: Pkm.POLIWRATH,
    board: [[Pkm.MACHOP, 2, 1], [Pkm.PRIMEAPE, 6, 1], [Pkm.POLIWRATH, 4, 2], [Pkm.MACHOKE, 5, 1]]
  },
  {
    name: "Jasmine",
    avatar: Pkm.STEELIX,
    board: [[Pkm.MAGNEMITE, 2, 1], [Pkm.MAGNEMITE, 6, 1], [Pkm.STEELIX, 4, 2], [Pkm.MAGNETON, 4, 1]]
  },
  {
    name: "Clair",
    avatar: Pkm.DRAGONITE,
    board: [[Pkm.DRATINI, 2, 1], [Pkm.DRAGONAIR, 6, 1], [Pkm.DRAGONITE, 4, 2], [Pkm.KINGDRA, 3, 2]]
  },
  // --- Hoenn ---
  {
    name: "Flannery",
    avatar: Pkm.TORKOAL,
    board: [[Pkm.SLUGMA, 2, 1], [Pkm.NUMEL, 6, 1], [Pkm.TORKOAL, 4, 2], [Pkm.MAGCARGO, 5, 1]]
  },
  {
    name: "Norman",
    avatar: Pkm.SLAKING,
    board: [[Pkm.SLAKOTH, 2, 1], [Pkm.VIGOROTH, 6, 1], [Pkm.SLAKING, 4, 2]]
  },
  {
    name: "Winona",
    avatar: Pkm.ALTARIA,
    board: [[Pkm.SWABLU, 2, 1], [Pkm.TAILLOW, 6, 1], [Pkm.ALTARIA, 4, 2], [Pkm.SKARMORY, 3, 2]]
  },
  // --- Sinnoh ---
  {
    name: "Volkner",
    avatar: Pkm.LUXRAY,
    board: [[Pkm.SHINX, 2, 1], [Pkm.LUXIO, 6, 1], [Pkm.LUXRAY, 4, 2], [Pkm.ELECTRODE, 4, 1]]
  }
]

const LEGENDARY_BOSSES: { [act: number]: SpireEncounter } = {
  1: {
    name: "Mewtwo",
    avatar: Pkm.MEWTWO,
    board: [[Pkm.MEWTWO, 4, 3]]
  },
  2: {
    name: "Tower Duo",
    avatar: Pkm.LUGIA,
    board: [[Pkm.LUGIA, 3, 3], [Pkm.HO_OH, 5, 3]]
  },
  3: {
    name: "Weather Trio",
    avatar: Pkm.RAYQUAZA,
    board: [[Pkm.GROUDON, 2, 2], [Pkm.KYOGRE, 6, 2], [Pkm.RAYQUAZA, 4, 3]]
  }
}

interface DifficultyConfig {
  pokemonCount: number
  maxStars: number
  allowedRarities: string[]
}

function getDifficultyConfig(act: number, floor: number): DifficultyConfig {
  const progress = (act - 1) * 15 + floor // 1-45

  if (progress <= 2) {
    return { pokemonCount: 1, maxStars: 1, allowedRarities: ["COMMON"] }
  } else if (progress <= 5) {
    return { pokemonCount: randomBetween(1, 2), maxStars: 1, allowedRarities: ["COMMON", "UNCOMMON"] }
  } else if (progress <= 8) {
    return { pokemonCount: randomBetween(2, 3), maxStars: 1, allowedRarities: ["COMMON", "UNCOMMON"] }
  } else if (progress <= 12) {
    return { pokemonCount: randomBetween(2, 3), maxStars: 2, allowedRarities: ["COMMON", "UNCOMMON"] }
  } else if (progress <= 16) {
    return { pokemonCount: randomBetween(3, 4), maxStars: 2, allowedRarities: ["UNCOMMON", "RARE"] }
  } else if (progress <= 22) {
    return { pokemonCount: randomBetween(3, 4), maxStars: 2, allowedRarities: ["UNCOMMON", "RARE"] }
  } else if (progress <= 28) {
    return { pokemonCount: randomBetween(3, 5), maxStars: 2, allowedRarities: ["RARE", "EPIC"] }
  } else if (progress <= 35) {
    return { pokemonCount: randomBetween(4, 5), maxStars: 3, allowedRarities: ["RARE", "EPIC"] }
  } else if (progress <= 40) {
    return { pokemonCount: randomBetween(4, 6), maxStars: 3, allowedRarities: ["RARE", "EPIC", "ULTRA"] }
  } else {
    return { pokemonCount: randomBetween(5, 7), maxStars: 3, allowedRarities: ["EPIC", "ULTRA"] }
  }
}

export function getRegionalWildEncounter(act: number, floor: number, region: string): SpireEncounter {
  const synergies = RegionDetails[region as DungeonPMDO]?.synergies ?? []
  if (synergies.length === 0) {
    return getWildEncounter(act, floor, 0)
  }

  const difficulty = getDifficultyConfig(act, floor)

  // Build candidate pool filtered by region synergies, stars, and rarity
  const candidatePool: Pkm[] = []
  for (const syn of synergies) {
    const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn]
    if (typed) {
      for (const pkm of typed) {
        const data = getPokemonData(pkm)
        if (
          data.stars <= difficulty.maxStars &&
          difficulty.allowedRarities.includes(data.rarity) &&
          !candidatePool.includes(pkm)
        ) {
          candidatePool.push(pkm)
        }
      }
    }
  }

  if (candidatePool.length === 0) {
    // Fallback: try with just star filter, any rarity
    for (const syn of synergies) {
      const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn]
      if (typed) {
        for (const pkm of typed) {
          const data = getPokemonData(pkm)
          if (data.stars <= difficulty.maxStars && !candidatePool.includes(pkm)) {
            candidatePool.push(pkm)
          }
        }
      }
    }
  }

  if (candidatePool.length === 0) {
    return getWildEncounter(act, floor, 0)
  }

  // Select pokemon, biasing toward higher stars at higher difficulties
  const selected: Pkm[] = []
  const pool = [...candidatePool]
  for (let i = 0; i < difficulty.pokemonCount && pool.length > 0; i++) {
    // For later slots, prefer higher-star Pokemon
    if (i >= difficulty.pokemonCount - 2 && difficulty.maxStars >= 2) {
      const highStar = pool.filter(p => getPokemonData(p).stars >= 2)
      if (highStar.length > 0) {
        const pick = pickRandomIn(highStar)
        selected.push(pick)
        pool.splice(pool.indexOf(pick), 1)
        continue
      }
    }
    const pick = pickRandomIn(pool)
    selected.push(pick)
    pool.splice(pool.indexOf(pick), 1)
  }

  const positions = [
    [4, 1], [2, 1], [6, 1], [3, 1], [5, 1], [3, 2], [5, 2]
  ]
  const board: [Pkm, number, number][] = selected.map((pkm, i) => {
    const pos = positions[i % positions.length]
    return [pkm, pos[0], pos[1]]
  })

  const regionName = (region as string).replace(/([A-Z])/g, " $1").trim()

  return {
    name: regionName,
    avatar: selected[0],
    board
  }
}

function getEncounterTier(act: number, floor: number): number {
  const progress = (act - 1) * 15 + floor
  if (progress <= 5) return 1
  if (progress <= 15) return 2
  return 3
}

export function getWildEncounter(act: number, floor: number, seed: number): SpireEncounter {
  const template = WILD_ENCOUNTERS[seed % WILD_ENCOUNTERS.length]
  const tier = getEncounterTier(act, floor)
  const board = template.tiers[tier] || template.tiers[1]
  return {
    name: template.name,
    avatar: template.avatar,
    board: [...board]
  }
}

export function getGymLeaderEncounter(act: number, floor: number): SpireEncounter {
  const index = ((act - 1) * 2 + Math.floor(floor / 7)) % GYM_LEADERS.length
  return GYM_LEADERS[index]
}

export function getLegendaryBossEncounter(act: number): SpireEncounter {
  return LEGENDARY_BOSSES[act] || LEGENDARY_BOSSES[1]
}

export function getRegionalPokemonForReward(region: string, act: number): Pkm | null {
  const synergies = RegionDetails[region as DungeonPMDO]?.synergies ?? []
  if (synergies.length === 0) return null

  const candidates: Pkm[] = []
  for (const syn of synergies) {
    const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn]
    if (typed) {
      for (const pkm of typed) {
        const data = getPokemonData(pkm)
        const maxStars = act === 1 ? 1 : act === 2 ? 1 : 2
        if (data.stars <= maxStars && !candidates.includes(pkm)) {
          candidates.push(pkm)
        }
      }
    }
  }

  return candidates.length > 0 ? pickRandomIn(candidates) : null
}

export function getGoldReward(nodeType: string, act: number): number {
  switch (nodeType) {
    case "WILD_BATTLE": return 2 + act
    case "GYM_LEADER": return 6 + act * 2
    case "LEGENDARY_BOSS": return 12 + act * 3
    default: return 0
  }
}
