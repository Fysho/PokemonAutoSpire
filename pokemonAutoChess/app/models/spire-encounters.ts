import { RegionDetails } from "../config"
import type { DungeonPMDO } from "../types/enum/Dungeon"
import {
  CraftableItems,
  Item,
  ItemComponentsNoFossilOrScarf,
  NonSpecialBerries,
  Tools
} from "../types/enum/Item"
import { Pkm, PkmFamily } from "../types/enum/Pokemon"
import { Synergy } from "../types/enum/Synergy"
import {
  pickNRandomIn,
  pickRandomIn,
  randomBetween,
  randomFloat
} from "../utils/random"
import {
  getPokemonData,
  PRECOMPUTED_REGIONAL_MONS
} from "./precomputed/precomputed-pokemon-data"
import { precomputedPokemons } from "./precomputed/precomputed-pokemons"
import { PRECOMPUTED_POKEMONS_PER_TYPE } from "./precomputed/precomputed-types"

// ─── Act 3 Item Class System ─────────────────────────────────

type ItemClass = "frontline" | "physical" | "special" | "support"

const FRONTLINE_ITEMS: Item[] = [
  Item.POWER_LENS,
  Item.HEAVY_DUTY_BOOTS,
  Item.STAR_DUST,
  Item.SHINY_CHARM,
  Item.MUSCLE_BAND,
  Item.SAFETY_GOGGLES,
  Item.KINGS_ROCK,
  Item.MAX_REVIVE,
  Item.ASSAULT_VEST,
  Item.SHELL_BELL,
  Item.POKE_DOLL,
  Item.ROCKY_HELMET,
  Item.EXPLOSIVE_BAND,
  Item.TWIST_BAND,
  Item.BIG_EATER_BELT,
  Item.COVER_BAND,
  Item.SMOKE_BALL
]

const PHYSICAL_ITEMS: Item[] = [
  Item.UPGRADE,
  Item.REAPER_CLOTH,
  Item.SCOPE_LENS,
  Item.DEEP_SEA_TOOTH,
  Item.XRAY_VISION,
  Item.RAZOR_FANG,
  Item.LOADED_DICE,
  Item.PUNCHING_GLOVE,
  Item.RAZOR_CLAW,
  Item.PROTECTIVE_PADS,
  Item.RED_ORB,
  Item.FLAME_ORB,
  Item.BLACK_BELT,
  Item.MACH_RIBBON,
  Item.NULLIFY_BANDANNA
]

const SPECIAL_ITEMS: Item[] = [
  Item.CHOICE_SPECS,
  Item.SOUL_DEW,
  Item.POKEMONOMICON,
  Item.AQUA_EGG,
  Item.BLUE_ORB,
  Item.LUCKY_RIBBON,
  Item.WIDE_LENS
]

const SUPPORT_ITEMS: Item[] = [
  Item.ABILITY_SHIELD,
  Item.GREEN_ORB,
  Item.GRACIDEA_FLOWER,
  Item.EFFICIENT_BANDANNA
]

const ITEM_CLASS_POOLS: Record<ItemClass, Item[]> = {
  frontline: FRONTLINE_ITEMS,
  physical: PHYSICAL_ITEMS,
  special: SPECIAL_ITEMS,
  support: SUPPORT_ITEMS
}

const POKEMON_STATS_CACHE = new Map<
  Pkm,
  { atk: number; def: number; speDef: number; range: number }
>()
for (const p of precomputedPokemons) {
  POKEMON_STATS_CACHE.set(p.name, {
    atk: p.atk,
    def: p.def,
    speDef: p.speDef,
    range: p.range
  })
}

function getItemClassForPokemon(pkm: Pkm): ItemClass {
  const stats = POKEMON_STATS_CACHE.get(pkm)
  if (!stats)
    return pickRandomIn([
      "frontline",
      "physical",
      "special",
      "support"
    ] as ItemClass[])

  const { atk, def, speDef, range } = stats
  const frontlineWeight = (def + speDef) * 2 + (range <= 1 ? 5 : 0)
  const physicalWeight = atk * 2 + (range <= 1 ? 8 : 0)
  const specialWeight = (range >= 2 ? 15 : 3) + speDef
  const supportWeight = 4 + (range >= 3 ? 10 : 0)

  const total = frontlineWeight + physicalWeight + specialWeight + supportWeight
  let roll = randomFloat() * total

  roll -= frontlineWeight
  if (roll <= 0) return "frontline"
  roll -= physicalWeight
  if (roll <= 0) return "physical"
  roll -= specialWeight
  if (roll <= 0) return "special"
  return "support"
}

function filterFullyEvolved(pool: Pkm[]): Pkm[] {
  return pool.filter((p) => {
    const data = getPokemonData(p)
    return !data.evolution
  })
}

function generateClassItems(
  board: [Pkm, number, number][],
  mode: DifficultyMode = 1,
  minOverride?: number,
  maxOverride?: number
): Item[][] {
  const maxItems = maxOverride ?? (mode === 0 ? 2 : mode === 3 ? 4 : 3)
  const minItems = minOverride ?? 0
  return board.map(([pkm]) => {
    const count = randomBetween(minItems, maxItems)
    if (count === 0) return []
    const itemClass = getItemClassForPokemon(pkm)
    const pool = ITEM_CLASS_POOLS[itemClass]
    if (count <= pool.length) return pickNRandomIn(pool, count)
    const items: Item[] = []
    while (items.length < count) {
      items.push(pickRandomIn(pool))
    }
    return items
  })
}

export type SpireEncounter = {
  name: string
  avatar: Pkm
  board: [pkm: Pkm, x: number, y: number][]
  items?: Item[][]
  synergy?: Synergy
  bonusHP?: number
  bonusAtk?: number
  bonusDef?: number
  bonusSpeDef?: number
  bonusAP?: number
  bonusPP?: number
  mainBonusHP?: number
  mainBonusAtk?: number
  mainBonusAP?: number
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
      1: [
        [Pkm.GEODUDE, 3, 1],
        [Pkm.GEODUDE, 5, 1]
      ],
      2: [
        [Pkm.GEODUDE, 2, 1],
        [Pkm.GEODUDE, 4, 1],
        [Pkm.GEODUDE, 6, 1]
      ],
      3: [
        [Pkm.GEODUDE, 2, 1],
        [Pkm.GEODUDE, 4, 1],
        [Pkm.GEODUDE, 6, 1],
        [Pkm.GRAVELER, 4, 2]
      ]
    }
  },
  {
    name: "Bug Forest",
    avatar: Pkm.CATERPIE,
    tiers: {
      1: [
        [Pkm.CATERPIE, 3, 1],
        [Pkm.WEEDLE, 5, 1]
      ],
      2: [
        [Pkm.CATERPIE, 2, 1],
        [Pkm.CATERPIE, 4, 1],
        [Pkm.WEEDLE, 6, 1]
      ],
      3: [
        [Pkm.METAPOD, 2, 1],
        [Pkm.METAPOD, 4, 1],
        [Pkm.KAKUNA, 6, 1],
        [Pkm.BUTTERFREE, 4, 2]
      ]
    }
  },
  {
    name: "Water Shore",
    avatar: Pkm.MAGIKARP,
    tiers: {
      1: [
        [Pkm.MAGIKARP, 3, 1],
        [Pkm.MAGIKARP, 5, 1]
      ],
      2: [
        [Pkm.MAGIKARP, 2, 1],
        [Pkm.MAGIKARP, 4, 1],
        [Pkm.POLIWAG, 6, 1]
      ],
      3: [
        [Pkm.MAGIKARP, 2, 1],
        [Pkm.POLIWAG, 4, 1],
        [Pkm.POLIWAG, 6, 1],
        [Pkm.POLIWHIRL, 4, 2]
      ]
    }
  },
  {
    name: "Grass Meadow",
    avatar: Pkm.ODDISH,
    tiers: {
      1: [
        [Pkm.ODDISH, 3, 1],
        [Pkm.ODDISH, 5, 1]
      ],
      2: [
        [Pkm.ODDISH, 2, 1],
        [Pkm.ODDISH, 4, 1],
        [Pkm.BELLSPROUT, 6, 1]
      ],
      3: [
        [Pkm.ODDISH, 2, 1],
        [Pkm.GLOOM, 4, 2],
        [Pkm.BELLSPROUT, 6, 1],
        [Pkm.WEEPINBELL, 3, 2]
      ]
    }
  },
  {
    name: "Rat Pack",
    avatar: Pkm.RATTATA,
    tiers: {
      1: [
        [Pkm.RATTATA, 3, 1],
        [Pkm.RATTATA, 5, 1]
      ],
      2: [
        [Pkm.RATTATA, 2, 1],
        [Pkm.RATTATA, 4, 1],
        [Pkm.RATTATA, 6, 1]
      ],
      3: [
        [Pkm.RATICATE, 3, 1],
        [Pkm.RATICATE, 5, 1],
        [Pkm.RATTATA, 2, 1],
        [Pkm.RATTATA, 6, 1]
      ]
    }
  },
  {
    name: "Fire Mountain",
    avatar: Pkm.VULPIX,
    tiers: {
      1: [
        [Pkm.VULPIX, 3, 1],
        [Pkm.GROWLITHE, 5, 1]
      ],
      2: [
        [Pkm.VULPIX, 2, 1],
        [Pkm.VULPIX, 4, 1],
        [Pkm.GROWLITHE, 6, 1]
      ],
      3: [
        [Pkm.NINETALES, 4, 2],
        [Pkm.VULPIX, 2, 1],
        [Pkm.GROWLITHE, 6, 1],
        [Pkm.GROWLITHE, 3, 1]
      ]
    }
  },
  {
    name: "Ghost Tower",
    avatar: Pkm.GASTLY,
    tiers: {
      1: [
        [Pkm.GASTLY, 3, 1],
        [Pkm.GASTLY, 5, 1]
      ],
      2: [
        [Pkm.GASTLY, 2, 1],
        [Pkm.GASTLY, 4, 1],
        [Pkm.GASTLY, 6, 1]
      ],
      3: [
        [Pkm.HAUNTER, 3, 2],
        [Pkm.GASTLY, 2, 1],
        [Pkm.GASTLY, 5, 1],
        [Pkm.HAUNTER, 6, 2]
      ]
    }
  },
  {
    name: "Electric Field",
    avatar: Pkm.PICHU,
    tiers: {
      1: [
        [Pkm.PICHU, 3, 1],
        [Pkm.PICHU, 5, 1]
      ],
      2: [
        [Pkm.PICHU, 2, 1],
        [Pkm.PIKACHU, 4, 1],
        [Pkm.PICHU, 6, 1]
      ],
      3: [
        [Pkm.PIKACHU, 3, 1],
        [Pkm.PIKACHU, 5, 1],
        [Pkm.PICHU, 2, 1],
        [Pkm.PICHU, 6, 1]
      ]
    }
  }
]

