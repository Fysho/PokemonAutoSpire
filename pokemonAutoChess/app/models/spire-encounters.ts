import { RegionDetails } from "../config"
import { PRECOMPUTED_REGIONAL_MONS } from "./precomputed/precomputed-pokemon-data"
import { getPokemonData } from "./precomputed/precomputed-pokemon-data"
import { PRECOMPUTED_POKEMONS_PER_TYPE } from "./precomputed/precomputed-types"
import { DungeonPMDO } from "../types/enum/Dungeon"
import { Pkm } from "../types/enum/Pokemon"
import { CraftableItems, Item, ItemComponents } from "../types/enum/Item"
import { Synergy } from "../types/enum/Synergy"
import { pickNRandomIn, pickRandomIn, randomBetween } from "../utils/random"

export type SpireEncounter = {
  name: string
  avatar: Pkm
  board: [pkm: Pkm, x: number, y: number][]
  items?: Item[][]
  synergy?: Synergy
  bonusHP?: number
  bonusAtk?: number
  bonusAP?: number
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

// Early gym leaders (floor 9)
const EARLY_GYM_LEADERS: SpireEncounter[] = [
  {
    name: "Brock",
    avatar: Pkm.ONIX,
    synergy: Synergy.ROCK,
    board: [[Pkm.GEODUDE, 2, 1], [Pkm.GEODUDE, 6, 1], [Pkm.ONIX, 4, 2]]
  },
  {
    name: "Misty",
    avatar: Pkm.STARMIE,
    synergy: Synergy.WATER,
    board: [[Pkm.STARYU, 2, 1], [Pkm.STARYU, 6, 1], [Pkm.STARMIE, 4, 2]]
  },
  {
    name: "Lt. Surge",
    avatar: Pkm.RAICHU,
    synergy: Synergy.ELECTRIC,
    board: [[Pkm.PIKACHU, 2, 1], [Pkm.PIKACHU, 6, 1], [Pkm.RAICHU, 4, 2], [Pkm.VOLTORB, 4, 1]]
  },
  {
    name: "Erika",
    avatar: Pkm.VILEPLUME,
    synergy: Synergy.GRASS,
    board: [[Pkm.ODDISH, 2, 1], [Pkm.BELLSPROUT, 6, 1], [Pkm.VILEPLUME, 4, 2], [Pkm.GLOOM, 3, 1]]
  },
  {
    name: "Koga",
    avatar: Pkm.MUK,
    synergy: Synergy.POISON,
    board: [[Pkm.KOFFING, 2, 1], [Pkm.GRIMER, 6, 1], [Pkm.MUK, 4, 2], [Pkm.KOFFING, 5, 1]]
  },
  {
    name: "Flannery",
    avatar: Pkm.TORKOAL,
    synergy: Synergy.FIRE,
    board: [[Pkm.SLUGMA, 2, 1], [Pkm.NUMEL, 6, 1], [Pkm.TORKOAL, 4, 2], [Pkm.MAGCARGO, 5, 1]]
  },
  {
    name: "Norman",
    avatar: Pkm.SLAKING,
    synergy: Synergy.NORMAL,
    board: [[Pkm.SLAKOTH, 2, 1], [Pkm.VIGOROTH, 6, 1], [Pkm.SLAKING, 4, 2]]
  },
  {
    name: "Winona",
    avatar: Pkm.ALTARIA,
    synergy: Synergy.FLYING,
    board: [[Pkm.SWABLU, 2, 1], [Pkm.TAILLOW, 6, 1], [Pkm.ALTARIA, 4, 2], [Pkm.SKARMORY, 3, 2]]
  }
]

// Late gym leaders (floor 18) - fully evolved, 3-4 Pokemon
const LATE_GYM_LEADERS: SpireEncounter[] = [
  {
    name: "Sabrina",
    avatar: Pkm.ALAKAZAM,
    synergy: Synergy.PSYCHIC,
    board: [[Pkm.ABRA, 2, 1], [Pkm.KADABRA, 6, 1], [Pkm.ALAKAZAM, 4, 2]]
  },
  {
    name: "Blaine",
    avatar: Pkm.ARCANINE,
    synergy: Synergy.FIRE,
    board: [[Pkm.GROWLITHE, 2, 1], [Pkm.GROWLITHE, 6, 1], [Pkm.ARCANINE, 4, 2], [Pkm.VULPIX, 4, 1]]
  },
  {
    name: "Giovanni",
    avatar: Pkm.NIDOKING,
    synergy: Synergy.GROUND,
    board: [[Pkm.RHYHORN, 2, 1], [Pkm.NIDORINO, 6, 1], [Pkm.NIDOKING, 4, 2], [Pkm.DUGTRIO, 4, 1]]
  },
  {
    name: "Morty",
    avatar: Pkm.GENGAR,
    synergy: Synergy.GHOST,
    board: [[Pkm.GASTLY, 2, 1], [Pkm.HAUNTER, 6, 1], [Pkm.GENGAR, 4, 2], [Pkm.MISDREAVUS, 3, 1]]
  },
  {
    name: "Chuck",
    avatar: Pkm.POLIWRATH,
    synergy: Synergy.FIGHTING,
    board: [[Pkm.MACHOP, 2, 1], [Pkm.PRIMEAPE, 6, 1], [Pkm.POLIWRATH, 4, 2], [Pkm.MACHOKE, 5, 1]]
  },
  {
    name: "Jasmine",
    avatar: Pkm.STEELIX,
    synergy: Synergy.STEEL,
    board: [[Pkm.MAGNEMITE, 2, 1], [Pkm.MAGNEMITE, 6, 1], [Pkm.STEELIX, 4, 2], [Pkm.MAGNETON, 4, 1]]
  },
  {
    name: "Clair",
    avatar: Pkm.DRAGONAIR,
    synergy: Synergy.DRAGON,
    board: [[Pkm.DRATINI, 2, 1], [Pkm.DRATINI, 6, 1], [Pkm.DRAGONAIR, 4, 2]]
  },
  {
    name: "Volkner",
    avatar: Pkm.LUXRAY,
    synergy: Synergy.ELECTRIC,
    board: [[Pkm.SHINX, 2, 1], [Pkm.LUXIO, 6, 1], [Pkm.LUXRAY, 4, 2], [Pkm.ELECTRODE, 4, 1]]
  }
]

const GYM_LEADERS: SpireEncounter[] = [...EARLY_GYM_LEADERS, ...LATE_GYM_LEADERS]

export type EliteEncounterTemplate = {
  name: string
  avatar: Pkm
  pokemon: Pkm[]
  rewards: Pkm[]
  board: [pkm: Pkm, x: number, y: number][]
}

// Act 1: Baby/basic Pokemon fights, reward 1-star Pokemon
const ACT1_ELITE_ENCOUNTERS: EliteEncounterTemplate[] = [
  {
    name: "Eeveelution Squad",
    avatar: Pkm.EEVEE,
    pokemon: [Pkm.VAPOREON, Pkm.JOLTEON, Pkm.FLAREON, Pkm.ESPEON, Pkm.UMBREON, Pkm.LEAFEON, Pkm.GLACEON, Pkm.SYLVEON],
    rewards: [Pkm.EEVEE],
    board: []
  },
  {
    name: "Psychic Circle",
    avatar: Pkm.KADABRA,
    pokemon: [Pkm.KADABRA, Pkm.KIRLIA, Pkm.DROWZEE, Pkm.MR_MIME, Pkm.JYNX],
    rewards: [Pkm.ABRA, Pkm.RALTS, Pkm.DROWZEE, Pkm.MIME_JR, Pkm.SMOOCHUM],
    board: []
  },
  {
    name: "Rival Flames",
    avatar: Pkm.ELECTABUZZ,
    pokemon: [Pkm.ELECTABUZZ, Pkm.MAGMAR],
    rewards: [Pkm.ELEKID, Pkm.MAGBY],
    board: [[Pkm.ELECTABUZZ, 3, 2], [Pkm.MAGMAR, 5, 2]]
  }
]

// Act 2: Mid evolutions, reward 2-star Pokemon
const ACT2_ELITE_ENCOUNTERS: EliteEncounterTemplate[] = [
  {
    name: "Iron Defense",
    avatar: Pkm.METANG,
    pokemon: [Pkm.METANG, Pkm.LUCARIO, Pkm.SCIZOR],
    rewards: [Pkm.METANG, Pkm.LUCARIO, Pkm.SCIZOR],
    board: [[Pkm.METANG, 4, 2], [Pkm.LUCARIO, 2, 1], [Pkm.SCIZOR, 6, 1]]
  },
  {
    name: "Psychic Conclave",
    avatar: Pkm.KIRLIA,
    pokemon: [Pkm.KIRLIA, Pkm.KADABRA, Pkm.GARDEVOIR],
    rewards: [Pkm.KIRLIA, Pkm.KADABRA],
    board: [[Pkm.KIRLIA, 3, 1], [Pkm.KADABRA, 5, 1], [Pkm.GARDEVOIR, 4, 2]]
  },
  {
    name: "Sleeping Giant",
    avatar: Pkm.SNORLAX,
    pokemon: [Pkm.SNORLAX, Pkm.VIGOROTH, Pkm.DITTO],
    rewards: [Pkm.SNORLAX, Pkm.VIGOROTH, Pkm.DITTO],
    board: [[Pkm.SNORLAX, 4, 2], [Pkm.VIGOROTH, 2, 1], [Pkm.DITTO, 6, 1]]
  },
  {
    name: "Poltergeist",
    avatar: Pkm.ROTOM,
    pokemon: [Pkm.ROTOM, Pkm.ROTOM_WASH, Pkm.ROTOM_HEAT],
    rewards: [Pkm.ROTOM, Pkm.ROTOM_WASH, Pkm.ROTOM_HEAT],
    board: [[Pkm.ROTOM, 4, 2], [Pkm.ROTOM_WASH, 2, 1], [Pkm.ROTOM_HEAT, 6, 1]]
  },
  {
    name: "Dark Omen",
    avatar: Pkm.ABSOL,
    pokemon: [Pkm.ABSOL, Pkm.SPIRITOMB],
    rewards: [Pkm.ABSOL, Pkm.SPIRITOMB],
    board: [[Pkm.ABSOL, 3, 2], [Pkm.SPIRITOMB, 5, 2]]
  },
  {
    name: "Masquerade",
    avatar: Pkm.MIMIKYU,
    pokemon: [Pkm.MIMIKYU, Pkm.DITTO, Pkm.ZORUA],
    rewards: [Pkm.MIMIKYU, Pkm.DITTO, Pkm.ZORUA],
    board: [[Pkm.MIMIKYU, 4, 2], [Pkm.DITTO, 2, 1], [Pkm.ZORUA, 6, 1]]
  }
]

// Act 3: Fully evolved, reward 3-star Pokemon
const ACT3_ELITE_ENCOUNTERS: EliteEncounterTemplate[] = [
  {
    name: "Dragon's Den",
    avatar: Pkm.SALAMENCE,
    pokemon: [Pkm.SALAMENCE, Pkm.GARCHOMP, Pkm.DRAGONITE],
    rewards: [Pkm.SALAMENCE, Pkm.GARCHOMP, Pkm.DRAGONITE],
    board: [[Pkm.SALAMENCE, 2, 2], [Pkm.GARCHOMP, 6, 2], [Pkm.DRAGONITE, 4, 3]]
  },
  {
    name: "Tyrant's Court",
    avatar: Pkm.TYRANITAR,
    pokemon: [Pkm.TYRANITAR, Pkm.HERACROSS, Pkm.AERODACTYL],
    rewards: [Pkm.TYRANITAR, Pkm.AERODACTYL],
    board: [[Pkm.TYRANITAR, 4, 3], [Pkm.HERACROSS, 2, 1], [Pkm.AERODACTYL, 6, 2], [Pkm.PUPITAR, 3, 1]]
  },
  {
    name: "Celestial Duo",
    avatar: Pkm.TOGEKISS,
    pokemon: [Pkm.TOGEKISS, Pkm.MILOTIC, Pkm.GARDEVOIR],
    rewards: [Pkm.TOGEKISS, Pkm.MILOTIC, Pkm.GARDEVOIR],
    board: [[Pkm.TOGEKISS, 4, 3], [Pkm.MILOTIC, 2, 2], [Pkm.GARDEVOIR, 6, 2]]
  },
  {
    name: "Mother's Fury",
    avatar: Pkm.KANGASKHAN,
    pokemon: [Pkm.KANGASKHAN, Pkm.KANGASKHAN, Pkm.KANGASKHAN],
    rewards: [Pkm.KANGASKHAN],
    board: [[Pkm.KANGASKHAN, 4, 3], [Pkm.KANGASKHAN, 2, 2], [Pkm.KANGASKHAN, 6, 2]]
  },
  {
    name: "Luchador Ring",
    avatar: Pkm.HAWLUCHA,
    pokemon: [Pkm.HAWLUCHA, Pkm.TAUROS, Pkm.KANGASKHAN],
    rewards: [Pkm.HAWLUCHA, Pkm.TAUROS, Pkm.KANGASKHAN],
    board: [[Pkm.HAWLUCHA, 4, 3], [Pkm.TAUROS, 2, 2], [Pkm.KANGASKHAN, 6, 2], [Pkm.HAWLUCHA, 3, 1]]
  },
  {
    name: "Weather Report",
    avatar: Pkm.CASTFORM,
    pokemon: [Pkm.CASTFORM_SUN, Pkm.CASTFORM_RAIN, Pkm.CASTFORM_HAIL, Pkm.CASTFORM],
    rewards: [Pkm.CASTFORM_SUN, Pkm.CASTFORM_RAIN, Pkm.CASTFORM_HAIL],
    board: [[Pkm.CASTFORM_SUN, 2, 2], [Pkm.CASTFORM_RAIN, 6, 2], [Pkm.CASTFORM_HAIL, 4, 2], [Pkm.CASTFORM, 3, 1], [Pkm.CASTFORM, 5, 1]]
  }
]

const ELITE_ENCOUNTERS_BY_ACT: { [act: number]: EliteEncounterTemplate[] } = {
  1: ACT1_ELITE_ENCOUNTERS,
  2: ACT2_ELITE_ENCOUNTERS,
  3: ACT3_ELITE_ENCOUNTERS
}

const LEGENDARY_BOSSES: { [act: number]: SpireEncounter } = {
  1: {
    name: "Mewtwo & Mew",
    avatar: Pkm.MEWTWO,
    board: [[Pkm.MEWTWO, 4, 3], [Pkm.MEW, 2, 2]],
    items: [
      [Item.CHOICE_SPECS],
      [Item.SHELL_BELL]
    ],
    bonusHP: 100,
    bonusAtk: 5,
    bonusAP: 20
  },
  2: {
    name: "Tower Duo",
    avatar: Pkm.LUGIA,
    board: [[Pkm.LUGIA, 3, 3], [Pkm.HO_OH, 5, 3]],
    items: [
      [Item.LEFTOVERS, Item.ASSAULT_VEST, Item.SOUL_DEW],
      [Item.SACRED_ASH, Item.FLAME_ORB, Item.WIDE_LENS]
    ],
    bonusHP: 200,
    bonusAtk: 10,
    bonusAP: 40
  },
  3: {
    name: "Weather Trio",
    avatar: Pkm.RAYQUAZA,
    board: [[Pkm.GROUDON, 2, 2], [Pkm.KYOGRE, 6, 2], [Pkm.RAYQUAZA, 4, 3]],
    items: [
      [Item.RED_ORB, Item.ROCKY_HELMET, Item.ASSAULT_VEST],
      [Item.BLUE_ORB, Item.SHELL_BELL, Item.WISE_GLASSES],
      [Item.RAZOR_CLAW, Item.SCOPE_LENS, Item.RAZOR_FANG]
    ],
    bonusHP: 350,
    bonusAtk: 15,
    bonusAP: 60
  }
}

interface DifficultyConfig {
  pokemonCount: number
  maxStars: number
  allowedRarities: string[]
  minItemsPerPokemon: number
  maxItemsPerPokemon: number
  useCraftedItems: boolean
}

function getDifficultyConfig(act: number, floor: number): DifficultyConfig {
  const progress = (act - 1) * 20 + floor // 1-60

  // --- Act 1 ---
  if (progress <= 1) {
    return { pokemonCount: 1, maxStars: 1, allowedRarities: ["COMMON"], minItemsPerPokemon: 0, maxItemsPerPokemon: 0, useCraftedItems: false }
  } else if (progress <= 3) {
    return { pokemonCount: 2, maxStars: 1, allowedRarities: ["COMMON"], minItemsPerPokemon: 0, maxItemsPerPokemon: 0, useCraftedItems: false }
  } else if (progress <= 5) {
    return { pokemonCount: randomBetween(2, 3), maxStars: 1, allowedRarities: ["COMMON", "UNCOMMON"], minItemsPerPokemon: 0, maxItemsPerPokemon: 0, useCraftedItems: false }
  } else if (progress <= 8) {
    return { pokemonCount: randomBetween(3, 4), maxStars: 2, allowedRarities: ["COMMON", "UNCOMMON"], minItemsPerPokemon: 0, maxItemsPerPokemon: 1, useCraftedItems: false }
  } else if (progress <= 12) {
    return { pokemonCount: randomBetween(3, 4), maxStars: 2, allowedRarities: ["COMMON", "UNCOMMON"], minItemsPerPokemon: 0, maxItemsPerPokemon: 1, useCraftedItems: false }
  } else if (progress <= 16) {
    return { pokemonCount: randomBetween(3, 5), maxStars: 2, allowedRarities: ["UNCOMMON", "RARE"], minItemsPerPokemon: 0, maxItemsPerPokemon: 1, useCraftedItems: false }
  } else if (progress <= 20) {
    return { pokemonCount: randomBetween(4, 5), maxStars: 2, allowedRarities: ["UNCOMMON", "RARE"], minItemsPerPokemon: 0, maxItemsPerPokemon: 1, useCraftedItems: true }
  // --- Act 2 ---
  } else if (progress <= 25) {
    return { pokemonCount: randomBetween(5, 7), maxStars: 3, allowedRarities: ["RARE", "EPIC"], minItemsPerPokemon: 1, maxItemsPerPokemon: 2, useCraftedItems: true }
  } else if (progress <= 30) {
    return { pokemonCount: randomBetween(6, 7), maxStars: 3, allowedRarities: ["RARE", "EPIC"], minItemsPerPokemon: 1, maxItemsPerPokemon: 2, useCraftedItems: true }
  } else if (progress <= 35) {
    return { pokemonCount: randomBetween(6, 8), maxStars: 3, allowedRarities: ["EPIC", "ULTRA"], minItemsPerPokemon: 1, maxItemsPerPokemon: 3, useCraftedItems: true }
  } else if (progress <= 40) {
    return { pokemonCount: randomBetween(7, 8), maxStars: 3, allowedRarities: ["EPIC", "ULTRA"], minItemsPerPokemon: 2, maxItemsPerPokemon: 3, useCraftedItems: true }
  // --- Act 3 ---
  } else if (progress <= 45) {
    return { pokemonCount: randomBetween(7, 8), maxStars: 3, allowedRarities: ["EPIC", "ULTRA"], minItemsPerPokemon: 2, maxItemsPerPokemon: 3, useCraftedItems: true }
  } else if (progress <= 50) {
    return { pokemonCount: randomBetween(7, 9), maxStars: 3, allowedRarities: ["EPIC", "ULTRA"], minItemsPerPokemon: 2, maxItemsPerPokemon: 3, useCraftedItems: true }
  } else {
    return { pokemonCount: randomBetween(8, 9), maxStars: 3, allowedRarities: ["EPIC", "ULTRA"], minItemsPerPokemon: 3, maxItemsPerPokemon: 3, useCraftedItems: true }
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
    [4, 1], [2, 1], [6, 1], [3, 1], [5, 1], [3, 2], [5, 2], [2, 2], [6, 2]
  ]
  const board: [Pkm, number, number][] = selected.map((pkm, i) => {
    const pos = positions[i % positions.length]
    return [pkm, pos[0], pos[1]]
  })

  const items = generateEncounterItems(selected.length, difficulty.minItemsPerPokemon, difficulty.maxItemsPerPokemon, difficulty.useCraftedItems)

  const regionName = (region as string).replace(/([A-Z])/g, " $1").trim()

  return {
    name: regionName,
    avatar: selected[0],
    board,
    items
  }
}

function generateEncounterItems(pokemonCount: number, minItems: number, maxItems: number, useCrafted: boolean): Item[][] {
  if (maxItems <= 0) return []
  const result: Item[][] = []
  for (let i = 0; i < pokemonCount; i++) {
    const count = randomBetween(minItems, maxItems)
    if (count === 0) {
      result.push([])
      continue
    }
    const pkmItems: Item[] = []
    for (let j = 0; j < count; j++) {
      if (useCrafted && Math.random() < 0.3) {
        pkmItems.push(pickRandomIn(CraftableItems))
      } else {
        pkmItems.push(pickRandomIn(ItemComponents))
      }
    }
    result.push(pkmItems)
  }
  return result
}

function getEncounterTier(act: number, floor: number): number {
  const progress = (act - 1) * 15 + floor
  if (progress <= 3) return 1
  if (progress <= 8) return 2
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

export function getGymLeaderEncounter(index: number): SpireEncounter {
  return GYM_LEADERS[index % GYM_LEADERS.length]
}

export function getEarlyGymLeaderEncounter(index: number): SpireEncounter {
  return EARLY_GYM_LEADERS[index % EARLY_GYM_LEADERS.length]
}

export function getLateGymLeaderEncounter(index: number): SpireEncounter {
  return LATE_GYM_LEADERS[index % LATE_GYM_LEADERS.length]
}

export function getGymLeaderCount(): number {
  return GYM_LEADERS.length
}

export function getEarlyGymLeaderCount(): number {
  return EARLY_GYM_LEADERS.length
}

export function getLateGymLeaderCount(): number {
  return LATE_GYM_LEADERS.length
}

export function getGymLeaderGem(synergy: Synergy): Item {
  const gemName = `${synergy}_GEM`
  if (gemName in Item) {
    return Item[gemName as keyof typeof Item]
  }
  return Item.NORMAL_GEM
}

export function getEliteEncounter(index: number, act: number, floor: number): SpireEncounter {
  const encounters = ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS
  const template = encounters[index % encounters.length]

  if (template.name === "Eeveelution Squad") {
    const count = floor <= 8 ? 3 : floor <= 14 ? 4 : 5
    const eeveelutions = pickNRandomIn(template.pokemon, count)
    const positions: [number, number][] = [[4, 1], [2, 1], [6, 1], [3, 2], [5, 2]]
    const board: [Pkm, number, number][] = eeveelutions.map((pkm, i) =>
      [pkm, positions[i][0], positions[i][1]]
    )
    return { name: template.name, avatar: eeveelutions[0], board }
  }

  if (template.name === "Psychic Circle") {
    const count = floor <= 8 ? 3 : floor <= 14 ? 4 : 5
    const psychics = pickNRandomIn(template.pokemon, count)
    const positions: [number, number][] = [[4, 1], [2, 1], [6, 1], [3, 2], [5, 2]]
    const board: [Pkm, number, number][] = psychics.map((pkm, i) =>
      [pkm, positions[i][0], positions[i][1]]
    )
    return { name: template.name, avatar: psychics[0], board }
  }

  if (template.name === "Rival Flames") {
    const board: [Pkm, number, number][] = [[Pkm.ELECTABUZZ, 3, 2], [Pkm.MAGMAR, 5, 2]]
    if (floor >= 12) {
      board.push([Pkm.ELEKID, 2, 1], [Pkm.MAGBY, 6, 1])
    }
    return { name: template.name, avatar: template.avatar, board }
  }

  return {
    name: template.name,
    avatar: template.avatar,
    board: [...template.board]
  }
}

export function getEliteEncountersForAct(act: number): EliteEncounterTemplate[] {
  return ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS
}

export function getEliteEncounterCount(act: number): number {
  return (ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS).length
}

export function getEliteEncounterPokemon(index: number, act: number): Pkm[] {
  const encounters = ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS
  const template = encounters[index % encounters.length]
  return template.rewards
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

const RARITY_WEIGHT: Record<string, number> = {
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 4,
  EPIC: 8,
  ULTRA: 16,
  UNIQUE: 20,
  LEGENDARY: 30,
  HATCH: 6,
  SPECIAL: 10
}

export interface EncounterStats {
  difficulty: number
  pokemonCount: number
  totalStars: number
  totalItems: number
}

export function calculateEncounterStats(encounter: SpireEncounter): EncounterStats {
  const board = encounter.board
  if (board.length === 0) return { difficulty: 0, pokemonCount: 0, totalStars: 0, totalItems: 0 }

  const typeCounts = new Map<string, number>()
  let totalScore = 0
  let totalStars = 0
  let totalItems = 0

  for (let i = 0; i < board.length; i++) {
    const [pkm] = board[i]
    const data = getPokemonData(pkm)

    totalStars += data.stars
    const itemCount = encounter.items?.[i]?.length ?? 0
    totalItems += itemCount

    const rarityBase = RARITY_WEIGHT[data.rarity] ?? 2
    const starMult = data.stars <= 1 ? 1 : data.stars === 2 ? 2.5 : 5
    const itemMult = 1 + 0.3 * itemCount

    totalScore += rarityBase * starMult * itemMult

    for (const t of data.types) {
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
    }
  }

  let synergyBonus = 0
  typeCounts.forEach((count) => {
    if (count >= 2) synergyBonus += count * 0.5
  })
  totalScore *= (1 + synergyBonus * 0.1)

  if (encounter.bonusHP) totalScore += encounter.bonusHP * 0.1
  if (encounter.bonusAtk) totalScore += encounter.bonusAtk * 2
  if (encounter.bonusAP) totalScore += encounter.bonusAP * 0.5

  return {
    difficulty: Math.round(totalScore),
    pokemonCount: board.length,
    totalStars,
    totalItems
  }
}

export function getGoldReward(nodeType: string, act: number): number {
  switch (nodeType) {
    case "WILD_BATTLE": return 3 + act
    case "ELITE": return 4 + act * 2
    case "GYM_LEADER": return 6 + act * 3
    case "LEGENDARY_BOSS": return 12 + act * 4
    default: return 0
  }
}