// Gym leader signature Pokemon by synergy type
const GYM_LEADER_POKEMON: Partial<Record<Synergy, Pkm[]>> = {
  [Synergy.ROCK]: [
    Pkm.GEODUDE,
    Pkm.GRAVELER,
    Pkm.GOLEM,
    Pkm.ONIX,
    Pkm.STEELIX,
    Pkm.TYRANITAR,
    Pkm.GIGALITH,
    Pkm.LYCANROC_DAY,
    Pkm.BOLDORE
  ],
  [Synergy.WATER]: [
    Pkm.STARYU,
    Pkm.STARMIE,
    Pkm.GYARADOS,
    Pkm.LAPRAS,
    Pkm.MILOTIC,
    Pkm.QUAGSIRE,
    Pkm.LUDICOLO,
    Pkm.WHISCASH,
    Pkm.KINGDRA,
    Pkm.POLIWAG,
    Pkm.POLIWHIRL,
    Pkm.POLIWRATH
  ],
  [Synergy.ELECTRIC]: [
    Pkm.PICHU,
    Pkm.PIKACHU,
    Pkm.RAICHU,
    Pkm.ELECTRODE,
    Pkm.ELECTABUZZ,
    Pkm.JOLTEON,
    Pkm.LUXRAY,
    Pkm.LUXIO,
    Pkm.SHINX,
    Pkm.MAGNEZONE,
    Pkm.MAGNETON,
    Pkm.MAGNEMITE,
    Pkm.VOLTORB
  ],
  [Synergy.GRASS]: [
    Pkm.ODDISH,
    Pkm.GLOOM,
    Pkm.VILEPLUME,
    Pkm.BELLSPROUT,
    Pkm.WEEPINBELL,
    Pkm.VICTREEBEL,
    Pkm.VENUSAUR,
    Pkm.ROSERADE,
    Pkm.TANGROWTH,
    Pkm.TANGELA
  ],
  [Synergy.FIRE]: [
    Pkm.VULPIX,
    Pkm.NINETALES,
    Pkm.GROWLITHE,
    Pkm.ARCANINE,
    Pkm.MAGMAR,
    Pkm.TORKOAL,
    Pkm.SLUGMA,
    Pkm.MAGCARGO,
    Pkm.NUMEL,
    Pkm.BLAZIKEN,
    Pkm.INFERNAPE
  ],
  [Synergy.GHOST]: [
    Pkm.GASTLY,
    Pkm.HAUNTER,
    Pkm.GENGAR,
    Pkm.MISDREAVUS,
    Pkm.MISMAGIUS,
    Pkm.DRIFBLIM,
    Pkm.CHANDELURE,
    Pkm.DUSKULL,
    Pkm.DUSCLOPS,
    Pkm.SPIRITOMB
  ],
  [Synergy.FIGHTING]: [
    Pkm.MACHOP,
    Pkm.MACHOKE,
    Pkm.MACHAMP,
    Pkm.LUCARIO,
    Pkm.POLIWRATH,
    Pkm.PRIMEAPE,
    Pkm.HITMONLEE,
    Pkm.HITMONCHAN,
    Pkm.GALLADE
  ],
  [Synergy.PSYCHIC]: [
    Pkm.ABRA,
    Pkm.KADABRA,
    Pkm.ALAKAZAM,
    Pkm.GARDEVOIR,
    Pkm.GALLADE,
    Pkm.METAGROSS,
    Pkm.RALTS,
    Pkm.KIRLIA,
    Pkm.DROWZEE
  ],
  [Synergy.POISON]: [
    Pkm.KOFFING,
    Pkm.WEEZING,
    Pkm.GRIMER,
    Pkm.MUK,
    Pkm.CROBAT,
    Pkm.TOXICROAK,
    Pkm.SCOLIPEDE,
    Pkm.NIDOKING,
    Pkm.NIDOQUEEN
  ],
  [Synergy.DRAGON]: [
    Pkm.DRATINI,
    Pkm.DRAGONAIR,
    Pkm.DRAGONITE,
    Pkm.GARCHOMP,
    Pkm.SALAMENCE,
    Pkm.KINGDRA,
    Pkm.HAXORUS,
    Pkm.HYDREIGON,
    Pkm.GIBLE,
    Pkm.GABITE
  ],
  [Synergy.DARK]: [
    Pkm.WEAVILE,
    Pkm.ABSOL,
    Pkm.HONCHKROW,
    Pkm.UMBREON,
    Pkm.DRAPION,
    Pkm.SPIRITOMB,
    Pkm.BISHARP
  ],
  [Synergy.STEEL]: [
    Pkm.STEELIX,
    Pkm.SCIZOR,
    Pkm.MAGNEMITE,
    Pkm.MAGNETON,
    Pkm.MAGNEZONE,
    Pkm.FORRETRESS,
    Pkm.EMPOLEON,
    Pkm.METAGROSS
  ],
  [Synergy.ICE]: [
    Pkm.MAMOSWINE,
    Pkm.FROSLASS,
    Pkm.GLACEON,
    Pkm.ABOMASNOW,
    Pkm.WALREIN,
    Pkm.LAPRAS,
    Pkm.SNORUNT,
    Pkm.GLALIE,
    Pkm.SWINUB,
    Pkm.PILOSWINE
  ],
  [Synergy.GROUND]: [
    Pkm.RHYHORN,
    Pkm.RHYDON,
    Pkm.RHYPERIOR,
    Pkm.FLYGON,
    Pkm.EXCADRILL,
    Pkm.DUGTRIO,
    Pkm.NIDOKING,
    Pkm.GIBLE,
    Pkm.GABITE,
    Pkm.GARCHOMP
  ],
  [Synergy.FLYING]: [
    Pkm.PIDGEOT,
    Pkm.STARAPTOR,
    Pkm.SKARMORY,
    Pkm.ALTARIA,
    Pkm.SWELLOW,
    Pkm.SWABLU,
    Pkm.TAILLOW,
    Pkm.DRIFBLIM,
    Pkm.CROBAT
  ],
  [Synergy.FAIRY]: [
    Pkm.CLEFABLE,
    Pkm.TOGEKISS,
    Pkm.MIMIKYU,
    Pkm.MAWILE,
    Pkm.SYLVEON,
    Pkm.CLEFAIRY,
    Pkm.TOGEPI,
    Pkm.TOGETIC,
    Pkm.GARDEVOIR
  ],
  [Synergy.NORMAL]: [
    Pkm.SLAKOTH,
    Pkm.VIGOROTH,
    Pkm.SLAKING,
    Pkm.SNORLAX,
    Pkm.CHANSEY,
    Pkm.BLISSEY,
    Pkm.AMBIPOM,
    Pkm.RATTATA,
    Pkm.RATICATE
  ],
  [Synergy.BUG]: [
    Pkm.SCIZOR,
    Pkm.FORRETRESS,
    Pkm.SCOLIPEDE,
    Pkm.CATERPIE,
    Pkm.METAPOD,
    Pkm.BUTTERFREE,
    Pkm.WEEDLE,
    Pkm.KAKUNA,
    Pkm.BEEDRILL
  ],
  [Synergy.FIELD]: [
    Pkm.LILLIPUP,
    Pkm.HERDIER,
    Pkm.STOUTLAND,
    Pkm.SKITTY,
    Pkm.DELCATTY,
    Pkm.EEVEE,
    Pkm.ZIGZAGOON,
    Pkm.LINOONE
  ],
  [Synergy.AQUATIC]: [
    Pkm.POLIWAG,
    Pkm.POLIWHIRL,
    Pkm.POLIWRATH,
    Pkm.WOOPER,
    Pkm.QUAGSIRE,
    Pkm.TENTACOOL,
    Pkm.TENTACRUEL,
    Pkm.BIDOOF,
    Pkm.BIBAREL
  ],
  [Synergy.MONSTER]: [
    Pkm.ARON,
    Pkm.LAIRON,
    Pkm.AGGRON,
    Pkm.TURTWIG,
    Pkm.GROTLE,
    Pkm.TORTERRA,
    Pkm.BAGON,
    Pkm.SHELGON,
    Pkm.SANDILE,
    Pkm.KROKOROK
  ],
  // [Synergy.AMORPHOUS]: [Pkm.METAPOD, Pkm.SCATTERBUG, Pkm.SPEWPA, Pkm.GRIMER, Pkm.MUK, Pkm.SANDYGAST, Pkm.PALOSSAND],
  [Synergy.WILD]: [
    Pkm.RATTATA,
    Pkm.RATICATE,
    Pkm.SPEAROW,
    Pkm.FEAROW,
    Pkm.AIPOM,
    Pkm.AMBIPOM
  ],
  [Synergy.SOUND]: [
    Pkm.ZUBAT,
    Pkm.GOLBAT,
    Pkm.CROBAT,
    Pkm.IGGLYBUFF,
    Pkm.JIGGLYPUFF,
    Pkm.WIGGLYTUFF,
    Pkm.WHISMUR,
    Pkm.LOUDRED
  ],
  [Synergy.FLORA]: [
    Pkm.SPRIGATITO,
    Pkm.FLORAGATO,
    Pkm.BULBASAUR,
    Pkm.IVYSAUR,
    Pkm.VENUSAUR,
    Pkm.SUNKERN,
    Pkm.SUNFLORA
  ],
  [Synergy.BABY]: [
    Pkm.PICHU,
    Pkm.AZURILL,
    Pkm.IGGLYBUFF,
    Pkm.CLEFFA,
    Pkm.TOGEPI,
    Pkm.RIOLU
  ],
  [Synergy.HUMAN]: [
    Pkm.FENNEKIN,
    Pkm.BRAIXEN,
    Pkm.MACHOP,
    Pkm.MACHOKE,
    Pkm.MACHAMP,
    Pkm.CHIMCHAR,
    Pkm.MONFERNO,
    Pkm.INFERNAPE,
    Pkm.PETILIL
  ],
  // [Synergy.LIGHT]: [Pkm.MAREEP, Pkm.FLAFFY, Pkm.AMPHAROS, Pkm.LITWICK, Pkm.LAMPENT, Pkm.CHANDELURE, Pkm.CHINCHOU, Pkm.LANTURN, Pkm.ROGGENROLA, Pkm.BOLDORE],
  // [Synergy.GOURMET]: [Pkm.SMOLIV, Pkm.DOLLIV, Pkm.ARBOLIVA, Pkm.LICKITUNG, Pkm.LICKILICKY, Pkm.MUNCHLAX, Pkm.NACLI, Pkm.NACLSTACK, Pkm.GARGANACL],
  // [Synergy.ARTIFICIAL]: [Pkm.KLINK, Pkm.KLANG, Pkm.KLINKLANG, Pkm.VOLTORB, Pkm.ELECTRODE, Pkm.VAROOM, Pkm.REVAVROOM, Pkm.KOFFING, Pkm.WEEZING],
  [Synergy.FOSSIL]: [
    Pkm.KABUTO,
    Pkm.KABUTOPS,
    Pkm.OMANYTE,
    Pkm.OMASTAR,
    Pkm.ANORITH,
    Pkm.ARMALDO,
    Pkm.CRANIDOS,
    Pkm.RAMPARDOS
  ]
}

const GYM_SYNERGIES: Synergy[] = Object.keys(GYM_LEADER_POKEMON) as Synergy[]

const GYM_LEADER_NAMES: Partial<Record<Synergy, string[]>> = {
  [Synergy.ROCK]: ["Brock", "Roxanne", "Roark", "Grant"],
  [Synergy.WATER]: ["Misty", "Wallace", "Crasher Wake", "Nessa"],
  [Synergy.ELECTRIC]: ["Lt. Surge", "Wattson", "Volkner", "Elesa"],
  [Synergy.GRASS]: ["Erika", "Gardenia", "Ramos", "Milo"],
  [Synergy.FIRE]: ["Blaine", "Flannery", "Kabu"],
  [Synergy.GHOST]: ["Morty", "Fantina", "Allister"],
  [Synergy.FIGHTING]: ["Chuck", "Brawly", "Maylene", "Korrina"],
  [Synergy.PSYCHIC]: ["Sabrina", "Tate & Liza", "Olympia"],
  [Synergy.POISON]: ["Koga", "Janine", "Roxie", "Klara"],
  [Synergy.DRAGON]: ["Clair", "Drayden", "Raihan"],
  [Synergy.DARK]: ["Karen", "Sidney", "Grimsley", "Marnie"],
  [Synergy.STEEL]: ["Jasmine", "Byron", "Peony"],
  [Synergy.ICE]: ["Pryce", "Candice", "Wulfric", "Melony"],
  [Synergy.GROUND]: ["Giovanni", "Clay", "Bertha"],
  [Synergy.FLYING]: ["Winona", "Falkner", "Skyla"],
  [Synergy.FAIRY]: ["Valerie", "Opal", "Bede"],
  [Synergy.NORMAL]: ["Norman", "Whitney", "Lenora", "Cheren"],
  [Synergy.BUG]: ["Bugsy", "Burgh", "Viola"],
  [Synergy.FIELD]: ["Field Gym"],
  [Synergy.AQUATIC]: ["Aquatic Gym"],
  [Synergy.MONSTER]: ["Monster Gym"],
  // [Synergy.AMORPHOUS]: ["Amorphous Gym"],
  [Synergy.WILD]: ["Wild Gym"],
  [Synergy.SOUND]: ["Sound Gym"],
  [Synergy.FLORA]: ["Flora Gym"],
  [Synergy.BABY]: ["Baby Gym"],
  [Synergy.HUMAN]: ["Human Gym"],
  // [Synergy.LIGHT]: ["Light Gym"],
  // [Synergy.GOURMET]: ["Gourmet Gym"],
  // [Synergy.ARTIFICIAL]: ["Artificial Gym"],
  [Synergy.FOSSIL]: ["Fossil Gym"]
}

// ─── Adding a new Elite Encounter ───────────────────────────────
// 1. Add the template to the appropriate ACT*_ELITE_ENCOUNTERS array below.
//    - `mainPokemon`: appears on the map icon and gets a dojo ticket (BRONZE/SILVER/GOLD by act).
//    - `validPicks`: pool of pokemon to fill remaining slots via star budget. Repeats allowed.
// 2. Team is proc-gen'd: mainPokemon + validPicks fill to difficulty's pokemonCount using star budget.
//    Positioning uses range-based rows (melee front, ranged back), same as wild encounters.
// 3. Create a map-node sprite for the mainPokemon:
//    - Open the spritesheet JSON at app/public/src/assets/pokemons/<PkmIndex>.json
//    - Find frame "Normal/Idle/Anim/7/0001" (direction 7 = southwest / down-left)
//    - Extract that frame, place it on a transparent canvas at sourceSize, scale 2x
//    - Save as app/public/src/assets/ui/elite-sprites-v2/<PkmIndex>.png
//    - ALSO copy to app/public/dist/client/assets/ui/elite-sprites-v2/<PkmIndex>.png
//      (esbuild does not copy assets to dist; both locations are required)

export type EliteEncounterTemplate = {
  name: string
  mainPokemon: Pkm
  validPicks: Pkm[]
}

type UnlockEncounterTemplate = {
  name: string
  avatar: Pkm
  pokemon: Pkm[]
  rewards: Pkm[]
  board: [pkm: Pkm, x: number, y: number][]
  eliteType?: "legendary" | "unique" | "hatch"
}

// Act 1: Baby/basic Pokemon fights
const ACT1_ELITE_ENCOUNTERS: EliteEncounterTemplate[] = [
  {
    name: "Eeveelution Squad",
    mainPokemon: Pkm.EEVEE,
    validPicks: [
      Pkm.VAPOREON,
      Pkm.JOLTEON,
      Pkm.FLAREON,
      Pkm.ESPEON,
      Pkm.UMBREON,
      Pkm.LEAFEON,
      Pkm.GLACEON,
      Pkm.SYLVEON
    ]
  },
  {
    name: "Psychic Circle",
    mainPokemon: Pkm.KADABRA,
    validPicks: [Pkm.KIRLIA, Pkm.DROWZEE, Pkm.MR_MIME, Pkm.JYNX]
  },
  {
    name: "Rival Flames",
    mainPokemon: Pkm.ELECTABUZZ,
    validPicks: [Pkm.MAGMAR, Pkm.ELEKID, Pkm.MAGBY]
  },
  {
    name: "Bat Cave",
    mainPokemon: Pkm.GOLBAT,
    validPicks: [Pkm.WOOBAT, Pkm.SWOOBAT, Pkm.NOIBAT, Pkm.ZUBAT]
  },
  {
    name: "Rock Tunnel",
    mainPokemon: Pkm.LAIRON,
    validPicks: [Pkm.GRAVELER, Pkm.ONIX, Pkm.ARON, Pkm.GEODUDE]
  }
]

// Act 2: Mid evolutions
const ACT2_ELITE_ENCOUNTERS: EliteEncounterTemplate[] = [
  {
    name: "Iron Defense",
    mainPokemon: Pkm.METAGROSS,
    validPicks: [Pkm.AGGRON, Pkm.LUCARIO, Pkm.SCIZOR]
  },
  {
    name: "Psychic Conclave",
    mainPokemon: Pkm.ALAKAZAM,
    validPicks: [Pkm.GARDEVOIR, Pkm.DELPHOX, Pkm.HYPNO]
  },
  {
    name: "Sleeping Giant",
    mainPokemon: Pkm.SNORLAX,
    validPicks: [Pkm.SLAKING]
  },
  {
    name: "Poltergeist",
    mainPokemon: Pkm.ROTOM,
    validPicks: [
      Pkm.ROTOM_WASH,
      Pkm.ROTOM_HEAT,
      Pkm.ROTOM_FROST,
      Pkm.ROTOM_FAN,
      Pkm.ROTOM_MOW,
      Pkm.ROTOM_DRONE
    ]
  },
  {
    name: "Dark Omen",
    mainPokemon: Pkm.DARKRAI,
    validPicks: [Pkm.ABSOL, Pkm.SPIRITOMB, Pkm.MEGA_SABLEYE]
  },
  {
    name: "Masquerade",
    mainPokemon: Pkm.MIMIKYU,
    validPicks: [Pkm.ZOROARK, Pkm.DITTO, Pkm.MEOWSCARADA]
  },
  {
    name: "Cursed Grotto",
    mainPokemon: Pkm.HOUNDOOM,
    validPicks: [
      Pkm.BANETTE,
      Pkm.GRAVELER,
      Pkm.BOLDORE,
      Pkm.LAIRON,
      Pkm.PUPITAR
    ]
  }
]

// Act 3: Fully evolved
const ACT3_ELITE_ENCOUNTERS: EliteEncounterTemplate[] = [
  {
    name: "Dragon's Den",
    mainPokemon: Pkm.SALAMENCE,
    validPicks: [
      Pkm.GARCHOMP,
      Pkm.DRAGONITE,
      Pkm.FLYGON,
      Pkm.GOODRA,
      Pkm.CHARIZARD,
      Pkm.KINGDRA,
      Pkm.HYDREIGON
    ]
  },
  {
    name: "Tyrant's Court",
    mainPokemon: Pkm.TYRANITAR,
    validPicks: [
      Pkm.AERODACTYL,
      Pkm.GOLEM,
      Pkm.AGGRON,
      Pkm.RHYPERIOR,
      Pkm.STEELIX
    ]
  },
  {
    name: "Celestial Court",
    mainPokemon: Pkm.TOGEKISS,
    validPicks: [
      Pkm.GARDEVOIR,
      Pkm.FLORGES,
      Pkm.CLEFABLE,
      Pkm.SYLVEON,
      Pkm.AZUMARILL,
      Pkm.WIGGLYTUFF,
      Pkm.GRANBULL,
      Pkm.PRIMARINA,
      Pkm.HATTERENE
    ]
  },
  {
    name: "Mother's Fury",
    mainPokemon: Pkm.KANGASKHAN,
    validPicks: [Pkm.BLISSEY, Pkm.MAUSHOLD_FOUR]
  },
  {
    name: "Luchador Ring",
    mainPokemon: Pkm.HAWLUCHA,
    validPicks: [Pkm.TAUROS, Pkm.KANGASKHAN]
  },
  {
    name: "Weather Report",
    mainPokemon: Pkm.CASTFORM,
    validPicks: [Pkm.CASTFORM_SUN, Pkm.CASTFORM_RAIN, Pkm.CASTFORM_HAIL]
  }
]

const LEGENDARY_ELITE_ENCOUNTERS: UnlockEncounterTemplate[] = [
  Pkm.KYUREM,
  Pkm.RESHIRAM,
  Pkm.ZEKROM,
  Pkm.STAKATAKA,
  Pkm.GENESECT,
  Pkm.GUZZLORD,
  Pkm.ETERNATUS,
  Pkm.MELOETTA,
  Pkm.MEW,
  Pkm.MEWTWO,
  Pkm.ENTEI,
  Pkm.SUICUNE,
  Pkm.RAIKOU,
  Pkm.REGIDRAGO,
  Pkm.REGIELEKI,
  Pkm.REGICE,
  Pkm.REGISTEEL,
  Pkm.REGIROCK,
  Pkm.REGIGIGAS,
  Pkm.CELEBI,
  Pkm.VICTINI,
  Pkm.JIRACHI,
  Pkm.ARCEUS,
  Pkm.DEOXYS,
  Pkm.SHAYMIN,
  Pkm.GIRATINA,
  Pkm.DARKRAI,
  Pkm.CRESSELIA,
  Pkm.HEATRAN,
  Pkm.LUGIA,
  Pkm.HO_OH,
  Pkm.PALKIA,
  Pkm.DIALGA,
  Pkm.RAYQUAZA,
  Pkm.KYOGRE,
  Pkm.GROUDON,
  Pkm.VOLCANION,
  Pkm.MARSHADOW,
  Pkm.TYPE_NULL,
  Pkm.XERNEAS,
  Pkm.YVELTAL,
  Pkm.ZAPDOS,
  Pkm.MOLTRES,
  Pkm.ARTICUNO,
  Pkm.SPECTRIER,
  Pkm.GLASTRIER,
  Pkm.KARTANA,
  Pkm.NECROZMA,
  Pkm.XURKITREE,
  Pkm.NIHILEGO,
  Pkm.PHEROMOSA,
  Pkm.BUZZWOLE,
  Pkm.TORNADUS,
  Pkm.THUNDURUS,
  Pkm.LANDORUS,
  Pkm.ENAMORUS,
  Pkm.MAGEARNA,
  Pkm.MELMETAL,
  Pkm.ZYGARDE_50,
  Pkm.TERRAKION,
  Pkm.VIRIZION,
  Pkm.COBALION,
  Pkm.KELDEO,
  Pkm.PECHARUNT,
  Pkm.ROARING_MOON,
  Pkm.ZACIAN,
  Pkm.IRON_VALIANT,
  Pkm.OKIDOGI,
  Pkm.MUNKIDORI,
  Pkm.FEZANDIPITI,
  Pkm.CELESTEELA,
  Pkm.OGERPON_TEAL,
  Pkm.OGERPON_WELLSPRING,
  Pkm.OGERPON_HEARTHFLAME,
  Pkm.OGERPON_CORNERSTONE,
  Pkm.MANAPHY,
  Pkm.CHI_YU,
  Pkm.BLACEPHALON
].map((pkm) => ({
  name: getPokemonData(pkm).name.replace(/_/g, " "),
  avatar: pkm,
  pokemon: [],
  rewards: [],
  board: [],
  eliteType: "legendary" as const
}))

const UNIQUE_ELITE_ENCOUNTERS: UnlockEncounterTemplate[] = [
  Pkm.ABSOL,
  Pkm.AERODACTYL,
  Pkm.APPLIN,
  Pkm.ARCTOVISH,
  Pkm.ARCTOZOLT,
  Pkm.AUDINO,
  Pkm.AZELF,
  Pkm.BASCULIN_WHITE,
  Pkm.BRUXISH,
  Pkm.CARNIVINE,
  Pkm.CASTFORM,
  Pkm.CHARCADET,
  Pkm.CHATOT,
  Pkm.CHINGLING,
  Pkm.COMFEY,
  Pkm.COSMOG,
  Pkm.CRAMORANT,
  Pkm.CRYOGONAL,
  Pkm.CYCLIZAR,
  Pkm.DEDENNE,
  Pkm.DELIBIRD,
  Pkm.DHELMISE,
  Pkm.DONDOZO,
  Pkm.DRACOVISH,
  Pkm.DRACOZOLT,
  Pkm.DRAMPA,
  Pkm.DRUDDIGON,
  Pkm.DUNSPARCE,
  Pkm.DURALUDON,
  Pkm.DURANT,
  Pkm.EISCUE_NOICE,
  Pkm.EMOLGA,
  Pkm.FALINKS_BRASS,
  Pkm.FARFETCH_D,
  Pkm.FINIZEN,
  Pkm.FLUTTER_MANE,
  Pkm.FURFROU,
  Pkm.GALARIAN_FARFETCH_D,
  Pkm.GIMMIGHOUL,
  Pkm.GREAT_TUSK,
  Pkm.HAWLUCHA,
  Pkm.HEATMOR,
  Pkm.HERACROSS,
  Pkm.HISUIAN_QWILFISH,
  Pkm.HOOPA,
  Pkm.IRON_BUNDLE,
  Pkm.IRON_HANDS,
  Pkm.IRON_THORNS,
  Pkm.KANGASKHAN,
  Pkm.KLEFKI,
  Pkm.KOMALA,
  Pkm.KUBFU,
  Pkm.LAPRAS,
  Pkm.LUNATONE,
  Pkm.LUVDISC,
  Pkm.MANTYKE,
  Pkm.MARACTUS,
  Pkm.MAWILE,
  Pkm.MESPRIT,
  Pkm.MILCERY,
  Pkm.MILTANK,
  Pkm.MIMIKYU,
  Pkm.MINIOR,
  Pkm.MORPEKO,
  Pkm.ORTHWORM,
  Pkm.PACHIRISU,
  Pkm.PINCURCHIN,
  Pkm.PINSIR,
  Pkm.POIPOLE,
  Pkm.PYUKUMUKU,
  Pkm.QWILFISH,
  Pkm.RELICANTH,
  Pkm.ROTOM,
  Pkm.SABLEYE,
  Pkm.SCREAM_TAIL,
  Pkm.SCYTHER,
  Pkm.SEVIPER,
  Pkm.SHUCKLE,
  Pkm.SIGILYPH,
  Pkm.SKARMORY,
  Pkm.SLITHER_WING,
  Pkm.SMEARGLE,
  Pkm.SOLROCK,
  Pkm.SPINDA,
  Pkm.SPIRITOMB,
  Pkm.STANTLER,
  Pkm.STONJOURNER,
  Pkm.TANDEMAUS,
  Pkm.TAPU_BULU,
  Pkm.TAPU_FINI,
  Pkm.TAPU_KOKO,
  Pkm.TAPU_LELE,
  Pkm.TAUROS,
  Pkm.TOGEDEMARU,
  Pkm.TORKOAL,
  Pkm.TROPIUS,
  Pkm.TURTONATOR,
  Pkm.TYROGUE,
  Pkm.UXIE,
  Pkm.VELUZA,
  Pkm.ZANGOOSE,
  Pkm.ZERAORA
].map((pkm) => ({
  name: getPokemonData(pkm).name.replace(/_/g, " "),
  avatar: pkm,
  pokemon: [],
  rewards: [],
  board: [],
  eliteType: "unique" as const
}))

const HATCH_BASES: Pkm[] = [
  Pkm.TYMPOLE,
  Pkm.AXEW,
  Pkm.DREEPY,
  Pkm.SNIVY,
  Pkm.SCORBUNNY,
  Pkm.POPPLIO,
  Pkm.GOTHITA,
  Pkm.ROWLET,
  Pkm.FROAKIE,
  Pkm.TEPIG,
  Pkm.GRUBBIN,
  Pkm.SCATTERBUG,
  Pkm.SANDILE
]

const HATCH_EVOLUTIONS: Partial<Record<Pkm, Pkm>> = {
  [Pkm.TYMPOLE]: Pkm.PALPITOAD,
  [Pkm.AXEW]: Pkm.FRAXURE,
  [Pkm.DREEPY]: Pkm.DRAKLOAK,
  [Pkm.SNIVY]: Pkm.SERVINE,
  [Pkm.SCORBUNNY]: Pkm.RABOOT,
  [Pkm.POPPLIO]: Pkm.BRIONNE,
  [Pkm.GOTHITA]: Pkm.GOTHORITA,
  [Pkm.ROWLET]: Pkm.DARTIX,
  [Pkm.FROAKIE]: Pkm.FROGADIER,
  [Pkm.TEPIG]: Pkm.PIGNITE,
  [Pkm.GRUBBIN]: Pkm.CHARJABUG,
  [Pkm.SCATTERBUG]: Pkm.SPEWPA,
  [Pkm.SANDILE]: Pkm.KROKOROK
}

const HATCH_UNLOCK_ENCOUNTERS: UnlockEncounterTemplate[] = HATCH_BASES.map(
  (pkm) => ({
    name: getPokemonData(pkm).name.replace(/_/g, " "),
    avatar: pkm,
    pokemon: [],
    rewards: [pkm],
    board: [],
    eliteType: "hatch" as const
  })
)

const ELITE_ENCOUNTERS_BY_ACT: { [act: number]: EliteEncounterTemplate[] } = {
  1: ACT1_ELITE_ENCOUNTERS,
  2: ACT2_ELITE_ENCOUNTERS,
  3: ACT3_ELITE_ENCOUNTERS
}

const UNLOCK_ENCOUNTERS_BY_ACT: { [act: number]: UnlockEncounterTemplate[] } = {
  1: HATCH_UNLOCK_ENCOUNTERS,
  2: UNIQUE_ELITE_ENCOUNTERS,
  3: LEGENDARY_ELITE_ENCOUNTERS
}

const LEGENDARY_BOSSES: { [act: number]: SpireEncounter[] } = {
  1: [
    {
      name: "Mewtwo & Mew",
      avatar: Pkm.MEWTWO,
      board: [
        [Pkm.MEWTWO, 4, 3],
        [Pkm.MEW, 2, 2]
      ],
      items: [[Item.CHOICE_SPECS], [Item.SHELL_BELL]],
      bonusHP: 100,
      bonusAtk: 5,
      bonusAP: 20
    },
    {
      name: "Tower Duo",
      avatar: Pkm.LUGIA,
      board: [
        [Pkm.LUGIA, 3, 3],
        [Pkm.HO_OH, 5, 3]
      ],
      items: [[Item.AQUA_EGG], [Item.SHELL_BELL]],
      bonusHP: 100,
      bonusAtk: 5,
      bonusAP: 20
    },
    {
      name: "Lake Guardians",
      avatar: Pkm.AZELF,
      board: [
        [Pkm.AZELF, 2, 2],
        [Pkm.MESPRIT, 4, 3],
        [Pkm.UXIE, 6, 2]
      ],
      items: [[Item.CHOICE_SPECS], [Item.SOUL_DEW], [Item.POWER_LENS]],
      bonusHP: 100,
      bonusAtk: 5,
      bonusAP: 20
    }
  ],
  2: [
    {
      name: "Weather Trio",
      avatar: Pkm.MEGA_RAYQUAZA,
      board: [
        [Pkm.PRIMAL_GROUDON, 2, 2],
        [Pkm.PRIMAL_KYOGRE, 6, 2],
        [Pkm.MEGA_RAYQUAZA, 4, 3]
      ],
      items: [
        [Item.RED_ORB, Item.ROCKY_HELMET, Item.ASSAULT_VEST],
        [Item.BLUE_ORB, Item.SHELL_BELL, Item.POWER_LENS],
        [Item.GREEN_ORB, Item.SCOPE_LENS, Item.RAZOR_FANG]
      ],
      bonusHP: 200,
      bonusAtk: 10,
      bonusAP: 40
    },
    {
      name: "Legendary Birds",
      avatar: Pkm.ARTICUNO,
      board: [
        [Pkm.ARTICUNO, 2, 3],
        [Pkm.ZAPDOS, 4, 3],
        [Pkm.MOLTRES, 6, 3]
      ],
      items: [
        [Item.ICY_ROCK, Item.SHELL_BELL],
        [Item.CHOICE_SPECS, Item.WIDE_LENS],
        [Item.FLAME_ORB, Item.SACRED_ASH]
      ],
      bonusHP: 200,
      bonusAtk: 10,
      bonusAP: 40
    },
    {
      name: "Beasts & Blade",
      avatar: Pkm.ZACIAN_CROWNED,
      board: [
        [Pkm.RAIKOU, 2, 2],
        [Pkm.ENTEI, 4, 1],
        [Pkm.SUICUNE, 6, 2],
        [Pkm.ZACIAN_CROWNED, 4, 3]
      ],
      items: [
        [Item.CHOICE_SPECS, Item.WIDE_LENS],
        [Item.FLAME_ORB, Item.ASSAULT_VEST],
        [Item.STAR_DUST, Item.SHELL_BELL],
        [Item.RUSTED_SWORD, Item.RAZOR_CLAW]
      ],
      bonusHP: 200,
      bonusAtk: 10,
      bonusAP: 40
    }
  ],
  3: [
    {
      name: "Weather Trio",
      avatar: Pkm.MEGA_RAYQUAZA,
      board: [
        [Pkm.PRIMAL_GROUDON, 2, 2],
        [Pkm.PRIMAL_KYOGRE, 6, 2],
        [Pkm.MEGA_RAYQUAZA, 4, 3]
      ],
      items: [
        [Item.RED_ORB, Item.ROCKY_HELMET, Item.ASSAULT_VEST],
        [Item.BLUE_ORB, Item.SHELL_BELL, Item.POWER_LENS],
        [Item.GREEN_ORB, Item.SCOPE_LENS, Item.RAZOR_FANG]
      ],
      bonusHP: 1200,
      bonusAtk: 15,
      bonusAP: 50
    },
    {
      name: "Creation Trio",
      avatar: Pkm.GIRATINA,
      board: [
        [Pkm.DIALGA, 2, 3],
        [Pkm.PALKIA, 6, 3],
        [Pkm.ORIGIN_GIRATINA, 4, 2]
      ],
      items: [
        [Item.METAL_COAT, Item.ASSAULT_VEST, Item.ROCKY_HELMET],
        [Item.MYSTIC_WATER, Item.CHOICE_SPECS, Item.POWER_LENS],
        [Item.REAPER_CLOTH, Item.SCOPE_LENS, Item.SHELL_BELL]
      ],
      bonusHP: 1200,
      bonusAtk: 15,
      bonusAP: 50,
      bonusPP: 100
    }
  ]
}

export type DifficultyMode = 0 | 1 | 2 | 3 // 0=easy, 1=normal, 2=hard, 3=impossible

function getStarBudgetOffset(
  act: number,
  floor: number,
  mode: DifficultyMode
): number {
  if (mode === 3) return 1
  if (mode >= 1) return 0
  const progress = (act - 1) * 20 + floor
  if (progress <= 8) return 0
  if (act === 1) return -2
  if (act === 2) return -3
  return -4
}

interface DifficultyConfig {
  pokemonCount: number
  maxStarsPerPokemon: number
  starBudget: [number, number]
  allowedRarities: string[]
  minItemsPerPokemon: number
  maxItemsPerPokemon: number
  useCraftedItems: boolean
}

function getDifficultyConfig(
  act: number,
  floor: number,
  mode: DifficultyMode = 1,
  isEndless: boolean = false,
  isSpire: boolean = false
): DifficultyConfig {
  if (isSpire) return getSpireDifficultyConfig(act, floor)
  const clampedAct = Math.min(act, 3)
  const progress = (clampedAct - 1) * 20 + floor // 1-60

  let config: DifficultyConfig
  // --- Act 1 (no 3-star pokemon) ---
  if (progress <= 1) {
    config = {
      pokemonCount: 1,
      maxStarsPerPokemon: 1,
      starBudget: [1, 1],
      allowedRarities: ["COMMON"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 0,
      useCraftedItems: false
    }
  } else if (progress <= 3) {
    config = {
      pokemonCount: 2,
      maxStarsPerPokemon: 1,
      starBudget: [2, 2],
      allowedRarities: ["COMMON"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 0,
      useCraftedItems: false
    }
  } else if (progress <= 5) {
    config = {
      pokemonCount: randomBetween(2, 3),
      maxStarsPerPokemon: 1,
      starBudget: [2, 3],
      allowedRarities: ["COMMON", "UNCOMMON"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 0,
      useCraftedItems: false
    }
  } else if (progress <= 8) {
    config = {
      pokemonCount: randomBetween(3, 4),
      maxStarsPerPokemon: 2,
      starBudget: [4, 5],
      allowedRarities: ["COMMON", "UNCOMMON"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 1,
      useCraftedItems: false
    }
  } else if (progress <= 12) {
    config = {
      pokemonCount: randomBetween(3, 4),
      maxStarsPerPokemon: 2,
      starBudget: [4, 6],
      allowedRarities: ["COMMON", "UNCOMMON"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 1,
      useCraftedItems: false
    }
  } else if (progress <= 16) {
    config = {
      pokemonCount: randomBetween(3, 5),
      maxStarsPerPokemon: 2,
      starBudget: [6, 8],
      allowedRarities: ["UNCOMMON", "RARE"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 1,
      useCraftedItems: false
    }
  } else if (progress <= 20) {
    config = {
      pokemonCount: randomBetween(4, 5),
      maxStarsPerPokemon: 2,
      starBudget: [7, 9],
      allowedRarities: ["UNCOMMON", "RARE"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 1,
      useCraftedItems: true
    }
    // --- Act 2 ---
  } else if (progress <= 25) {
    config = {
      pokemonCount: randomBetween(5, 7),
      maxStarsPerPokemon: 3,
      starBudget: [6, 10],
      allowedRarities: ["RARE", "EPIC"],
      minItemsPerPokemon: 1,
      maxItemsPerPokemon: 2,
      useCraftedItems: true
    }
  } else if (progress <= 30) {
    config = {
      pokemonCount: randomBetween(6, 7),
      maxStarsPerPokemon: 3,
      starBudget: [8, 12],
      allowedRarities: ["RARE", "EPIC"],
      minItemsPerPokemon: 1,
      maxItemsPerPokemon: 2,
      useCraftedItems: true
    }
  } else if (progress <= 35) {
    config = {
      pokemonCount: randomBetween(6, 7),
      maxStarsPerPokemon: 3,
      starBudget: [10, 14],
      allowedRarities: ["EPIC", "ULTRA"],
      minItemsPerPokemon: 1,
      maxItemsPerPokemon: 3,
      useCraftedItems: true
    }
  } else if (progress <= 40) {
    config = {
      pokemonCount: randomBetween(7, 8),
      maxStarsPerPokemon: 3,
      starBudget: [12, 15],
      allowedRarities: ["EPIC", "ULTRA"],
      minItemsPerPokemon: 2,
      maxItemsPerPokemon: 3,
      useCraftedItems: true
    }
    // --- Act 3 ---
  } else if (progress <= 45) {
    config = {
      pokemonCount: randomBetween(7, 8),
      maxStarsPerPokemon: 3,
      starBudget: [13, 18],
      allowedRarities: ["EPIC", "ULTRA"],
      minItemsPerPokemon: 2,
      maxItemsPerPokemon: 3,
      useCraftedItems: true
    }
  } else if (progress <= 50) {
    config = {
      pokemonCount: randomBetween(7, 9),
      maxStarsPerPokemon: 3,
      starBudget: [15, 21],
      allowedRarities: ["EPIC", "ULTRA"],
      minItemsPerPokemon: 2,
      maxItemsPerPokemon: 3,
      useCraftedItems: true
    }
  } else {
    config = {
      pokemonCount: randomBetween(8, 9),
      maxStarsPerPokemon: 3,
      starBudget: [17, 23],
      allowedRarities: ["EPIC", "ULTRA"],
      minItemsPerPokemon: 3,
      maxItemsPerPokemon: 3,
      useCraftedItems: true
    }
  }

  if (isEndless && act > 3) {
    const bonus = act - 3
    config.pokemonCount += bonus
    config.starBudget = [
      config.starBudget[0] + bonus,
      config.starBudget[1] + bonus
    ]
    config.maxItemsPerPokemon = 3 + Math.floor(bonus / 2)
    config.minItemsPerPokemon = Math.min(
      config.minItemsPerPokemon + Math.floor(bonus / 3),
      config.maxItemsPerPokemon
    )
    config.allowedRarities = ["EPIC", "ULTRA", "UNIQUE", "LEGENDARY"]
  }

  const offset = getStarBudgetOffset(act, floor, mode)
  if (offset !== 0) {
    config.starBudget = [
      Math.max(config.pokemonCount, config.starBudget[0] + offset),
      Math.max(config.pokemonCount, config.starBudget[1] + offset)
    ]
  }

  if (mode === 3 && act >= 3) {
    config.pokemonCount += 2
    config.starBudget = [config.starBudget[0] + 5, config.starBudget[1] + 5]
  }

  return config
}

// Spire mode's OWN difficulty curve — 16-floor acts, so an act boss lands on
// floor 16/32/48 with boss-grade scaling. Independent of classic getDifficultyConfig:
// tune these freely (more mons / stars / items) without touching Normal mode.
function getSpireDifficultyConfig(
  act: number,
  floor: number
): DifficultyConfig {
  const clampedAct = Math.min(act, 3)
  const progress = (clampedAct - 1) * 16 + floor // 1-48
  // --- Act 1 (1-16) ---
  if (progress <= 1)
    return {
      pokemonCount: 1,
      maxStarsPerPokemon: 1,
      starBudget: [1, 1],
      allowedRarities: ["COMMON"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 0,
      useCraftedItems: false
    }
  if (progress <= 2)
    return {
      pokemonCount: 2,
      maxStarsPerPokemon: 1,
      starBudget: [2, 2],
      allowedRarities: ["COMMON"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 0,
      useCraftedItems: false
    }
  if (progress <= 4)
    return {
      pokemonCount: randomBetween(2, 3),
      maxStarsPerPokemon: 1,
      starBudget: [2, 3],
      allowedRarities: ["COMMON", "UNCOMMON"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 0,
      useCraftedItems: false
    }
  if (progress <= 7)
    return {
      pokemonCount: randomBetween(3, 4),
      maxStarsPerPokemon: 2,
      starBudget: [4, 5],
      allowedRarities: ["COMMON", "UNCOMMON"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 1,
      useCraftedItems: false
    }
  if (progress <= 11)
    return {
      pokemonCount: randomBetween(3, 4),
      maxStarsPerPokemon: 2,
      starBudget: [4, 6],
      allowedRarities: ["COMMON", "UNCOMMON"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 1,
      useCraftedItems: false
    }
  if (progress <= 14)
    return {
      pokemonCount: randomBetween(3, 5),
      maxStarsPerPokemon: 2,
      starBudget: [6, 8],
      allowedRarities: ["UNCOMMON", "RARE"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 1,
      useCraftedItems: false
    }
  if (progress <= 16)
    return {
      pokemonCount: randomBetween(4, 5),
      maxStarsPerPokemon: 2,
      starBudget: [7, 9],
      allowedRarities: ["UNCOMMON", "RARE"],
      minItemsPerPokemon: 0,
      maxItemsPerPokemon: 1,
      useCraftedItems: true
    }
  // --- Act 2 (17-32) ---
  if (progress <= 21)
    return {
      pokemonCount: randomBetween(5, 7),
      maxStarsPerPokemon: 3,
      starBudget: [6, 10],
      allowedRarities: ["RARE", "EPIC"],
      minItemsPerPokemon: 1,
      maxItemsPerPokemon: 2,
      useCraftedItems: true
    }
  if (progress <= 26)
    return {
      pokemonCount: randomBetween(6, 7),
      maxStarsPerPokemon: 3,
      starBudget: [8, 12],
      allowedRarities: ["RARE", "EPIC"],
      minItemsPerPokemon: 1,
      maxItemsPerPokemon: 2,
      useCraftedItems: true
    }
  if (progress <= 30)
    return {
      pokemonCount: randomBetween(6, 7),
      maxStarsPerPokemon: 3,
      starBudget: [10, 14],
      allowedRarities: ["EPIC", "ULTRA"],
      minItemsPerPokemon: 1,
      maxItemsPerPokemon: 3,
      useCraftedItems: true
    }
  if (progress <= 32)
    return {
      pokemonCount: randomBetween(7, 8),
      maxStarsPerPokemon: 3,
      starBudget: [12, 15],
      allowedRarities: ["EPIC", "ULTRA"],
      minItemsPerPokemon: 2,
      maxItemsPerPokemon: 3,
      useCraftedItems: true
    }
  // --- Act 3 (33-48) ---
  if (progress <= 37)
    return {
      pokemonCount: randomBetween(7, 8),
      maxStarsPerPokemon: 3,
      starBudget: [13, 18],
      allowedRarities: ["EPIC", "ULTRA"],
      minItemsPerPokemon: 2,
      maxItemsPerPokemon: 3,
      useCraftedItems: true
    }
  if (progress <= 42)
    return {
      pokemonCount: randomBetween(7, 9),
      maxStarsPerPokemon: 3,
      starBudget: [15, 21],
      allowedRarities: ["EPIC", "ULTRA"],
      minItemsPerPokemon: 2,
      maxItemsPerPokemon: 3,
      useCraftedItems: true
    }
  return {
    pokemonCount: randomBetween(8, 9),
    maxStarsPerPokemon: 3,
    starBudget: [17, 23],
    allowedRarities: ["EPIC", "ULTRA"],
    minItemsPerPokemon: 3,
    maxItemsPerPokemon: 3,
    useCraftedItems: true
  }
}

function selectWithStarBudget(
  candidatePool: Pkm[],
  primaryPool: Pkm[],
  secondaryPool: Pkm[],
  difficulty: DifficultyConfig
): Pkm[] {
  const clampedMin = Math.max(difficulty.starBudget[0], difficulty.pokemonCount)
  const clampedMax = Math.min(
    difficulty.starBudget[1],
    difficulty.pokemonCount * difficulty.maxStarsPerPokemon
  )
  const targetStars = randomBetween(clampedMin, clampedMax)
  const selected: Pkm[] = []
  let currentStars = 0

  const primary = [...primaryPool]
  const secondary = [...secondaryPool]
  const fallback = [...candidatePool]

  for (let i = 0; i < difficulty.pokemonCount; i++) {
    const pool =
      primary.length > 0 ? primary : secondary.length > 0 ? secondary : fallback
    if (pool.length === 0) break

    const slotsLeft = difficulty.pokemonCount - i
    const starsNeeded = targetStars - currentStars
    const maxAffordable = Math.min(
      difficulty.maxStarsPerPokemon,
      starsNeeded - (slotsLeft - 1)
    )
    const minNeeded = Math.max(
      1,
      starsNeeded - (slotsLeft - 1) * difficulty.maxStarsPerPokemon
    )

    const starFilter = (p: Pkm) => {
      const s = getPokemonData(p).stars
      return s >= minNeeded && s <= maxAffordable
    }

    let eligible = pool.filter(starFilter)
    if (eligible.length === 0 && pool !== secondary && secondary.length > 0) {
      eligible = secondary.filter(starFilter)
    }
    if (eligible.length === 0 && pool !== fallback && fallback.length > 0) {
      eligible = fallback.filter(starFilter)
    }
    if (eligible.length === 0) {
      const allPools = [...pool, ...secondary, ...fallback]
      if (starsNeeded > slotsLeft) {
        const maxAvail = Math.max(
          ...allPools.map((p) => getPokemonData(p).stars)
        )
        eligible = allPools.filter((p) => getPokemonData(p).stars === maxAvail)
      } else {
        eligible = allPools
      }
    }

    const pick = pickRandomIn(eligible)
    selected.push(pick)
    currentStars += getPokemonData(pick).stars
    const removeFrom = [primary, secondary, fallback]
    for (const arr of removeFrom) {
      const idx = arr.indexOf(pick)
      if (idx !== -1) arr.splice(idx, 1)
    }
  }

  return selected
}

function positionByRange(pokemon: Pkm[], act: number): [Pkm, number, number][] {
  const board: [Pkm, number, number][] = []
  if (act === 1) {
    const allPositions = [
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
      [6, 1],
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 2],
      [6, 2]
    ]
    const shuffled = pickNRandomIn(
      allPositions,
      Math.min(pokemon.length, allPositions.length)
    )
    pokemon.forEach((pkm, i) => {
      board.push([pkm, shuffled[i][0], shuffled[i][1]])
    })
  } else {
    const frontRow: [number, number][] = [
      [2, 3],
      [3, 3],
      [4, 3],
      [5, 3],
      [6, 3]
    ]
    const midRow: [number, number][] = [
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 2],
      [6, 2]
    ]
    const backRow: [number, number][] = [
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
      [6, 1]
    ]
    let fi = 0,
      mi = 0,
      bi = 0
    pokemon.forEach((pkm) => {
      const range = getPokemonData(pkm).range
      if (range <= 1 && fi < frontRow.length) {
        board.push([pkm, frontRow[fi][0], frontRow[fi][1]])
        fi++
      } else if (range === 2 && mi < midRow.length) {
        board.push([pkm, midRow[mi][0], midRow[mi][1]])
        mi++
      } else if (range >= 3 && bi < backRow.length) {
        board.push([pkm, backRow[bi][0], backRow[bi][1]])
        bi++
      } else if (fi < frontRow.length) {
        board.push([pkm, frontRow[fi][0], frontRow[fi][1]])
        fi++
      } else if (mi < midRow.length) {
        board.push([pkm, midRow[mi][0], midRow[mi][1]])
        mi++
      } else if (bi < backRow.length) {
        board.push([pkm, backRow[bi][0], backRow[bi][1]])
        bi++
      }
    })
  }
  return board
}

export function getRegionalWildEncounter(
  act: number,
  floor: number,
  region: string,
  mode: DifficultyMode = 1,
  isEndless: boolean = false,
  isSpire: boolean = false
): SpireEncounter {
  const synergies = RegionDetails[region as DungeonPMDO]?.synergies ?? []
  if (synergies.length === 0) {
    return getWildEncounter(act, floor, 0)
  }

  const difficulty = getDifficultyConfig(act, floor, mode, isEndless, isSpire)

  // Build candidate pool filtered by region synergies, stars, and rarity
  // In acts 2+3, focus on one synergy for most of the team
  const focusSynergy = act >= 2 ? pickRandomIn(synergies) : null
  const primaryPool: Pkm[] = []
  const secondaryPool: Pkm[] = []

  for (const syn of synergies) {
    const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn]
    if (typed) {
      for (const pkm of typed) {
        const data = getPokemonData(pkm)
        if (
          data.stars <= difficulty.maxStarsPerPokemon &&
          difficulty.allowedRarities.includes(data.rarity)
        ) {
          if (focusSynergy && syn === focusSynergy) {
            if (!primaryPool.includes(pkm)) primaryPool.push(pkm)
          } else {
            if (!secondaryPool.includes(pkm) && !primaryPool.includes(pkm))
              secondaryPool.push(pkm)
          }
        }
      }
    }
  }

  if (isEndless && act >= 4) {
    const evolved = filterFullyEvolved(primaryPool)
    primaryPool.length = 0
    primaryPool.push(...evolved)
    const evolvedSec = filterFullyEvolved(secondaryPool)
    secondaryPool.length = 0
    secondaryPool.push(...evolvedSec)
  }

  const candidatePool = [...primaryPool, ...secondaryPool]

  if (candidatePool.length === 0) {
    for (const syn of synergies) {
      const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn]
      if (typed) {
        for (const pkm of typed) {
          const data = getPokemonData(pkm)
          if (
            data.stars <= difficulty.maxStarsPerPokemon &&
            !candidatePool.includes(pkm)
          ) {
            if (isEndless && act >= 4 && data.evolution) continue
            candidatePool.push(pkm)
          }
        }
      }
    }
  }

  if (candidatePool.length === 0) {
    return getWildEncounter(act, floor, 0)
  }

  const selected = focusSynergy
    ? selectWithStarBudget(
        candidatePool,
        primaryPool,
        secondaryPool,
        difficulty
      )
    : selectWithStarBudget(candidatePool, candidatePool, [], difficulty)

  const board = positionByRange(selected, act)

  const endlessClassItems = isEndless && act >= 4
  const useClassItems =
    endlessClassItems || act >= 3 || (act >= 2 && mode === 3)
  const items = useClassItems
    ? generateClassItems(
        board,
        mode,
        endlessClassItems ? Math.max(0, act - 2) : undefined,
        endlessClassItems ? act : undefined
      )
    : generateEncounterItems(
        selected.length,
        difficulty.minItemsPerPokemon,
        difficulty.maxItemsPerPokemon,
        difficulty.useCraftedItems
      )

  const regionName = (region as string).replace(/([A-Z])/g, " $1").trim()

  return addHardModeItems(
    {
      name: regionName,
      avatar: selected[0],
      board,
      items
    },
    act,
    floor,
    mode
  )
}

function generateEncounterItems(
  pokemonCount: number,
  minItems: number,
  maxItems: number,
  useCrafted: boolean
): Item[][] {
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
      if (useCrafted && randomFloat() < 0.3) {
        pkmItems.push(pickRandomIn(CraftableItems))
      } else {
        pkmItems.push(pickRandomIn(ItemComponentsNoFossilOrScarf))
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

export function getWildEncounter(
  act: number,
  floor: number,
  seed: number
): SpireEncounter {
  const template = WILD_ENCOUNTERS[seed % WILD_ENCOUNTERS.length]
  const tier = getEncounterTier(act, floor)
  const board = template.tiers[tier] || template.tiers[1]
  return {
    name: template.name,
    avatar: template.avatar,
    board: [...board]
  }
}

export function generateGymEncounter(
  synergy: Synergy,
  act: number,
  floor: number,
  mode: DifficultyMode = 1,
  displayName?: string,
  isEndless: boolean = false,
  isSpire: boolean = false
): SpireEncounter {
  const difficulty = getDifficultyConfig(act, floor, mode, isEndless, isSpire)
  difficulty.starBudget = [
    difficulty.starBudget[0],
    difficulty.starBudget[1] + 1
  ]
  const signaturePokemon = GYM_LEADER_POKEMON[synergy] ?? []
  const names = GYM_LEADER_NAMES[synergy] ?? ["Gym Leader"]
  const name = displayName || pickRandomIn(names)

  const candidatePool: Pkm[] = []
  for (const pkm of signaturePokemon) {
    const data = getPokemonData(pkm)
    if (
      data.stars <= difficulty.maxStarsPerPokemon &&
      difficulty.allowedRarities.includes(data.rarity)
    ) {
      candidatePool.push(pkm)
    }
  }

  // Fill from synergy type if not enough signature Pokemon
  const typed = PRECOMPUTED_POKEMONS_PER_TYPE[synergy] ?? []
  for (const pkm of typed) {
    const data = getPokemonData(pkm)
    if (
      data.stars <= difficulty.maxStarsPerPokemon &&
      difficulty.allowedRarities.includes(data.rarity) &&
      !candidatePool.includes(pkm)
    ) {
      candidatePool.push(pkm)
    }
  }

  // In act 2, bias toward unique/rare Pokemon
  if (act >= 2) {
    const uniqueTyped = typed.filter((pkm) => {
      const data = getPokemonData(pkm)
      return (
        data.stars <= difficulty.maxStarsPerPokemon &&
        (data.rarity === "ULTRA" || data.rarity === "EPIC") &&
        !candidatePool.includes(pkm)
      )
    })
    candidatePool.push(...uniqueTyped)
  }

  // In act 3, add at least 1 legendary from this synergy
  let legendaryPick: Pkm | null = null
  if (act >= 3) {
    const legendaries = typed.filter((pkm) => {
      const data = getPokemonData(pkm)
      return data.rarity === "LEGENDARY" || data.rarity === "UNIQUE"
    })
    if (legendaries.length > 0) {
      legendaryPick = pickRandomIn(legendaries)
    }
  }

  if (isEndless && act >= 4) {
    const evolved = filterFullyEvolved(candidatePool)
    candidatePool.length = 0
    candidatePool.push(...evolved)
  }

  if (candidatePool.length === 0) {
    for (const pkm of typed) {
      const data = getPokemonData(pkm)
      if (
        data.stars <= difficulty.maxStarsPerPokemon &&
        !candidatePool.includes(pkm)
      ) {
        if (isEndless && act >= 4 && data.evolution) continue
        candidatePool.push(pkm)
      }
    }
  }

  // Select Pokemon with star budget
  const targetCount = Math.max(3, difficulty.pokemonCount)
  const gymDifficulty = { ...difficulty, pokemonCount: targetCount }
  const selected: Pkm[] = []

  // Add legendary first if act 3
  if (legendaryPick) {
    selected.push(legendaryPick)
    gymDifficulty.pokemonCount--
    gymDifficulty.starBudget = [
      Math.max(
        gymDifficulty.pokemonCount,
        gymDifficulty.starBudget[0] - getPokemonData(legendaryPick).stars
      ),
      Math.max(
        gymDifficulty.pokemonCount,
        gymDifficulty.starBudget[1] - getPokemonData(legendaryPick).stars
      )
    ]
  }

  // Use signature Pokemon as primary pool for star budget selection
  const sigCandidates = candidatePool.filter((p) =>
    signaturePokemon.includes(p)
  )
  const otherCandidates = candidatePool.filter(
    (p) => !signaturePokemon.includes(p)
  )
  selected.push(
    ...selectWithStarBudget(
      candidatePool,
      sigCandidates,
      otherCandidates,
      gymDifficulty
    )
  )

  if (selected.length === 0 && signaturePokemon.length > 0) {
    selected.push(
      ...pickNRandomIn(signaturePokemon, Math.min(3, signaturePokemon.length))
    )
  }

  // Position Pokemon by range (melee front = high y, ranged back = low y)
  const board: [Pkm, number, number][] = []
  const frontRow: [number, number][] = [
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 3],
    [6, 3]
  ]
  const midRow: [number, number][] = [
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 2]
  ]
  const backRow: [number, number][] = [
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 1]
  ]
  let fi = 0,
    mi = 0,
    bi = 0
  selected.forEach((pkm) => {
    const range = getPokemonData(pkm).range
    if (range <= 1 && fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]])
      fi++
    } else if (range === 2 && mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]])
      mi++
    } else if (range >= 3 && bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]])
      bi++
    } else if (fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]])
      fi++
    } else if (mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]])
      mi++
    } else if (bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]])
      bi++
    }
  })

  const endlessGymClass = isEndless && act >= 4
  const useClassItems = endlessGymClass || act >= 3 || (act >= 2 && mode === 3)
  const items = useClassItems
    ? generateClassItems(
        board,
        mode,
        endlessGymClass ? Math.max(0, act - 2) : undefined,
        endlessGymClass ? act : undefined
      )
    : generateEncounterItems(
        selected.length,
        difficulty.minItemsPerPokemon,
        difficulty.maxItemsPerPokemon,
        difficulty.useCraftedItems
      )

  return addHardModeItems(
    {
      name,
      avatar: selected[0],
      board,
      items,
      synergy
    },
    act,
    floor,
    mode
  )
}

export function getGymSynergies(): Synergy[] {
  return GYM_SYNERGIES
}

export function getGymSynergyCount(): number {
  return GYM_SYNERGIES.length
}

// Legacy compat wrappers
export function getGymLeaderEncounter(index: number): SpireEncounter {
  const syn = GYM_SYNERGIES[index % GYM_SYNERGIES.length]
  return generateGymEncounter(syn, 1, 9)
}

export function getEarlyGymLeaderEncounter(index: number): SpireEncounter {
  const syn = GYM_SYNERGIES[index % GYM_SYNERGIES.length]
  return generateGymEncounter(syn, 1, 9)
}

export function getLateGymLeaderEncounter(index: number): SpireEncounter {
  const syn = GYM_SYNERGIES[index % GYM_SYNERGIES.length]
  return generateGymEncounter(syn, 1, 18)
}

export function getGymLeaderCount(): number {
  return GYM_SYNERGIES.length
}

export function getEarlyGymLeaderCount(): number {
  return GYM_SYNERGIES.length
}

export function getLateGymLeaderCount(): number {
  return GYM_SYNERGIES.length
}

// Gym rewards offer an evolved (2★) themed Pokémon rather than a weak 1★ base
// form (e.g. a Flora gym should never reward a 1★ Sprigatito/Sunkern). Upgrade
// each 1★ roster member to its 2★ evolution and union with any 2★ already in
// the roster, deduped. SPECIAL-rarity Pokémon are excluded from the pool.
// get2StarForm() is hoisted (function declaration) so it is safe to call here.
export function getGymLeaderBaseFormPokemon(synergy: Synergy): Pkm[] {
  const roster = GYM_LEADER_POKEMON[synergy] ?? []
  const result = new Set<Pkm>()
  const addIfNotSpecial = (pkm: Pkm) => {
    if (getPokemonData(pkm).rarity !== "SPECIAL") result.add(pkm)
  }
  for (const pkm of roster) {
    const data = getPokemonData(pkm)
    if (data.stars === 2) {
      addIfNotSpecial(pkm)
    } else if (data.stars === 1) {
      const evo = get2StarForm(pkm)
      if (evo) addIfNotSpecial(evo)
    }
  }
  return [...result]
}

export function getGymLeaderGem(synergy: Synergy): Item {
  const gemName = `${synergy}_GEM`
  if (gemName in Item) {
    return Item[gemName as keyof typeof Item]
  }
  return Item.NORMAL_GEM
}

export function addHardModeItems(
  encounter: SpireEncounter,
  act: number,
  floor: number,
  mode: DifficultyMode
): SpireEncounter {
  if (mode < 2) return encounter
  if (act >= 3) return encounter
  if (act >= 2 && mode === 3) return encounter // Impossible Act 2 uses class items
  const progress = (act - 1) * 20 + floor
  if (mode === 3 ? progress <= 3 : progress <= 8) return encounter

  let extraComponents: number
  if (act === 1)
    extraComponents = Math.round(
      encounter.board.length * (mode === 3 ? 0.75 : 0.5)
    )
  else if (act === 2)
    extraComponents = Math.round(encounter.board.length * 1.25)
  else extraComponents = Math.round(encounter.board.length * 1.75)

  const adjusted = {
    ...encounter,
    items:
      encounter.items && encounter.items.length > 0
        ? encounter.items.map((list) => [...list])
        : encounter.board.map(() => [] as Item[])
  }
  for (let i = 0; i < extraComponents; i++) {
    const slot = i % adjusted.items!.length
    adjusted.items![slot].push(pickRandomIn(ItemComponentsNoFossilOrScarf))
  }
  return adjusted
}

export function adjustEncounterItems(
  encounter: SpireEncounter,
  mode: DifficultyMode,
  act?: number
): SpireEncounter {
  if (mode === 1 || !encounter.items) return encounter
  if (act !== undefined && (act >= 3 || (act >= 2 && mode === 3)))
    return encounter
  const adjusted = {
    ...encounter,
    items: encounter.items.map((list) => [...list])
  }
  if (mode === 0) {
    for (const list of adjusted.items!) {
      if (list.length > 0) {
        list.pop()
        break
      }
    }
  } else {
    for (const list of adjusted.items!) {
      if (list.length > 0) {
        list.push(pickRandomIn(CraftableItems))
        break
      }
    }
  }
  return adjusted
}

function generateLegendaryEliteEncounter(
  legendary: Pkm,
  act: number,
  floor: number,
  mode: DifficultyMode = 1,
  isEndless: boolean = false,
  isSpire: boolean = false
): SpireEncounter {
  const difficulty = getDifficultyConfig(act, floor, mode, isEndless, isSpire)
  difficulty.starBudget = [
    difficulty.starBudget[0] + 2,
    difficulty.starBudget[1] + 3
  ]
  const legendaryData = getPokemonData(legendary)
  const synergies = (legendaryData.types ?? []) as Synergy[]

  const endlessFullyEvolved = isEndless && act >= 4
  const candidatePool: Pkm[] = []
  for (const syn of synergies) {
    const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn] ?? []
    for (const pkm of typed) {
      if (pkm === legendary) continue
      const data = getPokemonData(pkm)
      if (endlessFullyEvolved) {
        if (
          data.evolution ||
          data.rarity === "HATCH" ||
          data.rarity === "SPECIAL"
        )
          continue
      } else {
        if (
          data.rarity === "LEGENDARY" ||
          data.rarity === "UNIQUE" ||
          data.rarity === "HATCH" ||
          data.rarity === "SPECIAL"
        )
          continue
      }
      if (
        data.stars <= difficulty.maxStarsPerPokemon &&
        !candidatePool.includes(pkm)
      ) {
        candidatePool.push(pkm)
      }
    }
  }

  const targetCount = Math.max(3, difficulty.pokemonCount)
  const remainingCount = targetCount - 1
  const remainingDifficulty = {
    ...difficulty,
    pokemonCount: remainingCount,
    starBudget: [
      Math.max(remainingCount, difficulty.starBudget[0] - legendaryData.stars),
      Math.max(remainingCount, difficulty.starBudget[1] - legendaryData.stars)
    ] as [number, number]
  }
  const selected: Pkm[] = [legendary]
  selected.push(
    ...selectWithStarBudget(
      candidatePool,
      candidatePool,
      [],
      remainingDifficulty
    )
  )

  const frontRow: [number, number][] = [
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 3],
    [6, 3]
  ]
  const midRow: [number, number][] = [
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 2]
  ]
  const backRow: [number, number][] = [
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 1]
  ]
  let fi = 0,
    mi = 0,
    bi = 0
  const board: [Pkm, number, number][] = []
  selected.forEach((pkm) => {
    const range = getPokemonData(pkm).range
    if (range <= 1 && fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]])
      fi++
    } else if (range === 2 && mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]])
      mi++
    } else if (range >= 3 && bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]])
      bi++
    } else if (fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]])
      fi++
    } else if (mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]])
      mi++
    } else if (bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]])
      bi++
    }
  })

  const endlessLegendaryClass = isEndless && act >= 4
  const useClassItems =
    endlessLegendaryClass || act >= 3 || (act >= 2 && mode === 3)
  const items = useClassItems
    ? generateClassItems(
        board,
        mode,
        endlessLegendaryClass ? Math.max(0, act - 2) : undefined,
        endlessLegendaryClass ? act : undefined
      )
    : generateEncounterItems(
        selected.length,
        difficulty.minItemsPerPokemon,
        difficulty.maxItemsPerPokemon,
        difficulty.useCraftedItems
      )
  const name = legendaryData.name.replace(/_/g, " ")

  return { name, avatar: legendary, board, items }
}

function generateHatchUnlockEncounter(
  basePkm: Pkm,
  floor: number
): SpireEncounter {
  const evolved = HATCH_EVOLUTIONS[basePkm] ?? basePkm
  const baseData = getPokemonData(basePkm)
  const synergies = (baseData.types ?? []) as Synergy[]

  const candidates = HATCH_BASES.filter((pkm) => {
    if (pkm === basePkm) return false
    const data = getPokemonData(pkm)
    const otherSynergies = (data.types ?? []) as Synergy[]
    return synergies.some((s) => otherSynergies.includes(s))
  })
  if (candidates.length === 0) candidates.push(Pkm.SCATTERBUG)

  const supportCount = Math.min(Math.ceil(floor / 5), 4, candidates.length)
  const support = pickNRandomIn(candidates, supportCount)

  const frontRow: [number, number][] = [
    [3, 3],
    [5, 3]
  ]
  const backRow: [number, number][] = [
    [2, 1],
    [6, 1]
  ]
  const board: [Pkm, number, number][] = [[evolved, 4, 2]]
  support.forEach((pkm, i) => {
    const pos = i < 2 ? backRow[i] : frontRow[i - 2]
    board.push([pkm, pos[0], pos[1]])
  })

  return {
    name: baseData.name.replace(/_/g, " "),
    avatar: basePkm,
    board
  }
}

const ALL_UNLOCK_ENCOUNTERS = [
  ...HATCH_UNLOCK_ENCOUNTERS,
  ...UNIQUE_ELITE_ENCOUNTERS,
  ...LEGENDARY_ELITE_ENCOUNTERS
]

function getUnlockPool(
  act: number,
  isEndless: boolean = false
): UnlockEncounterTemplate[] {
  if (isEndless && act >= 4) return ALL_UNLOCK_ENCOUNTERS
  return UNLOCK_ENCOUNTERS_BY_ACT[act] ?? HATCH_UNLOCK_ENCOUNTERS
}

export function getUnlockEncounter(
  index: number,
  act: number,
  floor: number,
  mode: DifficultyMode = 1,
  isEndless: boolean = false,
  isSpire: boolean = false
): SpireEncounter {
  const encounters = getUnlockPool(act, isEndless)
  const template = encounters[index % encounters.length]

  if (template.eliteType === "hatch") {
    return addHardModeItems(
      adjustEncounterItems(
        generateHatchUnlockEncounter(template.avatar, floor),
        mode,
        act
      ),
      act,
      floor,
      mode
    )
  }
  return addHardModeItems(
    adjustEncounterItems(
      generateLegendaryEliteEncounter(
        template.avatar,
        act,
        floor,
        mode,
        isEndless,
        isSpire
      ),
      mode,
      act
    ),
    act,
    floor,
    mode
  )
}

export function getUnlockEncounterCount(
  act: number,
  isEndless: boolean = false
): number {
  return getUnlockPool(act, isEndless).length
}

export function getUnlockEncounterName(
  index: number,
  act: number,
  isEndless: boolean = false
): string {
  const encounters = getUnlockPool(act, isEndless)
  return encounters[index % encounters.length]?.name ?? "Unlock"
}

export function getUnlockEncounterAvatar(
  index: number,
  act: number,
  isEndless: boolean = false
): Pkm {
  const encounters = getUnlockPool(act, isEndless)
  return encounters[index % encounters.length]?.avatar ?? Pkm.DEFAULT
}

export function getUnlockEncounterType(
  index: number,
  act: number,
  isEndless: boolean = false
): "legendary" | "unique" | "hatch" | undefined {
  const encounters = getUnlockPool(act, isEndless)
  return encounters[index % encounters.length]?.eliteType
}

export function getUnlockEncounterPokemon(
  index: number,
  act: number,
  isEndless: boolean = false
): Pkm[] {
  const encounters = getUnlockPool(act, isEndless)
  const template = encounters[index % encounters.length]
  return [template.avatar]
}

export function getEliteEncounter(
  index: number,
  act: number,
  floor: number,
  mode: DifficultyMode = 1,
  isEndless: boolean = false,
  isSpire: boolean = false
): SpireEncounter {
  const clampedAct = Math.min(act, 3)
  const encounters =
    ELITE_ENCOUNTERS_BY_ACT[clampedAct] ?? ACT1_ELITE_ENCOUNTERS
  const template = encounters[index % encounters.length]
  const difficulty = getDifficultyConfig(act, floor, mode, isEndless, isSpire)

  const mainPkm = template.mainPokemon
  const mainStars = getPokemonData(mainPkm).stars
  const dojoLevel = act === 1 ? 1 : act === 2 ? 2 : 3

  const remainingCount = Math.max(0, difficulty.pokemonCount - 1)
  const picks: Pkm[] = []

  if (remainingCount > 0 && template.validPicks.length > 0) {
    let picksPool = template.validPicks
    if (isEndless && act >= 4) {
      picksPool = filterFullyEvolved(picksPool)
      if (picksPool.length === 0) picksPool = template.validPicks
    }
    const filteredPicks = picksPool.filter(
      (p) => getPokemonData(p).stars <= difficulty.maxStarsPerPokemon
    )
    const basePool =
      filteredPicks.length > 0 ? filteredPicks : template.validPicks
    const remaining = [...basePool]

    const clampedMin = Math.max(
      difficulty.starBudget[0] - mainStars,
      remainingCount
    )
    const clampedMax = Math.min(
      difficulty.starBudget[1] - mainStars,
      remainingCount * difficulty.maxStarsPerPokemon
    )
    const targetStars = randomBetween(
      Math.max(remainingCount, clampedMin),
      Math.max(remainingCount, clampedMax)
    )
    let currentStars = 0

    for (let i = 0; i < remainingCount; i++) {
      const slotsLeft = remainingCount - i
      const starsNeeded = targetStars - currentStars
      const maxAffordable = Math.min(
        difficulty.maxStarsPerPokemon,
        starsNeeded - (slotsLeft - 1)
      )
      const minNeeded = Math.max(
        1,
        starsNeeded - (slotsLeft - 1) * difficulty.maxStarsPerPokemon
      )

      const starFilter = (p: Pkm) => {
        const s = getPokemonData(p).stars
        return s >= minNeeded && s <= maxAffordable
      }

      // Prefer unique picks; fall back to full pool if remaining is exhausted
      let eligible = remaining.filter(starFilter)
      if (eligible.length === 0) eligible = basePool.filter(starFilter)
      if (eligible.length === 0)
        eligible = remaining.length > 0 ? remaining : [...basePool]

      const pick = pickRandomIn(eligible)
      picks.push(pick)
      currentStars += getPokemonData(pick).stars
      const idx = remaining.indexOf(pick)
      if (idx !== -1) remaining.splice(idx, 1)
    }
  }

  const allPokemon = [mainPkm, ...picks]
  const board = positionByRange(allPokemon, act)

  const endlessEliteClass = isEndless && act >= 4
  const useClassItems =
    endlessEliteClass || act >= 3 || (act >= 2 && mode === 3)
  let items = useClassItems
    ? generateClassItems(
        board,
        mode,
        endlessEliteClass ? Math.max(0, act - 2) : undefined,
        endlessEliteClass ? act : undefined
      )
    : generateEncounterItems(
        allPokemon.length,
        difficulty.minItemsPerPokemon,
        difficulty.maxItemsPerPokemon,
        difficulty.useCraftedItems
      )

  if (!items || items.length === 0) {
    items = allPokemon.map(() => [] as Item[])
  }
  while (items.length < allPokemon.length) {
    items.push([])
  }
  // Main pokemon gets items as priority: swap with the best-equipped slot
  const bestIdx = items.reduce(
    (best, list, i) => (list.length > items[best].length ? i : best),
    0
  )
  if (bestIdx !== 0 && items[bestIdx].length > items[0].length) {
    const temp = items[0]
    items[0] = items[bestIdx]
    items[bestIdx] = temp
  }

  const hpBonus = [50, 100, 150][dojoLevel - 1] ?? 0
  const atkBonus = [5, 10, 15][dojoLevel - 1] ?? 0
  const apBonus = [15, 30, 45][dojoLevel - 1] ?? 0

  const encounter: SpireEncounter = {
    name: template.name,
    avatar: mainPkm,
    board,
    items,
    mainBonusHP: hpBonus,
    mainBonusAtk: atkBonus,
    mainBonusAP: apBonus
  }

  return addHardModeItems(
    adjustEncounterItems(encounter, mode, act),
    act,
    floor,
    mode
  )
}

export function getEliteMainPokemon(index: number, act: number): Pkm {
  const encounters = ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS
  return encounters[index % encounters.length]?.mainPokemon ?? Pkm.DEFAULT
}

export function getEliteEncounterCount(act: number): number {
  return (ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS).length
}

export function getEliteEncounterName(index: number, act: number): string {
  const encounters = ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS
  return encounters[index % encounters.length]?.name ?? "Elite"
}

export function getEliteEncounterAvatar(index: number, act: number): Pkm {
  const encounters = ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS
  return encounters[index % encounters.length]?.mainPokemon ?? Pkm.DEFAULT
}

export function getGymLeaderDisplayName(synergy: string): string {
  const names = GYM_LEADER_NAMES[synergy as Synergy]
  if (names && names.length > 0) return pickRandomIn(names)
  return synergy.replace(/_/g, " ")
}

function applyBossBoost(
  encounter: SpireEncounter,
  act: number,
  mode: DifficultyMode
): SpireEncounter {
  if (mode < 2) return encounter

  // Hard Act 3: +1 random legendary with Soul Dew, +200 HP, +5 ATK
  // Impossible Act 2: +150 HP, +3 ATK (stat boost only, no extra legendary)
  // Impossible Act 3: +Mega Rayquaza +Roaring Moon with Soul Dew, +300 HP, +8 ATK, +3 DEF, +3 SpeDef, extra class items
  if (mode === 2 && act < 3) return encounter
  if (mode === 3 && act < 2) return encounter

  const adjusted = {
    ...encounter,
    board: [...encounter.board],
    items: (encounter.items || encounter.board.map(() => [])).map((list) => [
      ...list
    ])
  }

  if (mode === 3 && act === 2) {
    adjusted.bonusHP = (adjusted.bonusHP ?? 0) + 150
    adjusted.bonusAtk = (adjusted.bonusAtk ?? 0) + 3
    return adjusted
  }

  const occupiedSlots = new Set(
    adjusted.board.map(([, bx, by]) => `${bx},${by}`)
  )
  const findFreeX = (row: number) =>
    [0, 1, 2, 3, 4, 5, 6, 7].find((x) => !occupiedSlots.has(`${x},${row}`)) ?? 1

  if (mode === 3) {
    // Impossible Act 3: add Mega Rayquaza and Roaring Moon
    const extras: [Pkm, Item][] = [
      [Pkm.MEGA_RAYQUAZA, Item.SOUL_DEW],
      [Pkm.ROARING_MOON, Item.SOUL_DEW]
    ]
    for (const [pkm, item] of extras) {
      const freeX = findFreeX(1)
      adjusted.board.push([pkm, freeX, 1] as [Pkm, number, number])
      adjusted.items!.push([item])
      occupiedSlots.add(`${freeX},1`)
    }
  } else {
    // Hard Act 3: +1 random legendary with Soul Dew
    const extraLegendaries: Pkm[] = [
      Pkm.CELEBI,
      Pkm.JIRACHI,
      Pkm.VICTINI,
      Pkm.MANAPHY,
      Pkm.SHAYMIN,
      Pkm.PHIONE
    ]
    const existing = new Set(adjusted.board.map(([pkm]) => pkm))
    const candidates = extraLegendaries.filter((p) => !existing.has(p))
    if (candidates.length > 0) {
      const extra = pickRandomIn(candidates)
      const freeX = findFreeX(1)
      adjusted.board.push([extra, freeX, 1] as [Pkm, number, number])
      adjusted.items!.push([Item.SOUL_DEW])
    }
  }

  if (mode === 3) {
    adjusted.bonusHP = (adjusted.bonusHP ?? 0) + 300
    adjusted.bonusAtk = (adjusted.bonusAtk ?? 0) + 8
    adjusted.bonusDef = (adjusted.bonusDef ?? 0) + 3
    adjusted.bonusSpeDef = (adjusted.bonusSpeDef ?? 0) + 3
    // Give each boss Pokemon an extra class item
    for (let i = 0; i < adjusted.board.length; i++) {
      const itemClass = getItemClassForPokemon(adjusted.board[i][0])
      const pool = ITEM_CLASS_POOLS[itemClass]
      adjusted.items![i] = adjusted.items![i] || []
      adjusted.items![i].push(pickRandomIn(pool))
    }
  } else {
    adjusted.bonusHP = (adjusted.bonusHP ?? 0) + 200
    adjusted.bonusAtk = (adjusted.bonusAtk ?? 0) + 5
  }

  return adjusted
}

export function getLegendaryBossEncounter(
  act: number,
  mode: DifficultyMode = 1
): SpireEncounter {
  const bosses = LEGENDARY_BOSSES[act] || LEGENDARY_BOSSES[1]
  return adjustEncounterItems(
    applyBossBoost(pickRandomIn(bosses), act, mode),
    mode,
    act
  )
}

export function pickLegendaryBoss(act: number): {
  name: string
  sprites: Pkm[]
} {
  const bosses = LEGENDARY_BOSSES[act] || LEGENDARY_BOSSES[1]
  const boss = pickRandomIn(bosses)
  const sprites = boss.board.map(([pkm]) => pkm)
  return { name: boss.name, sprites }
}

export function getLegendaryBossEncounterByName(
  act: number,
  name: string,
  mode: DifficultyMode = 1
): SpireEncounter {
  const bosses = LEGENDARY_BOSSES[act] || LEGENDARY_BOSSES[1]
  const boss = bosses.find((b) => b.name === name) ?? pickRandomIn(bosses)
  return adjustEncounterItems(applyBossBoost(boss, act, mode), mode, act)
}

export function getRegionalCandidates(region: string, act: number): Pkm[] {
  const synergies = RegionDetails[region as DungeonPMDO]?.synergies ?? []
  if (synergies.length === 0) return []

  const maxStars = act === 1 ? 1 : act === 2 ? 1 : 2
  const raw: Pkm[] = []
  for (const pkm of PRECOMPUTED_REGIONAL_MONS) {
    const data = getPokemonData(pkm)
    if (data.stars > maxStars) continue
    if (
      data.rarity === "HATCH" ||
      data.rarity === "SPECIAL" ||
      data.rarity === "UNIQUE" ||
      data.rarity === "LEGENDARY"
    )
      continue
    if (raw.includes(pkm)) continue
    const hasMatchingSynergy = data.types.some((t: string) =>
      synergies.includes(t as any)
    )
    if (hasMatchingSynergy) {
      raw.push(pkm)
    }
  }

  // Dedup by family and exclude non-divergent evolutions (matches UI display filtering)
  const seenFamilies = new Set<Pkm>()
  return raw.filter((pkm) => {
    const family = PkmFamily[pkm]
    if (seenFamilies.has(family)) return false
    seenFamilies.add(family)
    const familyBase = getPokemonData(family)
    const evo = familyBase.evolution
    if (evo === pkm) return false
    if (evo && getPokemonData(evo).evolution === pkm) return false
    return true
  })
}

export function getRegionalPokemonCandidates(
  region: string,
  act: number
): { candidates: Pkm[]; synergies: string[] } {
  const synergies = RegionDetails[region as DungeonPMDO]?.synergies ?? []
  return {
    candidates: getRegionalCandidates(region, act),
    synergies: synergies as string[]
  }
}

export function getRegionalPokemonForReward(
  region: string,
  act: number
): Pkm | null {
  const candidates = getRegionalCandidates(region, act)
  return candidates.length > 0 ? pickRandomIn(candidates) : null
}

// Acts 2 and 3 select reward Pokemon exactly like Act 1 (one 1★ base form per
// region synergy, any rarity), then roll per offered mon to upgrade it to its
// 2★ evolution: Act 2 only upgrades common/uncommon mons, Act 3 upgrades any
// rarity. Tunable.
const REWARD_TWO_STAR_UPGRADE_CHANCE = 0.5

// Returns the 2★ evolution of a 1★ base form, or null if it has none.
function get2StarForm(base: Pkm): Pkm | null {
  const data = getPokemonData(base)
  let evo: Pkm | null = data.evolution
  // Branching lines (no single evolution) — pick a random branch. Effectively
  // never happens at the 1★→2★ step, but handled for safety.
  if (!evo && data.evolutions.length > 0) {
    evo = pickRandomIn(data.evolutions)
  }
  if (!evo) return null
  return getPokemonData(evo).stars === 2 ? evo : null
}

export function generateWildRewardPokemon(region: string, act: number): Pkm[] {
  const synergies = RegionDetails[region as DungeonPMDO]?.synergies ?? []
  const picks: Pkm[] = []

  const isOfferable = (pkm: Pkm) => {
    const data = getPokemonData(pkm)
    return (
      data.rarity !== "HATCH" &&
      data.rarity !== "SPECIAL" &&
      data.rarity !== "UNIQUE" &&
      data.rarity !== "LEGENDARY" &&
      !picks.includes(pkm)
    )
  }
  const isCommonOrUncommon = (pkm: Pkm) => {
    const r = getPokemonData(pkm).rarity
    return r === "COMMON" || r === "UNCOMMON"
  }

  // Base selection — identical for all acts: one 1★ base form per synergy.
  for (const syn of synergies) {
    const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn] ?? []
    const valid = typed.filter(
      (pkm) => getPokemonData(pkm).stars === 1 && isOfferable(pkm)
    )
    if (valid.length > 0) picks.push(pickRandomIn(valid))
  }

  // 50% chance to replace a pick with a regional Pokemon, preferring a matching
  // synergy slot. Use Act 1 (1★ base) candidates so the upgrade pass below
  // applies uniformly in every act.
  if (randomFloat() < 0.5 && picks.length > 0) {
    const regionals = getRegionalCandidates(region, 1)
    if (regionals.length > 0) {
      const replacement = pickRandomIn(regionals)
      const replacementTypes = getPokemonData(replacement).types as string[]
      const matchingIdx = synergies.findIndex(
        (syn, i) => i < picks.length && replacementTypes.includes(syn as string)
      )
      const idx =
        matchingIdx >= 0 ? matchingIdx : randomBetween(0, picks.length - 1)
      picks[idx] = replacement
    }
  }

  // Upgrade pass: Acts 2+ offer some mons as their 2★ evolution. Act 2 limits
  // upgrades to common/uncommon lines; Act 3+ allows any rarity.
  if (act >= 2) {
    for (let i = 0; i < picks.length; i++) {
      const eligible = act >= 3 || isCommonOrUncommon(picks[i])
      if (eligible && randomFloat() < REWARD_TWO_STAR_UPGRADE_CHANCE) {
        const evo = get2StarForm(picks[i])
        if (evo) picks[i] = evo
      }
    }
  }

  return picks
}

// --- Spire reward-reroll tickets ---------------------------------------------

const REWARD_RARITY_LADDER = ["COMMON", "UNCOMMON", "RARE", "EPIC", "ULTRA"]

function nextRewardRarity(rarity: string): string {
  const i = REWARD_RARITY_LADDER.indexOf(rarity)
  if (i < 0) return rarity
  return REWARD_RARITY_LADDER[Math.min(i + 1, REWARD_RARITY_LADDER.length - 1)]
}

// Pick a 1★ base-form offerable Pokémon of the given rarity that has one of the
// synergies, excluding any already chosen. Tries synergies in order.
function pickRewardPokemonBy(
  rarity: string,
  synergies: string[],
  exclude: Pkm[]
): Pkm | null {
  const candidates: Pkm[] = []
  for (const syn of synergies) {
    const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn as Synergy] ?? []
    for (const pkm of typed) {
      const data = getPokemonData(pkm)
      if (
        data.rarity === rarity &&
        data.stars === 1 &&
        !exclude.includes(pkm) &&
        !candidates.includes(pkm)
      ) {
        candidates.push(pkm)
      }
    }
  }
  return candidates.length > 0 ? pickRandomIn(candidates) : null
}

// CLASS_REROLL_TICKET: each Pokémon -> same rarity, sharing a class synergy
// (ignores the region).
export function rerollWildRewardClass(
  current: Pkm[],
  classSynergies: string[]
): Pkm[] {
  const result: Pkm[] = []
  for (const pkm of current) {
    const rarity = getPokemonData(pkm).rarity
    const replacement =
      pickRewardPokemonBy(rarity, classSynergies, [...result, ...current]) ??
      pickRewardPokemonBy(rarity, classSynergies, [...result]) ??
      pkm
    result.push(replacement)
  }
  return result
}

// UPGRADE_TICKET: each Pokémon -> one rarity higher, keeping a region synergy,
// always swapping (if already at the top tier, a different same-tier mon).
export function rerollWildRewardUpgrade(current: Pkm[], region: string): Pkm[] {
  const regionSyns = (
    RegionDetails[region as DungeonPMDO]?.synergies ?? []
  ).map((s) => s as string)
  const result: Pkm[] = []
  for (const pkm of current) {
    const data = getPokemonData(pkm)
    const ownTypes = (data.types as string[]) ?? []
    const synOrder = [
      ...regionSyns.filter((s) => ownTypes.includes(s)),
      ...regionSyns
    ]
    const target = nextRewardRarity(data.rarity)
    const replacement =
      pickRewardPokemonBy(target, synOrder, [...result, pkm]) ??
      // can't go higher (top tier / none found) — force a different same-tier mon
      pickRewardPokemonBy(data.rarity, synOrder, [...result, pkm]) ??
      pkm
    result.push(replacement)
  }
  return result
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

export function calculateEncounterStats(
  encounter: SpireEncounter
): EncounterStats {
  const board = encounter.board
  if (board.length === 0)
    return { difficulty: 0, pokemonCount: 0, totalStars: 0, totalItems: 0 }

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
  totalScore *= 1 + synergyBonus * 0.1

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

export function getGoldReward(
  nodeType: string,
  act: number,
  floor: number = 0
): number {
  switch (nodeType) {
    case "WILD_BATTLE":
      return 2 + act
    case "ELITE":
      return 3 + act * 2
    case "UNLOCK":
      return 3 + act * 2
    case "GYM_LEADER":
      return 5 + act * 3
    case "LEGENDARY_BOSS":
      return 11 + act * 4
    case "ASYNC_FIGHT":
      return floor === 20 ? 11 + act * 4 : 3 + act * 2
    case "ELITE_FOUR":
      return 8 + act * 3
    case "CHAMPION":
      return 15 + act * 5
    default:
      return 0
  }
}

// ─── Elite Four ───────────────────────────────────────────────

const ELITE_FOUR_NAMES: Partial<Record<Synergy, string[]>> = {
  [Synergy.ICE]: ["Lorelei", "Glacia"],
  [Synergy.FIGHTING]: ["Bruno", "Marshal", "Hala"],
  [Synergy.GHOST]: ["Agatha", "Phoebe", "Shauntal", "Acerola"],
  [Synergy.DRAGON]: ["Lance", "Drake", "Drasna", "Hassel"],
  [Synergy.DARK]: ["Karen", "Sidney", "Grimsley"],
  [Synergy.PSYCHIC]: ["Will", "Lucian", "Caitlin"],
  [Synergy.POISON]: ["Koga"],
  [Synergy.BUG]: ["Aaron"],
  [Synergy.GROUND]: ["Bertha", "Rika"],
  [Synergy.FIRE]: ["Flint", "Malva"],
  [Synergy.WATER]: ["Siebold"],
  [Synergy.STEEL]: ["Wikstrom", "Poppy"],
  [Synergy.FLYING]: ["Kahili"],
  [Synergy.ROCK]: ["Olivia"],
  [Synergy.NORMAL]: ["Larry"],
  [Synergy.FAIRY]: ["Diantha", "Valerie"],
  [Synergy.GRASS]: ["Ramos"],
  [Synergy.ELECTRIC]: ["Volkner"]
}

const ELITE_FOUR_SYNERGIES: Synergy[] = Object.keys(
  ELITE_FOUR_NAMES
) as Synergy[]

export function getEliteFourSynergies(): Synergy[] {
  return ELITE_FOUR_SYNERGIES
}

export function getEliteFourDisplayName(synergy: string): string {
  const names = ELITE_FOUR_NAMES[synergy as Synergy]
  if (names && names.length > 0) return pickRandomIn(names)
  return synergy.replace(/_/g, " ")
}

export function generateEliteFourEncounter(
  synergy: Synergy,
  e4Index: number,
  mode: DifficultyMode = 1
): SpireEncounter {
  const floor = (e4Index + 1) * 2
  const difficulty = getDifficultyConfig(3, 18, mode)
  difficulty.pokemonCount = 9
  difficulty.starBudget = [
    difficulty.starBudget[0] + 6,
    difficulty.starBudget[1] + 10
  ]
  difficulty.maxStarsPerPokemon = 3
  difficulty.allowedRarities = [
    "COMMON",
    "UNCOMMON",
    "RARE",
    "EPIC",
    "ULTRA",
    "LEGENDARY",
    "UNIQUE"
  ]

  const signaturePokemon = GYM_LEADER_POKEMON[synergy] ?? []
  const names = ELITE_FOUR_NAMES[synergy] ?? ["Elite Four"]
  const name = pickRandomIn(names)

  const candidatePool: Pkm[] = []
  for (const pkm of signaturePokemon) {
    const data = getPokemonData(pkm)
    if (
      data.stars <= difficulty.maxStarsPerPokemon &&
      difficulty.allowedRarities.includes(data.rarity)
    ) {
      candidatePool.push(pkm)
    }
  }

  const typed = PRECOMPUTED_POKEMONS_PER_TYPE[synergy] ?? []
  for (const pkm of typed) {
    const data = getPokemonData(pkm)
    if (
      data.stars <= difficulty.maxStarsPerPokemon &&
      difficulty.allowedRarities.includes(data.rarity) &&
      !candidatePool.includes(pkm)
    ) {
      candidatePool.push(pkm)
    }
  }

  const uniqueTyped = typed.filter((pkm) => {
    const data = getPokemonData(pkm)
    return (
      data.stars <= difficulty.maxStarsPerPokemon &&
      (data.rarity === "ULTRA" ||
        data.rarity === "EPIC" ||
        data.rarity === "LEGENDARY" ||
        data.rarity === "UNIQUE") &&
      !candidatePool.includes(pkm)
    )
  })
  candidatePool.push(...uniqueTyped)

  const legendaries = typed.filter((pkm) => {
    const data = getPokemonData(pkm)
    return data.rarity === "LEGENDARY" || data.rarity === "UNIQUE"
  })
  let legendaryPick: Pkm | null = null
  if (legendaries.length > 0) {
    legendaryPick = pickRandomIn(legendaries)
  }

  if (candidatePool.length === 0) {
    for (const pkm of typed) {
      const data = getPokemonData(pkm)
      if (
        data.stars <= difficulty.maxStarsPerPokemon &&
        !candidatePool.includes(pkm)
      ) {
        candidatePool.push(pkm)
      }
    }
  }

  const targetCount = 9
  const gymDifficulty = { ...difficulty, pokemonCount: targetCount }
  const selected: Pkm[] = []

  if (legendaryPick) {
    selected.push(legendaryPick)
    gymDifficulty.pokemonCount--
    gymDifficulty.starBudget = [
      Math.max(
        gymDifficulty.pokemonCount,
        gymDifficulty.starBudget[0] - getPokemonData(legendaryPick).stars
      ),
      Math.max(
        gymDifficulty.pokemonCount,
        gymDifficulty.starBudget[1] - getPokemonData(legendaryPick).stars
      )
    ]
  }

  const sigCandidates = candidatePool.filter((p) =>
    signaturePokemon.includes(p)
  )
  const otherCandidates = candidatePool.filter(
    (p) => !signaturePokemon.includes(p)
  )
  selected.push(
    ...selectWithStarBudget(
      candidatePool,
      sigCandidates,
      otherCandidates,
      gymDifficulty
    )
  )

  if (selected.length === 0 && signaturePokemon.length > 0) {
    selected.push(
      ...pickNRandomIn(signaturePokemon, Math.min(5, signaturePokemon.length))
    )
  }

  const board: [Pkm, number, number][] = []
  const frontRow: [number, number][] = [
    [2, 3],
    [3, 3],
    [4, 3],
    [5, 3],
    [6, 3]
  ]
  const midRow: [number, number][] = [
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 2]
  ]
  const backRow: [number, number][] = [
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 1]
  ]
  let fi = 0,
    mi = 0,
    bi = 0
  selected.forEach((pkm) => {
    const range = getPokemonData(pkm).range
    if (range <= 1 && fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]])
      fi++
    } else if (range === 2 && mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]])
      mi++
    } else if (range >= 3 && bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]])
      bi++
    } else if (fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]])
      fi++
    } else if (mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]])
      mi++
    } else if (bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]])
      bi++
    }
  })

  const items = generateEncounterItems(selected.length, 1, 2, true)

  const bonusHP = 200 + e4Index * 100
  const bonusAtk = 10 + e4Index * 5
  const bonusAP = 30 + e4Index * 20

  return addHardModeItems(
    {
      name,
      avatar: selected[0],
      board,
      items,
      synergy,
      bonusHP,
      bonusAtk,
      bonusAP
    },
    4,
    floor,
    mode
  )
}

// ─── Champions ────────────────────────────────────────────────

const CHAMPION_ENCOUNTERS: SpireEncounter[] = [
  {
    name: "Blue",
    avatar: Pkm.PIDGEOT,
    board: [
      [Pkm.PIDGEOT, 4, 1],
      [Pkm.ALAKAZAM, 3, 1],
      [Pkm.EXEGGUTOR, 5, 1],
      [Pkm.MACHAMP, 2, 2],
      [Pkm.GYARADOS, 4, 2],
      [Pkm.GENGAR, 6, 2],
      [Pkm.RHYDON, 2, 3],
      [Pkm.ARCANINE, 4, 3],
      [Pkm.MEWTWO, 5, 3],
      [Pkm.SNORLAX, 6, 3]
    ],
    items: [
      [Item.RAZOR_FANG, Item.RAZOR_CLAW],
      [Item.CHOICE_SPECS, Item.POWER_LENS],
      [Item.MIRACLE_SEED, Item.SHELL_BELL],
      [Item.BLACK_BELT, Item.ASSAULT_VEST],
      [Item.MYSTIC_WATER, Item.SCOPE_LENS],
      [Item.SPELL_TAG, Item.CHOICE_SPECS],
      [Item.ROCKY_HELMET, Item.ASSAULT_VEST],
      [Item.CHARCOAL, Item.RAZOR_FANG],
      [Item.CHOICE_SPECS, Item.SCOPE_LENS, Item.POWER_LENS],
      [Item.LEFTOVERS, Item.ASSAULT_VEST]
    ],
    bonusHP: 800,
    bonusAtk: 30,
    bonusAP: 80
  },
  {
    name: "Lance",
    avatar: Pkm.DRAGONITE,
    board: [
      [Pkm.DRAGONITE, 3, 1],
      [Pkm.CHARIZARD, 5, 1],
      [Pkm.AERODACTYL, 2, 1],
      [Pkm.GYARADOS, 2, 2],
      [Pkm.SALAMENCE, 4, 2],
      [Pkm.KINGDRA, 6, 2],
      [Pkm.DRAGONITE, 3, 3],
      [Pkm.DRAGONITE, 4, 3],
      [Pkm.GARCHOMP, 5, 3],
      [Pkm.RAYQUAZA, 6, 3]
    ],
    items: [
      [Item.DRAGON_SCALE, Item.SCOPE_LENS],
      [Item.CHARCOAL, Item.SHELL_BELL],
      [Item.RAZOR_FANG, Item.RAZOR_CLAW],
      [Item.MYSTIC_WATER, Item.WIDE_LENS],
      [Item.DRAGON_SCALE, Item.ASSAULT_VEST],
      [Item.DRAGON_SCALE, Item.CHOICE_SPECS],
      [Item.DRAGON_SCALE, Item.RAZOR_CLAW],
      [Item.DRAGON_SCALE, Item.ASSAULT_VEST, Item.SCOPE_LENS],
      [Item.DRAGON_SCALE, Item.RAZOR_FANG],
      [Item.DRAGON_SCALE, Item.CHOICE_SPECS, Item.POWER_LENS]
    ],
    bonusHP: 800,
    bonusAtk: 30,
    bonusAP: 80
  },
  {
    name: "Steven",
    avatar: Pkm.METAGROSS,
    board: [
      [Pkm.CLAYDOL, 3, 1],
      [Pkm.CRADILY, 5, 1],
      [Pkm.SKARMORY, 2, 1],
      [Pkm.ARMALDO, 2, 2],
      [Pkm.METAGROSS, 4, 2],
      [Pkm.REGISTEEL, 6, 2],
      [Pkm.AGGRON, 3, 3],
      [Pkm.STEELIX, 4, 3],
      [Pkm.DIALGA, 5, 3],
      [Pkm.JIRACHI, 6, 3]
    ],
    items: [
      [Item.CHOICE_SPECS, Item.POWER_LENS],
      [Item.MIRACLE_SEED, Item.SHELL_BELL],
      [Item.RAZOR_FANG, Item.RAZOR_CLAW],
      [Item.ROCKY_HELMET, Item.RAZOR_CLAW],
      [Item.METAL_COAT, Item.ASSAULT_VEST, Item.SCOPE_LENS],
      [Item.METAL_COAT, Item.ASSAULT_VEST],
      [Item.METAL_COAT, Item.ROCKY_HELMET],
      [Item.METAL_COAT, Item.ASSAULT_VEST],
      [Item.METAL_COAT, Item.CHOICE_SPECS, Item.POWER_LENS],
      [Item.METAL_COAT, Item.SHELL_BELL]
    ],
    bonusHP: 800,
    bonusAtk: 30,
    bonusAP: 80
  },
  {
    name: "Cynthia",
    avatar: Pkm.GARCHOMP,
    board: [
      [Pkm.ROSERADE, 3, 1],
      [Pkm.TOGEKISS, 5, 1],
      [Pkm.MILOTIC, 2, 1],
      [Pkm.SPIRITOMB, 2, 2],
      [Pkm.LUCARIO, 4, 2],
      [Pkm.GLACEON, 6, 2],
      [Pkm.GARCHOMP, 3, 3],
      [Pkm.SALAMENCE, 4, 3],
      [Pkm.GIRATINA, 5, 3],
      [Pkm.DIALGA, 6, 3]
    ],
    items: [
      [Item.MIRACLE_SEED, Item.CHOICE_SPECS],
      [Item.RAZOR_FANG, Item.WIDE_LENS],
      [Item.MYSTIC_WATER, Item.POWER_LENS],
      [Item.SPELL_TAG, Item.SHELL_BELL],
      [Item.BLACK_BELT, Item.ASSAULT_VEST, Item.SCOPE_LENS],
      [Item.ICY_ROCK, Item.CHOICE_SPECS],
      [Item.DRAGON_SCALE, Item.SCOPE_LENS, Item.RAZOR_CLAW],
      [Item.DRAGON_SCALE, Item.ASSAULT_VEST],
      [Item.SPELL_TAG, Item.CHOICE_SPECS, Item.POWER_LENS],
      [Item.METAL_COAT, Item.ASSAULT_VEST]
    ],
    bonusHP: 800,
    bonusAtk: 30,
    bonusAP: 80
  },
  {
    name: "Iris",
    avatar: Pkm.HYDREIGON,
    board: [
      [Pkm.LAPRAS, 3, 1],
      [Pkm.SALAMENCE, 5, 1],
      [Pkm.ARCHEOPS, 2, 1],
      [Pkm.HYDREIGON, 2, 2],
      [Pkm.DRAGONITE, 4, 2],
      [Pkm.HAXORUS, 6, 2],
      [Pkm.DRUDDIGON, 3, 3],
      [Pkm.AGGRON, 4, 3],
      [Pkm.GARCHOMP, 5, 3],
      [Pkm.RESHIRAM, 6, 3]
    ],
    items: [
      [Item.MYSTIC_WATER, Item.SHELL_BELL],
      [Item.DRAGON_SCALE, Item.RAZOR_FANG],
      [Item.RAZOR_FANG, Item.RAZOR_CLAW],
      [Item.DRAGON_SCALE, Item.CHOICE_SPECS, Item.SCOPE_LENS],
      [Item.DRAGON_SCALE, Item.ASSAULT_VEST],
      [Item.DRAGON_SCALE, Item.RAZOR_CLAW, Item.SCOPE_LENS],
      [Item.DRAGON_SCALE, Item.ASSAULT_VEST],
      [Item.METAL_COAT, Item.ROCKY_HELMET],
      [Item.DRAGON_SCALE, Item.RAZOR_FANG],
      [Item.CHARCOAL, Item.CHOICE_SPECS, Item.POWER_LENS]
    ],
    bonusHP: 800,
    bonusAtk: 30,
    bonusAP: 80
  },
  {
    name: "Diantha",
    avatar: Pkm.GARDEVOIR,
    board: [
      [Pkm.GARDEVOIR, 3, 1],
      [Pkm.AURORUS, 5, 1],
      [Pkm.GOURGEIST, 2, 1],
      [Pkm.HAWLUCHA, 2, 2],
      [Pkm.GOODRA, 4, 2],
      [Pkm.TYRANTRUM, 6, 2],
      [Pkm.SYLVEON, 3, 3],
      [Pkm.DIANCIE, 4, 3],
      [Pkm.XERNEAS, 5, 3],
      [Pkm.ZYGARDE_50, 6, 3]
    ],
    items: [
      [Item.CHOICE_SPECS, Item.POWER_LENS, Item.SHELL_BELL],
      [Item.ICY_ROCK, Item.WIDE_LENS],
      [Item.SPELL_TAG, Item.SCOPE_LENS],
      [Item.BLACK_BELT, Item.RAZOR_CLAW],
      [Item.DRAGON_SCALE, Item.ROCKY_HELMET],
      [Item.ROCKY_HELMET, Item.ASSAULT_VEST],
      [Item.RAZOR_FANG, Item.CHOICE_SPECS],
      [Item.CHOICE_SPECS, Item.POWER_LENS, Item.SCOPE_LENS],
      [Item.RAZOR_FANG, Item.WIDE_LENS, Item.SHELL_BELL],
      [Item.DRAGON_SCALE, Item.ASSAULT_VEST]
    ],
    bonusHP: 800,
    bonusAtk: 30,
    bonusAP: 80
  }
]

export function getChampionEncounter(mode: DifficultyMode = 1): SpireEncounter {
  const champion = pickRandomIn(CHAMPION_ENCOUNTERS)
  return adjustEncounterItems(champion, mode)
}

export function getArceusEncounter(mode: DifficultyMode = 1): SpireEncounter {
  return {
    name: "Arceus",
    avatar: Pkm.ARCEUS,
    board: [[Pkm.ARCEUS, 4, mode === 3 ? 3 : 2]],
    items: [
      [
        Item.CHOICE_SPECS,
        Item.SCOPE_LENS,
        Item.SHELL_BELL,
        Item.MUSCLE_BAND,
        Item.UPGRADE,
        Item.SOUL_DEW,
        Item.ROCKY_HELMET,
        Item.SAFETY_GOGGLES,
        Item.GREEN_ORB,
        Item.BLUE_ORB,
        Item.RED_ORB,
        Item.MAX_REVIVE,
        Item.STICKY_BARB,
        Item.POWER_LENS,
        Item.TWIST_BAND,
        Item.LEGEND_PLATE
      ]
    ],
    bonusHP: 100000,
    bonusAtk: 150,
    bonusDef: 60,
    bonusSpeDef: 60,
    bonusAP: 500
  }
}
