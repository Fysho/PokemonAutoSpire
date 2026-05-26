import { RegionDetails } from "../config"
import { PRECOMPUTED_REGIONAL_MONS } from "./precomputed/precomputed-pokemon-data"
import { getPokemonData } from "./precomputed/precomputed-pokemon-data"
import { PRECOMPUTED_POKEMONS_PER_TYPE } from "./precomputed/precomputed-types"
import { DungeonPMDO } from "../types/enum/Dungeon"
import { Pkm, PkmFamily } from "../types/enum/Pokemon"
import { CraftableItems, Item, ItemComponentsNoFossilOrScarf, NonSpecialBerries, Tools } from "../types/enum/Item"
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
  bonusDef?: number
  bonusSpeDef?: number
  bonusAP?: number
  bonusPP?: number
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

// Gym leader signature Pokemon by synergy type
const GYM_LEADER_POKEMON: Partial<Record<Synergy, Pkm[]>> = {
  [Synergy.ROCK]: [Pkm.GEODUDE, Pkm.GRAVELER, Pkm.GOLEM, Pkm.ONIX, Pkm.STEELIX, Pkm.TYRANITAR, Pkm.GIGALITH, Pkm.LYCANROC, Pkm.BOLDORE],
  [Synergy.WATER]: [Pkm.STARYU, Pkm.STARMIE, Pkm.GYARADOS, Pkm.LAPRAS, Pkm.MILOTIC, Pkm.QUAGSIRE, Pkm.LUDICOLO, Pkm.WHISCASH, Pkm.KINGDRA, Pkm.POLIWAG, Pkm.POLIWHIRL, Pkm.POLIWRATH],
  [Synergy.ELECTRIC]: [Pkm.PICHU, Pkm.PIKACHU, Pkm.RAICHU, Pkm.ELECTRODE, Pkm.ELECTABUZZ, Pkm.JOLTEON, Pkm.LUXRAY, Pkm.LUXIO, Pkm.SHINX, Pkm.MAGNEZONE, Pkm.MAGNETON, Pkm.MAGNEMITE, Pkm.VOLTORB],
  [Synergy.GRASS]: [Pkm.ODDISH, Pkm.GLOOM, Pkm.VILEPLUME, Pkm.BELLSPROUT, Pkm.WEEPINBELL, Pkm.VICTREEBEL, Pkm.VENUSAUR, Pkm.ROSERADE, Pkm.TANGROWTH, Pkm.TANGELA],
  [Synergy.FIRE]: [Pkm.VULPIX, Pkm.NINETALES, Pkm.GROWLITHE, Pkm.ARCANINE, Pkm.MAGMAR, Pkm.TORKOAL, Pkm.SLUGMA, Pkm.MAGCARGO, Pkm.NUMEL, Pkm.BLAZIKEN, Pkm.INFERNAPE],
  [Synergy.GHOST]: [Pkm.GASTLY, Pkm.HAUNTER, Pkm.GENGAR, Pkm.MISDREAVUS, Pkm.MISMAGIUS, Pkm.DRIFBLIM, Pkm.CHANDELURE, Pkm.DUSKULL, Pkm.DUSCLOPS, Pkm.SPIRITOMB],
  [Synergy.FIGHTING]: [Pkm.MACHOP, Pkm.MACHOKE, Pkm.MACHAMP, Pkm.LUCARIO, Pkm.POLIWRATH, Pkm.PRIMEAPE, Pkm.HITMONLEE, Pkm.HITMONCHAN, Pkm.GALLADE],
  [Synergy.PSYCHIC]: [Pkm.ABRA, Pkm.KADABRA, Pkm.ALAKAZAM, Pkm.GARDEVOIR, Pkm.GALLADE, Pkm.METAGROSS, Pkm.RALTS, Pkm.KIRLIA, Pkm.DROWZEE],
  [Synergy.POISON]: [Pkm.KOFFING, Pkm.WEEZING, Pkm.GRIMER, Pkm.MUK, Pkm.CROBAT, Pkm.TOXICROAK, Pkm.SCOLIPEDE, Pkm.NIDOKING, Pkm.NIDOQUEEN],
  [Synergy.DRAGON]: [Pkm.DRATINI, Pkm.DRAGONAIR, Pkm.DRAGONITE, Pkm.GARCHOMP, Pkm.SALAMENCE, Pkm.KINGDRA, Pkm.HAXORUS, Pkm.HYDREIGON, Pkm.GIBLE, Pkm.GABITE],
  [Synergy.DARK]: [Pkm.WEAVILE, Pkm.ABSOL, Pkm.HONCHKROW, Pkm.UMBREON, Pkm.DRAPION, Pkm.SPIRITOMB, Pkm.BISHARP],
  [Synergy.STEEL]: [Pkm.STEELIX, Pkm.SCIZOR, Pkm.MAGNEMITE, Pkm.MAGNETON, Pkm.MAGNEZONE, Pkm.FORRETRESS, Pkm.EMPOLEON, Pkm.METAGROSS],
  [Synergy.ICE]: [Pkm.MAMOSWINE, Pkm.FROSLASS, Pkm.GLACEON, Pkm.ABOMASNOW, Pkm.WALREIN, Pkm.LAPRAS, Pkm.SNORUNT, Pkm.GLALIE, Pkm.SWINUB, Pkm.PILOSWINE],
  [Synergy.GROUND]: [Pkm.RHYHORN, Pkm.RHYDON, Pkm.RHYPERIOR, Pkm.FLYGON, Pkm.EXCADRILL, Pkm.DUGTRIO, Pkm.NIDOKING, Pkm.GIBLE, Pkm.GABITE, Pkm.GARCHOMP],
  [Synergy.FLYING]: [Pkm.PIDGEOT, Pkm.STARAPTOR, Pkm.SKARMORY, Pkm.ALTARIA, Pkm.SWELLOW, Pkm.SWABLU, Pkm.TAILLOW, Pkm.DRIFBLIM, Pkm.CROBAT],
  [Synergy.FAIRY]: [Pkm.CLEFABLE, Pkm.TOGEKISS, Pkm.MIMIKYU, Pkm.MAWILE, Pkm.SYLVEON, Pkm.CLEFAIRY, Pkm.TOGEPI, Pkm.TOGETIC, Pkm.GARDEVOIR],
  [Synergy.NORMAL]: [Pkm.SLAKOTH, Pkm.VIGOROTH, Pkm.SLAKING, Pkm.SNORLAX, Pkm.CHANSEY, Pkm.BLISSEY, Pkm.AMBIPOM, Pkm.RATTATA, Pkm.RATICATE],
  [Synergy.BUG]: [Pkm.SCIZOR, Pkm.FORRETRESS, Pkm.SCOLIPEDE, Pkm.CATERPIE, Pkm.METAPOD, Pkm.BUTTERFREE, Pkm.WEEDLE, Pkm.KAKUNA, Pkm.BEEDRILL],
  [Synergy.FIELD]: [Pkm.LILLIPUP, Pkm.HERDIER, Pkm.STOUTLAND, Pkm.SKITTY, Pkm.DELCATTY, Pkm.EEVEE, Pkm.ZIGZAGOON, Pkm.LINOONE],
  [Synergy.ARTIFICIAL]: [Pkm.KLINK, Pkm.KLANG, Pkm.KLINKLANG, Pkm.VOLTORB, Pkm.ELECTRODE, Pkm.VAROOM, Pkm.REVAVROOM, Pkm.KOFFING, Pkm.WEEZING],
  [Synergy.AQUATIC]: [Pkm.POLIWAG, Pkm.POLIWHIRL, Pkm.POLIWRATH, Pkm.WOOPER, Pkm.QUAGSIRE, Pkm.TENTACOOL, Pkm.TENTACRUEL, Pkm.BIDOOF, Pkm.BIBAREL],
  [Synergy.MONSTER]: [Pkm.ARON, Pkm.LAIRON, Pkm.AGGRON, Pkm.TURTWIG, Pkm.GROTLE, Pkm.TORTERRA, Pkm.BAGON, Pkm.SHELGON, Pkm.SANDILE, Pkm.KROKOROK],
  [Synergy.AMORPHOUS]: [Pkm.METAPOD, Pkm.SCATTERBUG, Pkm.SPEWPA, Pkm.GRIMER, Pkm.MUK, Pkm.SANDYGAST, Pkm.PALOSSAND],
  [Synergy.WILD]: [Pkm.RATTATA, Pkm.RATICATE, Pkm.SPEAROW, Pkm.FEAROW, Pkm.AIPOM, Pkm.AMBIPOM],
  [Synergy.SOUND]: [Pkm.ZUBAT, Pkm.GOLBAT, Pkm.CROBAT, Pkm.IGGLYBUFF, Pkm.JIGGLYPUFF, Pkm.WIGGLYTUFF, Pkm.WHISMUR, Pkm.LOUDRED],
  [Synergy.FLORA]: [Pkm.SPRIGATITO, Pkm.FLORAGATO, Pkm.BULBASAUR, Pkm.IVYSAUR, Pkm.VENUSAUR, Pkm.SUNKERN, Pkm.SUNFLORA],
  [Synergy.BABY]: [Pkm.PICHU, Pkm.AZURILL, Pkm.IGGLYBUFF, Pkm.CLEFFA, Pkm.TOGEPI, Pkm.RIOLU],
  [Synergy.HUMAN]: [Pkm.FENNEKIN, Pkm.BRAIXEN, Pkm.MACHOP, Pkm.MACHOKE, Pkm.MACHAMP, Pkm.CHIMCHAR, Pkm.MONFERNO, Pkm.INFERNAPE, Pkm.PETILIL],
  [Synergy.LIGHT]: [Pkm.MAREEP, Pkm.FLAFFY, Pkm.AMPHAROS, Pkm.LITWICK, Pkm.LAMPENT, Pkm.CHANDELURE, Pkm.CHINCHOU, Pkm.LANTURN, Pkm.ROGGENROLA, Pkm.BOLDORE],
  [Synergy.GOURMET]: [Pkm.SMOLIV, Pkm.DOLLIV, Pkm.ARBOLIVA, Pkm.LICKITUNG, Pkm.LICKILICKY, Pkm.MUNCHLAX, Pkm.NACLI, Pkm.NACLSTACK, Pkm.GARGANACL],
  [Synergy.FOSSIL]: [Pkm.KABUTO, Pkm.KABUTOPS, Pkm.OMANYTE, Pkm.OMASTAR, Pkm.ANORITH, Pkm.ARMALDO, Pkm.CRANIDOS, Pkm.RAMPARDOS]
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
  [Synergy.ARTIFICIAL]: ["Artificial Gym"],
  [Synergy.AQUATIC]: ["Aquatic Gym"],
  [Synergy.MONSTER]: ["Monster Gym"],
  [Synergy.AMORPHOUS]: ["Amorphous Gym"],
  [Synergy.WILD]: ["Wild Gym"],
  [Synergy.SOUND]: ["Sound Gym"],
  [Synergy.FLORA]: ["Flora Gym"],
  [Synergy.BABY]: ["Baby Gym"],
  [Synergy.HUMAN]: ["Human Gym"],
  [Synergy.LIGHT]: ["Light Gym"],
  [Synergy.GOURMET]: ["Gourmet Gym"],
  [Synergy.FOSSIL]: ["Fossil Gym"]
}

// ─── Adding a new Elite Encounter ───────────────────────────────
// 1. Add the template to the appropriate ACT*_ELITE_ENCOUNTERS array below.
//    - `avatar`: the Pokemon whose sprite shows on the map node.
//    - `board`: positions use x=2-6, y=1 (back) / y=2 (mid) / y=3 (front).
//    - `rewards`: Pokemon offered to the player on win.
// 2. If items are needed, add a named handler in getEliteEncounterBase()
//    (search for "Cursed Grotto" for an example). Items array indices must
//    match the board array order.
// 3. Create a map-node sprite for the avatar Pokemon:
//    - Open the spritesheet JSON at app/public/src/assets/pokemons/<PkmIndex>.json
//    - Find frame "Normal/Idle/Anim/7/0001" (direction 7 = southwest / down-left)
//    - Extract that frame, place it on a transparent canvas at sourceSize, scale 2x
//    - Save as app/public/src/assets/ui/elite-sprites-v2/<PkmIndex>.png
//    - ALSO copy to app/public/dist/client/assets/ui/elite-sprites-v2/<PkmIndex>.png
//      (esbuild does not copy assets to dist; both locations are required)

export type EliteEncounterTemplate = {
  name: string
  avatar: Pkm
  pokemon: Pkm[]
  rewards: Pkm[]
  board: [pkm: Pkm, x: number, y: number][]
  eliteType?: "legendary" | "unique"
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
  },
  {
    name: "Bat Cave",
    avatar: Pkm.GOLBAT,
    pokemon: [Pkm.GOLBAT, Pkm.NOIBAT, Pkm.SWOOBAT],
    rewards: [Pkm.ZUBAT, Pkm.WOOBAT, Pkm.NOIBAT],
    board: []
  },
  {
    name: "Rock Tunnel",
    avatar: Pkm.LAIRON,
    pokemon: [Pkm.LAIRON, Pkm.GRAVELER, Pkm.ONIX],
    rewards: [Pkm.LAIRON, Pkm.GRAVELER, Pkm.ONIX],
    board: []
  },
  {
    name: "Bug Swarm",
    avatar: Pkm.CATERPIE,
    pokemon: [Pkm.CATERPIE, Pkm.WEEDLE, Pkm.SCATTERBUG, Pkm.GRUBBIN],
    rewards: [Pkm.SCATTERBUG, Pkm.GRUBBIN],
    board: []
  }
]

// Act 2: Mid evolutions, reward 2-star Pokemon
const ACT2_ELITE_ENCOUNTERS: EliteEncounterTemplate[] = [
  {
    name: "Iron Defense",
    avatar: Pkm.METAGROSS,
    pokemon: [Pkm.METAGROSS, Pkm.AGGRON, Pkm.LUCARIO, Pkm.SCIZOR],
    rewards: [Pkm.BELDUM, Pkm.RIOLU, Pkm.SCYTHER],
    board: [[Pkm.METAGROSS, 4, 2], [Pkm.AGGRON, 2, 1], [Pkm.LUCARIO, 6, 1], [Pkm.SCIZOR, 4, 1]]
  },
  {
    name: "Psychic Conclave",
    avatar: Pkm.ALAKAZAM,
    pokemon: [Pkm.GARDEVOIR, Pkm.ALAKAZAM, Pkm.DELPHOX, Pkm.HYPNO],
    rewards: [Pkm.ABRA, Pkm.RALTS, Pkm.DROWZEE, Pkm.FENNEKIN],
    board: [[Pkm.GARDEVOIR, 3, 2], [Pkm.ALAKAZAM, 5, 2], [Pkm.DELPHOX, 2, 1], [Pkm.HYPNO, 6, 1]]
  },
  {
    name: "Sleeping Giant",
    avatar: Pkm.SNORLAX,
    pokemon: [Pkm.SNORLAX, Pkm.SLAKING],
    rewards: [Pkm.SNORLAX, Pkm.SLAKOTH],
    board: [[Pkm.SNORLAX, 3, 2], [Pkm.SLAKING, 5, 2]]
  },
  {
    name: "Poltergeist",
    avatar: Pkm.ROTOM,
    pokemon: [Pkm.ROTOM_WASH, Pkm.ROTOM_HEAT, Pkm.ROTOM_FROST, Pkm.ROTOM_FAN, Pkm.ROTOM_MOW, Pkm.ROTOM_DRONE],
    rewards: [],
    board: []
  },
  {
    name: "Dark Omen",
    avatar: Pkm.DARKRAI,
    pokemon: [Pkm.ABSOL, Pkm.SPIRITOMB, Pkm.MEGA_SABLEYE, Pkm.DARKRAI],
    rewards: [Pkm.ABSOL, Pkm.SPIRITOMB, Pkm.SABLEYE],
    board: [[Pkm.ABSOL, 3, 2], [Pkm.SPIRITOMB, 5, 2], [Pkm.MEGA_SABLEYE, 4, 3], [Pkm.DARKRAI, 4, 1]],
    items: [[], [], [Item.RED_ORB], []]
  },
  {
    name: "Masquerade",
    avatar: Pkm.MIMIKYU,
    pokemon: [Pkm.MIMIKYU, Pkm.ZOROARK, Pkm.DITTO],
    rewards: [Pkm.MIMIKYU, Pkm.DITTO, Pkm.ZORUA],
    board: [
      [Pkm.MIMIKYU, 3, 2],
      [Pkm.ZOROARK, 4, 1],
      [Pkm.MEOWSCARADA, 2, 2], [Pkm.MEOWSCARADA, 5, 2],
      [Pkm.DITTO, 0, 3], [Pkm.DITTO, 1, 3], [Pkm.DITTO, 2, 3], [Pkm.DITTO, 3, 3],
      [Pkm.DITTO, 4, 3], [Pkm.DITTO, 5, 3], [Pkm.DITTO, 6, 3], [Pkm.DITTO, 7, 3]
    ]
  },
  {
    name: "Cursed Grotto",
    avatar: Pkm.HOUNDOOM,
    pokemon: [Pkm.HOUNDOOM, Pkm.BANETTE, Pkm.GRAVELER, Pkm.BOLDORE, Pkm.LAIRON, Pkm.PUPITAR],
    rewards: [Pkm.HOUNDOUR, Pkm.SHUPPET],
    board: [
      [Pkm.GRAVELER, 2, 3], [Pkm.BOLDORE, 4, 3], [Pkm.LAIRON, 5, 3], [Pkm.PUPITAR, 6, 3],
      [Pkm.HOUNDOOM, 3, 1], [Pkm.BANETTE, 5, 1]
    ]
  }
]

// Act 3: Fully evolved, reward 3-star Pokemon
const ACT3_ELITE_ENCOUNTERS: EliteEncounterTemplate[] = [
  {
    name: "Dragon's Den",
    avatar: Pkm.SALAMENCE,
    pokemon: [Pkm.SALAMENCE, Pkm.GARCHOMP, Pkm.DRAGONITE, Pkm.FLYGON, Pkm.GOODRA, Pkm.CHARIZARD, Pkm.KINGDRA, Pkm.HYDREIGON],
    rewards: [Pkm.SHELGON, Pkm.GABITE, Pkm.DRAGONAIR, Pkm.VIBRAVA, Pkm.GOOMY, Pkm.CHARMELEON, Pkm.SEADRA, Pkm.ZWEILOUS],
    board: []
  },
  {
    name: "Tyrant's Court",
    avatar: Pkm.TYRANITAR,
    pokemon: [Pkm.TYRANITAR, Pkm.AERODACTYL, Pkm.GOLEM, Pkm.AGGRON, Pkm.RHYPERIOR, Pkm.STEELIX],
    rewards: [Pkm.PUPITAR, Pkm.AERODACTYL, Pkm.GRAVELER, Pkm.LAIRON, Pkm.RHYHORN, Pkm.ONIX],
    board: [
      [Pkm.TYRANITAR, 4, 3], [Pkm.AERODACTYL, 2, 3], [Pkm.GOLEM, 6, 2],
      [Pkm.AGGRON, 2, 1], [Pkm.RHYPERIOR, 6, 1], [Pkm.STEELIX, 4, 1]
    ]
  },
  {
    name: "Celestial Court",
    avatar: Pkm.TOGEKISS,
    pokemon: [Pkm.TOGEKISS, Pkm.GARDEVOIR, Pkm.FLORGES, Pkm.CLEFABLE, Pkm.SYLVEON, Pkm.AZUMARILL, Pkm.WIGGLYTUFF, Pkm.GRANBULL, Pkm.PRIMARINA, Pkm.HATTERENE, Pkm.TAPU_FINI, Pkm.TAPU_LELE, Pkm.XERNEAS, Pkm.DIANCIE],
    rewards: [Pkm.TOGEPI, Pkm.RALTS, Pkm.FLABEBE, Pkm.CLEFFA, Pkm.EEVEE, Pkm.MARILL, Pkm.IGGLYBUFF, Pkm.POPPLIO, Pkm.HATENNA],
    board: []
  },
  {
    name: "Mother's Fury",
    avatar: Pkm.KANGASKHAN,
    pokemon: [Pkm.KANGASKHAN, Pkm.KANGASKHAN, Pkm.KANGASKHAN, Pkm.KANGASKHAN, Pkm.BLISSEY, Pkm.BLISSEY, Pkm.MAUSHOLD_FOUR],
    rewards: [Pkm.KANGASKHAN],
    board: [[Pkm.KANGASKHAN, 3, 3], [Pkm.KANGASKHAN, 5, 3], [Pkm.KANGASKHAN, 2, 2], [Pkm.KANGASKHAN, 6, 2], [Pkm.BLISSEY, 2, 1], [Pkm.BLISSEY, 6, 1], [Pkm.MAUSHOLD_FOUR, 4, 1]]
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

const LEGENDARY_ELITE_ENCOUNTERS: EliteEncounterTemplate[] = [
  Pkm.KYUREM, Pkm.RESHIRAM, Pkm.ZEKROM, Pkm.STAKATAKA, Pkm.GENESECT,
  Pkm.GUZZLORD, Pkm.ETERNATUS, Pkm.MELOETTA, Pkm.MEW, Pkm.MEWTWO,
  Pkm.ENTEI, Pkm.SUICUNE, Pkm.RAIKOU, Pkm.REGIDRAGO, Pkm.REGIELEKI,
  Pkm.REGICE, Pkm.REGISTEEL, Pkm.REGIROCK, Pkm.REGIGIGAS, Pkm.CELEBI,
  Pkm.VICTINI, Pkm.JIRACHI, Pkm.ARCEUS, Pkm.DEOXYS, Pkm.SHAYMIN,
  Pkm.GIRATINA, Pkm.DARKRAI, Pkm.CRESSELIA, Pkm.HEATRAN, Pkm.LUGIA,
  Pkm.HO_OH, Pkm.PALKIA, Pkm.DIALGA, Pkm.RAYQUAZA, Pkm.KYOGRE,
  Pkm.GROUDON, Pkm.VOLCANION, Pkm.MARSHADOW, Pkm.TYPE_NULL, Pkm.XERNEAS,
  Pkm.YVELTAL, Pkm.ZAPDOS, Pkm.MOLTRES, Pkm.ARTICUNO, Pkm.SPECTRIER,
  Pkm.GLASTRIER, Pkm.KARTANA, Pkm.NECROZMA, Pkm.XURKITREE, Pkm.NIHILEGO,
  Pkm.PHEROMOSA, Pkm.BUZZWOLE, Pkm.TORNADUS, Pkm.THUNDURUS, Pkm.LANDORUS,
  Pkm.ENAMORUS, Pkm.MAGEARNA, Pkm.MELMETAL, Pkm.ZYGARDE_50, Pkm.TERRAKION,
  Pkm.VIRIZION, Pkm.COBALION, Pkm.KELDEO, Pkm.PECHARUNT, Pkm.ROARING_MOON,
  Pkm.ZACIAN, Pkm.IRON_VALIANT, Pkm.OKIDOGI, Pkm.MUNKIDORI, Pkm.FEZANDIPITI,
  Pkm.CELESTEELA, Pkm.OGERPON_TEAL, Pkm.MANAPHY, Pkm.CHI_YU, Pkm.BLACEPHALON
].map(pkm => ({
  name: getPokemonData(pkm).name.replace(/_/g, " "),
  avatar: pkm,
  pokemon: [],
  rewards: [],
  board: [],
  eliteType: "legendary" as const
}))

const UNIQUE_ELITE_ENCOUNTERS: EliteEncounterTemplate[] = [
  Pkm.ABSOL, Pkm.AERODACTYL, Pkm.APPLIN, Pkm.ARCTOVISH, Pkm.ARCTOZOLT,
  Pkm.AUDINO, Pkm.AZELF, Pkm.BASCULIN_WHITE, Pkm.BRUXISH, Pkm.CARNIVINE,
  Pkm.CASTFORM, Pkm.CHARCADET, Pkm.CHATOT, Pkm.CHINGLING, Pkm.COMFEY,
  Pkm.COSMOG, Pkm.CRAMORANT, Pkm.CRYOGONAL, Pkm.CYCLIZAR, Pkm.DEDENNE,
  Pkm.DELIBIRD, Pkm.DHELMISE, Pkm.DONDOZO, Pkm.DRACOVISH, Pkm.DRACOZOLT,
  Pkm.DRAMPA, Pkm.DRUDDIGON, Pkm.DUNSPARCE, Pkm.DURALUDON, Pkm.DURANT,
  Pkm.EISCUE_NOICE, Pkm.EMOLGA, Pkm.FALINKS_BRASS, Pkm.FARFETCH_D,
  Pkm.FINIZEN, Pkm.FLUTTER_MANE, Pkm.FURFROU, Pkm.GALARIAN_FARFETCH_D,
  Pkm.GIMMIGHOUL, Pkm.GREAT_TUSK, Pkm.HAWLUCHA, Pkm.HEATMOR, Pkm.HERACROSS,
  Pkm.HISUIAN_QWILFISH, Pkm.HOOPA, Pkm.IRON_BUNDLE, Pkm.IRON_HANDS,
  Pkm.IRON_THORNS, Pkm.KANGASKHAN, Pkm.KLEFKI, Pkm.KOMALA, Pkm.KUBFU,
  Pkm.LAPRAS, Pkm.LUNATONE, Pkm.LUVDISC, Pkm.MANTYKE, Pkm.MARACTUS,
  Pkm.MAWILE, Pkm.MESPRIT, Pkm.MILCERY, Pkm.MILTANK, Pkm.MIMIKYU,
  Pkm.MINIOR, Pkm.MORPEKO, Pkm.ORTHWORM, Pkm.PACHIRISU, Pkm.PINCURCHIN,
  Pkm.PINSIR, Pkm.POIPOLE, Pkm.PYUKUMUKU, Pkm.QWILFISH, Pkm.RELICANTH,
  Pkm.ROTOM, Pkm.SABLEYE, Pkm.SCREAM_TAIL, Pkm.SCYTHER, Pkm.SEVIPER,
  Pkm.SHUCKLE, Pkm.SIGILYPH, Pkm.SKARMORY, Pkm.SLITHER_WING, Pkm.SMEARGLE,
  Pkm.SOLROCK, Pkm.SPINDA, Pkm.SPIRITOMB, Pkm.STANTLER, Pkm.STONJOURNER,
  Pkm.TANDEMAUS, Pkm.TAPU_BULU, Pkm.TAPU_FINI, Pkm.TAPU_KOKO, Pkm.TAPU_LELE,
  Pkm.TAUROS, Pkm.TOGEDEMARU, Pkm.TORKOAL, Pkm.TROPIUS, Pkm.TURTONATOR,
  Pkm.TYROGUE, Pkm.UXIE, Pkm.VELUZA, Pkm.ZANGOOSE, Pkm.ZERAORA
].map(pkm => ({
  name: getPokemonData(pkm).name.replace(/_/g, " "),
  avatar: pkm,
  pokemon: [],
  rewards: [],
  board: [],
  eliteType: "unique" as const
}))

const ELITE_ENCOUNTERS_BY_ACT: { [act: number]: EliteEncounterTemplate[] } = {
  1: ACT1_ELITE_ENCOUNTERS,
  2: [...ACT2_ELITE_ENCOUNTERS, ...UNIQUE_ELITE_ENCOUNTERS],
  3: [...ACT3_ELITE_ENCOUNTERS, ...LEGENDARY_ELITE_ENCOUNTERS]
}

const LEGENDARY_BOSSES: { [act: number]: SpireEncounter[] } = {
  1: [
    {
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
    {
      name: "Tower Duo",
      avatar: Pkm.LUGIA,
      board: [[Pkm.LUGIA, 3, 3], [Pkm.HO_OH, 5, 3]],
      items: [
        [Item.AQUA_EGG],
        [Item.SHELL_BELL]
      ],
      bonusHP: 100,
      bonusAtk: 5,
      bonusAP: 20
    },
    {
      name: "Lake Guardians",
      avatar: Pkm.AZELF,
      board: [[Pkm.AZELF, 2, 2], [Pkm.MESPRIT, 4, 3], [Pkm.UXIE, 6, 2]],
      items: [
        [Item.CHOICE_SPECS],
        [Item.SOUL_DEW],
        [Item.POWER_LENS]
      ],
      bonusHP: 100,
      bonusAtk: 5,
      bonusAP: 20
    }
  ],
  2: [
    {
      name: "Weather Trio",
      avatar: Pkm.MEGA_RAYQUAZA,
      board: [[Pkm.PRIMAL_GROUDON, 2, 2], [Pkm.PRIMAL_KYOGRE, 6, 2], [Pkm.MEGA_RAYQUAZA, 4, 3]],
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
      board: [[Pkm.ARTICUNO, 2, 3], [Pkm.ZAPDOS, 4, 3], [Pkm.MOLTRES, 6, 3]],
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
      board: [[Pkm.RAIKOU, 2, 2], [Pkm.ENTEI, 4, 1], [Pkm.SUICUNE, 6, 2], [Pkm.ZACIAN_CROWNED, 4, 3]],
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
      board: [[Pkm.PRIMAL_GROUDON, 2, 2], [Pkm.PRIMAL_KYOGRE, 6, 2], [Pkm.MEGA_RAYQUAZA, 4, 3]],
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
      board: [[Pkm.DIALGA, 2, 3], [Pkm.PALKIA, 6, 3], [Pkm.ORIGIN_GIRATINA, 4, 2]],
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

export type DifficultyMode = 0 | 1 | 2 // 0=easy, 1=normal, 2=hard

function getStarBudgetOffset(act: number, floor: number, mode: DifficultyMode): number {
  if (mode === 1 || mode === 2) return 0
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

function getDifficultyConfig(act: number, floor: number, mode: DifficultyMode = 1): DifficultyConfig {
  const progress = (act - 1) * 20 + floor // 1-60

  let config: DifficultyConfig
  // --- Act 1 (no 3-star pokemon) ---
  if (progress <= 1) {
    config = { pokemonCount: 1, maxStarsPerPokemon: 1, starBudget: [1, 1], allowedRarities: ["COMMON"], minItemsPerPokemon: 0, maxItemsPerPokemon: 0, useCraftedItems: false }
  } else if (progress <= 3) {
    config = { pokemonCount: 2, maxStarsPerPokemon: 1, starBudget: [2, 2], allowedRarities: ["COMMON"], minItemsPerPokemon: 0, maxItemsPerPokemon: 0, useCraftedItems: false }
  } else if (progress <= 5) {
    config = { pokemonCount: randomBetween(2, 3), maxStarsPerPokemon: 1, starBudget: [2, 3], allowedRarities: ["COMMON", "UNCOMMON"], minItemsPerPokemon: 0, maxItemsPerPokemon: 0, useCraftedItems: false }
  } else if (progress <= 8) {
    config = { pokemonCount: randomBetween(3, 4), maxStarsPerPokemon: 2, starBudget: [4, 5], allowedRarities: ["COMMON", "UNCOMMON"], minItemsPerPokemon: 0, maxItemsPerPokemon: 1, useCraftedItems: false }
  } else if (progress <= 12) {
    config = { pokemonCount: randomBetween(3, 4), maxStarsPerPokemon: 2, starBudget: [4, 6], allowedRarities: ["COMMON", "UNCOMMON"], minItemsPerPokemon: 0, maxItemsPerPokemon: 1, useCraftedItems: false }
  } else if (progress <= 16) {
    config = { pokemonCount: randomBetween(3, 5), maxStarsPerPokemon: 2, starBudget: [6, 8], allowedRarities: ["UNCOMMON", "RARE"], minItemsPerPokemon: 0, maxItemsPerPokemon: 1, useCraftedItems: false }
  } else if (progress <= 20) {
    config = { pokemonCount: randomBetween(4, 5), maxStarsPerPokemon: 2, starBudget: [7, 9], allowedRarities: ["UNCOMMON", "RARE"], minItemsPerPokemon: 0, maxItemsPerPokemon: 1, useCraftedItems: true }
  // --- Act 2 ---
  } else if (progress <= 25) {
    config = { pokemonCount: randomBetween(5, 7), maxStarsPerPokemon: 3, starBudget: [6, 10], allowedRarities: ["RARE", "EPIC"], minItemsPerPokemon: 1, maxItemsPerPokemon: 2, useCraftedItems: true }
  } else if (progress <= 30) {
    config = { pokemonCount: randomBetween(6, 7), maxStarsPerPokemon: 3, starBudget: [8, 12], allowedRarities: ["RARE", "EPIC"], minItemsPerPokemon: 1, maxItemsPerPokemon: 2, useCraftedItems: true }
  } else if (progress <= 35) {
    config = { pokemonCount: randomBetween(6, 7), maxStarsPerPokemon: 3, starBudget: [10, 14], allowedRarities: ["EPIC", "ULTRA"], minItemsPerPokemon: 1, maxItemsPerPokemon: 3, useCraftedItems: true }
  } else if (progress <= 40) {
    config = { pokemonCount: randomBetween(7, 8), maxStarsPerPokemon: 3, starBudget: [12, 15], allowedRarities: ["EPIC", "ULTRA"], minItemsPerPokemon: 2, maxItemsPerPokemon: 3, useCraftedItems: true }
  // --- Act 3 ---
  } else if (progress <= 45) {
    config = { pokemonCount: randomBetween(7, 8), maxStarsPerPokemon: 3, starBudget: [13, 18], allowedRarities: ["EPIC", "ULTRA"], minItemsPerPokemon: 2, maxItemsPerPokemon: 3, useCraftedItems: true }
  } else if (progress <= 50) {
    config = { pokemonCount: randomBetween(7, 9), maxStarsPerPokemon: 3, starBudget: [15, 21], allowedRarities: ["EPIC", "ULTRA"], minItemsPerPokemon: 2, maxItemsPerPokemon: 3, useCraftedItems: true }
  } else {
    config = { pokemonCount: randomBetween(8, 9), maxStarsPerPokemon: 3, starBudget: [17, 23], allowedRarities: ["EPIC", "ULTRA"], minItemsPerPokemon: 3, maxItemsPerPokemon: 3, useCraftedItems: true }
  }

  const offset = getStarBudgetOffset(act, floor, mode)
  if (offset !== 0) {
    config.starBudget = [
      Math.max(config.pokemonCount, config.starBudget[0] + offset),
      Math.max(config.pokemonCount, config.starBudget[1] + offset)
    ]
  }
  return config
}

function selectWithStarBudget(
  candidatePool: Pkm[],
  primaryPool: Pkm[],
  secondaryPool: Pkm[],
  difficulty: DifficultyConfig
): Pkm[] {
  const clampedMin = Math.max(difficulty.starBudget[0], difficulty.pokemonCount)
  const clampedMax = Math.min(difficulty.starBudget[1], difficulty.pokemonCount * difficulty.maxStarsPerPokemon)
  const targetStars = randomBetween(clampedMin, clampedMax)
  const selected: Pkm[] = []
  let currentStars = 0

  const primary = [...primaryPool]
  const secondary = [...secondaryPool]
  const fallback = [...candidatePool]

  for (let i = 0; i < difficulty.pokemonCount; i++) {
    const pool = primary.length > 0 ? primary : secondary.length > 0 ? secondary : fallback
    if (pool.length === 0) break

    const slotsLeft = difficulty.pokemonCount - i
    const starsNeeded = targetStars - currentStars
    const maxAffordable = Math.min(difficulty.maxStarsPerPokemon, starsNeeded - (slotsLeft - 1))
    const minNeeded = Math.max(1, starsNeeded - (slotsLeft - 1) * difficulty.maxStarsPerPokemon)

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
        const maxAvail = Math.max(...allPools.map(p => getPokemonData(p).stars))
        eligible = allPools.filter(p => getPokemonData(p).stars === maxAvail)
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

export function getRegionalWildEncounter(act: number, floor: number, region: string, mode: DifficultyMode = 1): SpireEncounter {
  const synergies = RegionDetails[region as DungeonPMDO]?.synergies ?? []
  if (synergies.length === 0) {
    return getWildEncounter(act, floor, 0)
  }

  const difficulty = getDifficultyConfig(act, floor, mode)

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
            if (!secondaryPool.includes(pkm) && !primaryPool.includes(pkm)) secondaryPool.push(pkm)
          }
        }
      }
    }
  }

  const candidatePool = [...primaryPool, ...secondaryPool]

  if (candidatePool.length === 0) {
    for (const syn of synergies) {
      const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn]
      if (typed) {
        for (const pkm of typed) {
          const data = getPokemonData(pkm)
          if (data.stars <= difficulty.maxStarsPerPokemon && !candidatePool.includes(pkm)) {
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
    ? selectWithStarBudget(candidatePool, primaryPool, secondaryPool, difficulty)
    : selectWithStarBudget(candidatePool, candidatePool, [], difficulty)

  const board: [Pkm, number, number][] = []
  if (act === 1) {
    const allPositions = [
      [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
      [2, 2], [3, 2], [4, 2], [5, 2], [6, 2]
    ]
    const shuffled = pickNRandomIn(allPositions, Math.min(selected.length, allPositions.length))
    selected.forEach((pkm, i) => {
      board.push([pkm, shuffled[i][0], shuffled[i][1]])
    })
  } else {
    const frontRow: [number, number][] = [[2, 3], [3, 3], [4, 3], [5, 3], [6, 3]]
    const midRow: [number, number][] = [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2]]
    const backRow: [number, number][] = [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1]]
    let fi = 0, mi = 0, bi = 0
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
  }

  const items = generateEncounterItems(selected.length, difficulty.minItemsPerPokemon, difficulty.maxItemsPerPokemon, difficulty.useCraftedItems)

  const regionName = (region as string).replace(/([A-Z])/g, " $1").trim()

  return addHardModeItems({
    name: regionName,
    avatar: selected[0],
    board,
    items
  }, act, floor, mode)
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

export function generateGymEncounter(synergy: Synergy, act: number, floor: number, mode: DifficultyMode = 1): SpireEncounter {
  const difficulty = getDifficultyConfig(act, floor, mode)
  difficulty.starBudget = [difficulty.starBudget[0], difficulty.starBudget[1] + 1]
  const signaturePokemon = GYM_LEADER_POKEMON[synergy] ?? []
  const names = GYM_LEADER_NAMES[synergy] ?? ["Gym Leader"]
  const name = pickRandomIn(names)

  const candidatePool: Pkm[] = []
  for (const pkm of signaturePokemon) {
    const data = getPokemonData(pkm)
    if (data.stars <= difficulty.maxStarsPerPokemon && difficulty.allowedRarities.includes(data.rarity)) {
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
    const uniqueTyped = typed.filter(pkm => {
      const data = getPokemonData(pkm)
      return data.stars <= difficulty.maxStarsPerPokemon && (data.rarity === "ULTRA" || data.rarity === "EPIC") && !candidatePool.includes(pkm)
    })
    candidatePool.push(...uniqueTyped)
  }

  // In act 3, add at least 1 legendary from this synergy
  let legendaryPick: Pkm | null = null
  if (act >= 3) {
    const legendaries = typed.filter(pkm => {
      const data = getPokemonData(pkm)
      return data.rarity === "LEGENDARY" || data.rarity === "UNIQUE"
    })
    if (legendaries.length > 0) {
      legendaryPick = pickRandomIn(legendaries)
    }
  }

  if (candidatePool.length === 0) {
    for (const pkm of typed) {
      const data = getPokemonData(pkm)
      if (data.stars <= difficulty.maxStarsPerPokemon && !candidatePool.includes(pkm)) {
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
      Math.max(gymDifficulty.pokemonCount, gymDifficulty.starBudget[0] - getPokemonData(legendaryPick).stars),
      Math.max(gymDifficulty.pokemonCount, gymDifficulty.starBudget[1] - getPokemonData(legendaryPick).stars)
    ]
  }

  // Use signature Pokemon as primary pool for star budget selection
  const sigCandidates = candidatePool.filter(p => signaturePokemon.includes(p))
  const otherCandidates = candidatePool.filter(p => !signaturePokemon.includes(p))
  selected.push(...selectWithStarBudget(candidatePool, sigCandidates, otherCandidates, gymDifficulty))

  if (selected.length === 0 && signaturePokemon.length > 0) {
    selected.push(...pickNRandomIn(signaturePokemon, Math.min(3, signaturePokemon.length)))
  }

  // Position Pokemon by range (melee front = high y, ranged back = low y)
  const board: [Pkm, number, number][] = []
  const frontRow: [number, number][] = [[2, 3], [3, 3], [4, 3], [5, 3], [6, 3]]
  const midRow: [number, number][] = [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2]]
  const backRow: [number, number][] = [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1]]
  let fi = 0, mi = 0, bi = 0
  selected.forEach((pkm) => {
    const range = getPokemonData(pkm).range
    if (range <= 1 && fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]]); fi++
    } else if (range === 2 && mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]]); mi++
    } else if (range >= 3 && bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]]); bi++
    } else if (fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]]); fi++
    } else if (mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]]); mi++
    } else if (bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]]); bi++
    }
  })

  const items = generateEncounterItems(selected.length, difficulty.minItemsPerPokemon, difficulty.maxItemsPerPokemon, difficulty.useCraftedItems)

  return addHardModeItems({
    name,
    avatar: selected[0],
    board,
    items,
    synergy
  }, act, floor, mode)
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

export function getGymLeaderBaseFormPokemon(synergy: Synergy): Pkm[] {
  const roster = GYM_LEADER_POKEMON[synergy] ?? []
  return roster.filter(pkm => {
    const data = getPokemonData(pkm)
    return data.stars === 1
  })
}

export function getGymLeaderGem(synergy: Synergy): Item {
  const gemName = `${synergy}_GEM`
  if (gemName in Item) {
    return Item[gemName as keyof typeof Item]
  }
  return Item.NORMAL_GEM
}

function addHardModeItems(encounter: SpireEncounter, act: number, floor: number, mode: DifficultyMode): SpireEncounter {
  if (mode !== 2) return encounter
  const progress = (act - 1) * 20 + floor
  if (progress <= 8) return encounter

  let extraComponents: number
  if (act === 1) extraComponents = Math.round(encounter.board.length * 0.5)
  else if (act === 2) extraComponents = Math.round(encounter.board.length * 1.25)
  else extraComponents = Math.round(encounter.board.length * 1.75)

  const adjusted = { ...encounter, items: encounter.items ? encounter.items.map(list => [...list]) : encounter.board.map(() => [] as Item[]) }
  for (let i = 0; i < extraComponents; i++) {
    const slot = i % adjusted.items!.length
    adjusted.items![slot].push(pickRandomIn(ItemComponentsNoFossilOrScarf))
  }
  return adjusted
}

function adjustEncounterItems(encounter: SpireEncounter, mode: DifficultyMode): SpireEncounter {
  if (mode === 1 || !encounter.items) return encounter
  const adjusted = { ...encounter, items: encounter.items.map(list => [...list]) }
  if (mode === 0) {
    for (const list of adjusted.items!) {
      if (list.length > 0) { list.pop(); break }
    }
  } else {
    for (const list of adjusted.items!) {
      if (list.length > 0) { list.push(pickRandomIn(CraftableItems)); break }
    }
  }
  return adjusted
}

function generateLegendaryEliteEncounter(legendary: Pkm, act: number, floor: number): SpireEncounter {
  const difficulty = getDifficultyConfig(act, floor)
  difficulty.starBudget = [difficulty.starBudget[0] + 2, difficulty.starBudget[1] + 3]
  const legendaryData = getPokemonData(legendary)
  const synergies = (legendaryData.types ?? []) as Synergy[]

  const candidatePool: Pkm[] = []
  for (const syn of synergies) {
    const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn] ?? []
    for (const pkm of typed) {
      if (pkm === legendary) continue
      const data = getPokemonData(pkm)
      if (
        data.stars <= difficulty.maxStarsPerPokemon &&
        data.rarity !== "LEGENDARY" && data.rarity !== "UNIQUE" &&
        data.rarity !== "HATCH" && data.rarity !== "SPECIAL" &&
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
  selected.push(...selectWithStarBudget(candidatePool, candidatePool, [], remainingDifficulty))

  const frontRow: [number, number][] = [[2, 3], [3, 3], [4, 3], [5, 3], [6, 3]]
  const midRow: [number, number][] = [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2]]
  const backRow: [number, number][] = [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1]]
  let fi = 0, mi = 0, bi = 0
  const board: [Pkm, number, number][] = []
  selected.forEach((pkm) => {
    const range = getPokemonData(pkm).range
    if (range <= 1 && fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]]); fi++
    } else if (range === 2 && mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]]); mi++
    } else if (range >= 3 && bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]]); bi++
    } else if (fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]]); fi++
    } else if (mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]]); mi++
    } else if (bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]]); bi++
    }
  })

  const items = generateEncounterItems(selected.length, difficulty.minItemsPerPokemon, difficulty.maxItemsPerPokemon, difficulty.useCraftedItems)
  const name = legendaryData.name.replace(/_/g, " ")

  return { name, avatar: legendary, board, items }
}

export function getEliteEncounter(index: number, act: number, floor: number, mode: DifficultyMode = 1): SpireEncounter {
  return addHardModeItems(adjustEncounterItems(getEliteEncounterBase(index, act, floor), mode), act, floor, mode)
}

function getEliteEncounterBase(index: number, act: number, floor: number): SpireEncounter {
  const encounters = ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS
  const template = encounters[index % encounters.length]

  if (template.eliteType) {
    return generateLegendaryEliteEncounter(template.avatar, act, floor)
  }

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

  if (template.name === "Bat Cave") {
    const board: [Pkm, number, number][] = [
      [Pkm.GOLBAT, 4, 2], [Pkm.NOIBAT, 2, 1], [Pkm.SWOOBAT, 6, 1]
    ]
    if (floor >= 10) {
      board.push([Pkm.ZUBAT, 3, 1])
    }
    if (floor >= 14) {
      board.push([Pkm.WOOBAT, 5, 1])
    }
    return { name: template.name, avatar: template.avatar, board }
  }

  if (template.name === "Rock Tunnel") {
    const board: [Pkm, number, number][] = [
      [Pkm.LAIRON, 4, 2], [Pkm.GRAVELER, 2, 1], [Pkm.ONIX, 6, 1]
    ]
    if (floor >= 10) {
      board.push([Pkm.ARON, 3, 1])
    }
    if (floor >= 14) {
      board.push([Pkm.GEODUDE, 5, 1])
    }
    return { name: template.name, avatar: template.avatar, board }
  }

  if (template.name === "Bug Swarm") {
    const board: [Pkm, number, number][] = floor >= 12
      ? [[Pkm.METAPOD, 3, 2], [Pkm.KAKUNA, 5, 2], [Pkm.SCATTERBUG, 2, 1], [Pkm.GRUBBIN, 6, 1]]
      : [[Pkm.CATERPIE, 3, 2], [Pkm.WEEDLE, 5, 2], [Pkm.SCATTERBUG, 2, 1], [Pkm.GRUBBIN, 6, 1]]
    return { name: template.name, avatar: template.avatar, board }
  }

  if (template.name === "Poltergeist") {
    const rotoms = pickNRandomIn(template.pokemon, 4)
    const positions: [number, number][] = [[3, 2], [5, 2], [2, 1], [6, 1]]
    const board: [Pkm, number, number][] = rotoms.map((pkm, i) =>
      [pkm, positions[i][0], positions[i][1]]
    )
    const items = rotoms.map(() => pickNRandomIn([...Tools], 2) as Item[])
    return { name: template.name, avatar: rotoms[0], board, items }
  }

  if (template.name === "Sleeping Giant") {
    const berry1 = pickRandomIn(NonSpecialBerries)
    const berry2 = pickRandomIn(NonSpecialBerries)
    return {
      name: template.name,
      avatar: template.avatar,
      board: [[Pkm.SNORLAX, 3, 2], [Pkm.SLAKING, 5, 2]],
      items: [
        [Item.BIG_EATER_BELT, Item.KINGS_ROCK, berry1],
        [Item.BIG_EATER_BELT, Item.KINGS_ROCK, berry2]
      ]
    }
  }

  if (template.name === "Masquerade") {
    const critSet: Item[] = [Item.REAPER_CLOTH, Item.RAZOR_CLAW, Item.RAZOR_FANG]
    return {
      name: template.name,
      avatar: template.avatar,
      board: [...template.board],
      items: [
        critSet,                                          // Mimikyu
        critSet,                                          // Zoroark
        critSet,                                          // Meowscarada
        critSet,                                          // Meowscarada
        [Item.KINGS_ROCK, Item.ROCKY_HELMET],             // Ditto 1
        [Item.KINGS_ROCK, Item.ASSAULT_VEST],             // Ditto 2
        [Item.KINGS_ROCK, Item.ROCKY_HELMET],             // Ditto 3
        [Item.KINGS_ROCK, Item.ASSAULT_VEST],             // Ditto 4
        [Item.KINGS_ROCK, Item.ROCKY_HELMET],             // Ditto 5
        [Item.KINGS_ROCK, Item.ASSAULT_VEST],             // Ditto 6
        [Item.KINGS_ROCK, Item.ROCKY_HELMET],             // Ditto 7
        [Item.KINGS_ROCK, Item.ASSAULT_VEST],             // Ditto 8
      ]
    }
  }

  if (template.name === "Dragon's Den") {
    const count = floor <= 8 ? 5 : floor <= 14 ? 6 : 8
    const dragons = pickNRandomIn(template.pokemon, Math.min(count, template.pokemon.length))
    const positions: [number, number][] = [
      [4, 3], [2, 2], [6, 2], [3, 1], [5, 1], [2, 1], [6, 1], [4, 2]
    ]
    const board: [Pkm, number, number][] = dragons.map((pkm, i) =>
      [pkm, positions[i][0], positions[i][1]]
    )
    const items = dragons.map(() => pickNRandomIn(CraftableItems, 1) as Item[])
    return { name: template.name, avatar: dragons[0], board, items }
  }

  if (template.name === "Tyrant's Court") {
    const items = template.pokemon.map(() => [Item.STICKY_BARB] as Item[])
    return {
      name: template.name,
      avatar: template.avatar,
      board: [...template.board],
      items
    }
  }

  if (template.name === "Celestial Court") {
    const count = floor <= 8 ? 5 : floor <= 14 ? 6 : 7
    const fairies = pickNRandomIn(template.pokemon, Math.min(count, template.pokemon.length))
    const positions: [number, number][] = [
      [4, 3], [2, 2], [6, 2], [3, 2], [5, 2], [2, 1], [6, 1]
    ]
    const board: [Pkm, number, number][] = fairies.map((pkm, i) =>
      [pkm, positions[i][0], positions[i][1]]
    )
    const items = fairies.map(() => pickNRandomIn(CraftableItems, randomBetween(1, 2)) as Item[])
    return { name: template.name, avatar: fairies[0], board, items }
  }

  if (template.name === "Mother's Fury") {
    const items = template.pokemon.map(() => pickNRandomIn(CraftableItems, 2) as Item[])
    return {
      name: template.name,
      avatar: template.avatar,
      board: [...template.board],
      items
    }
  }

  if (template.name === "Luchador Ring") {
    const items = template.pokemon.map(() => pickNRandomIn(CraftableItems, 1) as Item[])
    return {
      name: template.name,
      avatar: template.avatar,
      board: [...template.board],
      items
    }
  }

  if (template.name === "Cursed Grotto") {
    return {
      name: template.name,
      avatar: template.avatar,
      board: [...template.board],
      items: [[], [], [], [], [Item.WIDE_LENS], [Item.WIDE_LENS]]
    }
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
  if (template.eliteType) return [template.avatar]
  return template.rewards
}

export function getEliteEncounterType(index: number, act: number): "legendary" | "unique" | undefined {
  const encounters = ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS
  const template = encounters[index % encounters.length]
  return template.eliteType
}

export function getEliteEncounterName(index: number, act: number): string {
  const encounters = ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS
  return encounters[index % encounters.length]?.name ?? "Elite"
}

export function getEliteEncounterAvatar(index: number, act: number): Pkm {
  const encounters = ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS
  return encounters[index % encounters.length]?.avatar ?? Pkm.DEFAULT
}

export function getGymLeaderDisplayName(synergy: string): string {
  const names = GYM_LEADER_NAMES[synergy as Synergy]
  if (names && names.length > 0) return pickRandomIn(names)
  return synergy.replace(/_/g, " ")
}

function applyHardBossBoost(encounter: SpireEncounter, act: number, mode: DifficultyMode): SpireEncounter {
  if (mode !== 2 || act < 3) return encounter
  const extraLegendaries: Pkm[] = [Pkm.CELEBI, Pkm.JIRACHI, Pkm.VICTINI, Pkm.MANAPHY, Pkm.SHAYMIN, Pkm.PHIONE]
  const existing = new Set(encounter.board.map(([pkm]) => pkm))
  const candidates = extraLegendaries.filter(p => !existing.has(p))
  if (candidates.length === 0) return encounter
  const extra = pickRandomIn(candidates)
  const freeX = [0, 1, 2, 3, 4, 5, 6, 7].find(x => !encounter.board.some(([, bx, by]) => bx === x && by === 1)) ?? 1
  const adjusted = {
    ...encounter,
    board: [...encounter.board, [extra, freeX, 1] as [Pkm, number, number]],
    items: [...(encounter.items || encounter.board.map(() => [])), [Item.SOUL_DEW]],
    bonusHP: (encounter.bonusHP ?? 0) + 200,
    bonusAtk: (encounter.bonusAtk ?? 0) + 5
  }
  return adjusted
}

export function getLegendaryBossEncounter(act: number, mode: DifficultyMode = 1): SpireEncounter {
  const bosses = LEGENDARY_BOSSES[act] || LEGENDARY_BOSSES[1]
  return adjustEncounterItems(applyHardBossBoost(pickRandomIn(bosses), act, mode), mode)
}

export function pickLegendaryBoss(act: number): { name: string; sprites: Pkm[] } {
  const bosses = LEGENDARY_BOSSES[act] || LEGENDARY_BOSSES[1]
  const boss = pickRandomIn(bosses)
  const sprites = boss.board.map(([pkm]) => pkm)
  return { name: boss.name, sprites }
}

export function getLegendaryBossEncounterByName(act: number, name: string, mode: DifficultyMode = 1): SpireEncounter {
  const bosses = LEGENDARY_BOSSES[act] || LEGENDARY_BOSSES[1]
  const boss = bosses.find(b => b.name === name) ?? pickRandomIn(bosses)
  return adjustEncounterItems(applyHardBossBoost(boss, act, mode), mode)
}

export function getRegionalCandidates(region: string, act: number): Pkm[] {
  const synergies = RegionDetails[region as DungeonPMDO]?.synergies ?? []
  if (synergies.length === 0) return []

  const maxStars = act === 1 ? 1 : act === 2 ? 1 : 2
  const raw: Pkm[] = []
  for (const pkm of PRECOMPUTED_REGIONAL_MONS) {
    const data = getPokemonData(pkm)
    if (data.stars > maxStars) continue
    if (data.rarity === "HATCH" || data.rarity === "SPECIAL" || data.rarity === "UNIQUE" || data.rarity === "LEGENDARY") continue
    if (raw.includes(pkm)) continue
    const hasMatchingSynergy = data.types.some((t: string) => synergies.includes(t as any))
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

export function getRegionalPokemonCandidates(region: string, act: number): { candidates: Pkm[], synergies: string[] } {
  const synergies = RegionDetails[region as DungeonPMDO]?.synergies ?? []
  return { candidates: getRegionalCandidates(region, act), synergies: synergies as string[] }
}

export function getRegionalPokemonForReward(region: string, act: number): Pkm | null {
  const candidates = getRegionalCandidates(region, act)
  return candidates.length > 0 ? pickRandomIn(candidates) : null
}

export function generateWildRewardPokemon(region: string, act: number): Pkm[] {
  const synergies = RegionDetails[region as DungeonPMDO]?.synergies ?? []
  const maxStars = act === 1 ? 1 : act === 2 ? 1 : 2
  const picks: Pkm[] = []

  // Pick one Pokemon per synergy, in region synergy order
  for (const syn of synergies) {
    const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn] ?? []
    const valid = typed.filter((pkm) => {
      const data = getPokemonData(pkm)
      return data.stars <= maxStars &&
        data.rarity !== "HATCH" && data.rarity !== "SPECIAL" &&
        data.rarity !== "UNIQUE" && data.rarity !== "LEGENDARY" &&
        !picks.includes(pkm)
    })
    if (valid.length > 0) {
      picks.push(pickRandomIn(valid))
    }
  }

  // 50% chance to replace a pick with a regional Pokemon, preferring a matching synergy slot
  if (Math.random() < 0.5 && picks.length > 0) {
    const regionals = getRegionalCandidates(region, act)
    if (regionals.length > 0) {
      const replacement = pickRandomIn(regionals)
      const replacementTypes = getPokemonData(replacement).types as string[]
      const matchingIdx = synergies.findIndex((syn, i) =>
        i < picks.length && replacementTypes.includes(syn as string)
      )
      const idx = matchingIdx >= 0 ? matchingIdx : randomBetween(0, picks.length - 1)
      picks[idx] = replacement
    }
  }

  return picks
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
    case "WILD_BATTLE": return 2 + act
    case "ELITE": return 3 + act * 2
    case "GYM_LEADER": return 5 + act * 3
    case "LEGENDARY_BOSS": return 11 + act * 4
    case "ELITE_FOUR": return 8 + act * 3
    case "CHAMPION": return 15 + act * 5
    default: return 0
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

const ELITE_FOUR_SYNERGIES: Synergy[] = Object.keys(ELITE_FOUR_NAMES) as Synergy[]

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
  difficulty.starBudget = [difficulty.starBudget[0] + 6, difficulty.starBudget[1] + 10]
  difficulty.maxStarsPerPokemon = 3
  difficulty.allowedRarities = ["COMMON", "UNCOMMON", "RARE", "EPIC", "ULTRA", "LEGENDARY", "UNIQUE"]

  const signaturePokemon = GYM_LEADER_POKEMON[synergy] ?? []
  const names = ELITE_FOUR_NAMES[synergy] ?? ["Elite Four"]
  const name = pickRandomIn(names)

  const candidatePool: Pkm[] = []
  for (const pkm of signaturePokemon) {
    const data = getPokemonData(pkm)
    if (data.stars <= difficulty.maxStarsPerPokemon && difficulty.allowedRarities.includes(data.rarity)) {
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

  const uniqueTyped = typed.filter(pkm => {
    const data = getPokemonData(pkm)
    return data.stars <= difficulty.maxStarsPerPokemon &&
      (data.rarity === "ULTRA" || data.rarity === "EPIC" || data.rarity === "LEGENDARY" || data.rarity === "UNIQUE") &&
      !candidatePool.includes(pkm)
  })
  candidatePool.push(...uniqueTyped)

  const legendaries = typed.filter(pkm => {
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
      if (data.stars <= difficulty.maxStarsPerPokemon && !candidatePool.includes(pkm)) {
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
      Math.max(gymDifficulty.pokemonCount, gymDifficulty.starBudget[0] - getPokemonData(legendaryPick).stars),
      Math.max(gymDifficulty.pokemonCount, gymDifficulty.starBudget[1] - getPokemonData(legendaryPick).stars)
    ]
  }

  const sigCandidates = candidatePool.filter(p => signaturePokemon.includes(p))
  const otherCandidates = candidatePool.filter(p => !signaturePokemon.includes(p))
  selected.push(...selectWithStarBudget(candidatePool, sigCandidates, otherCandidates, gymDifficulty))

  if (selected.length === 0 && signaturePokemon.length > 0) {
    selected.push(...pickNRandomIn(signaturePokemon, Math.min(5, signaturePokemon.length)))
  }

  const board: [Pkm, number, number][] = []
  const frontRow: [number, number][] = [[2, 3], [3, 3], [4, 3], [5, 3], [6, 3]]
  const midRow: [number, number][] = [[2, 2], [3, 2], [4, 2], [5, 2], [6, 2]]
  const backRow: [number, number][] = [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1]]
  let fi = 0, mi = 0, bi = 0
  selected.forEach((pkm) => {
    const range = getPokemonData(pkm).range
    if (range <= 1 && fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]]); fi++
    } else if (range === 2 && mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]]); mi++
    } else if (range >= 3 && bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]]); bi++
    } else if (fi < frontRow.length) {
      board.push([pkm, frontRow[fi][0], frontRow[fi][1]]); fi++
    } else if (mi < midRow.length) {
      board.push([pkm, midRow[mi][0], midRow[mi][1]]); mi++
    } else if (bi < backRow.length) {
      board.push([pkm, backRow[bi][0], backRow[bi][1]]); bi++
    }
  })

  const items = generateEncounterItems(selected.length, 1, 2, true)

  const bonusHP = 200 + e4Index * 100
  const bonusAtk = 10 + e4Index * 5
  const bonusAP = 30 + e4Index * 20

  return addHardModeItems({
    name,
    avatar: selected[0],
    board,
    items,
    synergy,
    bonusHP,
    bonusAtk,
    bonusAP
  }, 4, floor, mode)
}

// ─── Champions ────────────────────────────────────────────────

const CHAMPION_ENCOUNTERS: SpireEncounter[] = [
  {
    name: "Blue",
    avatar: Pkm.PIDGEOT,
    board: [
      [Pkm.PIDGEOT, 4, 1], [Pkm.ALAKAZAM, 3, 1], [Pkm.EXEGGUTOR, 5, 1],
      [Pkm.MACHAMP, 2, 2], [Pkm.GYARADOS, 4, 2], [Pkm.GENGAR, 6, 2],
      [Pkm.RHYDON, 2, 3], [Pkm.ARCANINE, 4, 3], [Pkm.MEWTWO, 5, 3], [Pkm.SNORLAX, 6, 3]
    ],
    items: [
      [Item.RAZOR_FANG, Item.RAZOR_CLAW], [Item.CHOICE_SPECS, Item.POWER_LENS], [Item.MIRACLE_SEED, Item.SHELL_BELL],
      [Item.BLACK_BELT, Item.ASSAULT_VEST], [Item.MYSTIC_WATER, Item.SCOPE_LENS], [Item.SPELL_TAG, Item.CHOICE_SPECS],
      [Item.ROCKY_HELMET, Item.ASSAULT_VEST], [Item.CHARCOAL, Item.RAZOR_FANG], [Item.CHOICE_SPECS, Item.SCOPE_LENS, Item.POWER_LENS], [Item.LEFTOVERS, Item.ASSAULT_VEST]
    ],
    bonusHP: 800,
    bonusAtk: 30,
    bonusAP: 80
  },
  {
    name: "Lance",
    avatar: Pkm.DRAGONITE,
    board: [
      [Pkm.DRAGONITE, 3, 1], [Pkm.CHARIZARD, 5, 1], [Pkm.AERODACTYL, 2, 1],
      [Pkm.GYARADOS, 2, 2], [Pkm.SALAMENCE, 4, 2], [Pkm.KINGDRA, 6, 2],
      [Pkm.DRAGONITE, 3, 3], [Pkm.DRAGONITE, 4, 3], [Pkm.GARCHOMP, 5, 3], [Pkm.RAYQUAZA, 6, 3]
    ],
    items: [
      [Item.DRAGON_SCALE, Item.SCOPE_LENS], [Item.CHARCOAL, Item.SHELL_BELL], [Item.RAZOR_FANG, Item.RAZOR_CLAW],
      [Item.MYSTIC_WATER, Item.WIDE_LENS], [Item.DRAGON_SCALE, Item.ASSAULT_VEST], [Item.DRAGON_SCALE, Item.CHOICE_SPECS],
      [Item.DRAGON_SCALE, Item.RAZOR_CLAW], [Item.DRAGON_SCALE, Item.ASSAULT_VEST, Item.SCOPE_LENS], [Item.DRAGON_SCALE, Item.RAZOR_FANG], [Item.DRAGON_SCALE, Item.CHOICE_SPECS, Item.POWER_LENS]
    ],
    bonusHP: 800,
    bonusAtk: 30,
    bonusAP: 80
  },
  {
    name: "Steven",
    avatar: Pkm.METAGROSS,
    board: [
      [Pkm.CLAYDOL, 3, 1], [Pkm.CRADILY, 5, 1], [Pkm.SKARMORY, 2, 1],
      [Pkm.ARMALDO, 2, 2], [Pkm.METAGROSS, 4, 2], [Pkm.REGISTEEL, 6, 2],
      [Pkm.AGGRON, 3, 3], [Pkm.STEELIX, 4, 3], [Pkm.DIALGA, 5, 3], [Pkm.JIRACHI, 6, 3]
    ],
    items: [
      [Item.CHOICE_SPECS, Item.POWER_LENS], [Item.MIRACLE_SEED, Item.SHELL_BELL], [Item.RAZOR_FANG, Item.RAZOR_CLAW],
      [Item.ROCKY_HELMET, Item.RAZOR_CLAW], [Item.METAL_COAT, Item.ASSAULT_VEST, Item.SCOPE_LENS], [Item.METAL_COAT, Item.ASSAULT_VEST],
      [Item.METAL_COAT, Item.ROCKY_HELMET], [Item.METAL_COAT, Item.ASSAULT_VEST], [Item.METAL_COAT, Item.CHOICE_SPECS, Item.POWER_LENS], [Item.METAL_COAT, Item.SHELL_BELL]
    ],
    bonusHP: 800,
    bonusAtk: 30,
    bonusAP: 80
  },
  {
    name: "Cynthia",
    avatar: Pkm.GARCHOMP,
    board: [
      [Pkm.ROSERADE, 3, 1], [Pkm.TOGEKISS, 5, 1], [Pkm.MILOTIC, 2, 1],
      [Pkm.SPIRITOMB, 2, 2], [Pkm.LUCARIO, 4, 2], [Pkm.GLACEON, 6, 2],
      [Pkm.GARCHOMP, 3, 3], [Pkm.SALAMENCE, 4, 3], [Pkm.GIRATINA, 5, 3], [Pkm.DIALGA, 6, 3]
    ],
    items: [
      [Item.MIRACLE_SEED, Item.CHOICE_SPECS], [Item.RAZOR_FANG, Item.WIDE_LENS], [Item.MYSTIC_WATER, Item.POWER_LENS],
      [Item.SPELL_TAG, Item.SHELL_BELL], [Item.BLACK_BELT, Item.ASSAULT_VEST, Item.SCOPE_LENS], [Item.ICY_ROCK, Item.CHOICE_SPECS],
      [Item.DRAGON_SCALE, Item.SCOPE_LENS, Item.RAZOR_CLAW], [Item.DRAGON_SCALE, Item.ASSAULT_VEST], [Item.SPELL_TAG, Item.CHOICE_SPECS, Item.POWER_LENS], [Item.METAL_COAT, Item.ASSAULT_VEST]
    ],
    bonusHP: 800,
    bonusAtk: 30,
    bonusAP: 80
  },
  {
    name: "Iris",
    avatar: Pkm.HYDREIGON,
    board: [
      [Pkm.LAPRAS, 3, 1], [Pkm.SALAMENCE, 5, 1], [Pkm.ARCHEOPS, 2, 1],
      [Pkm.HYDREIGON, 2, 2], [Pkm.DRAGONITE, 4, 2], [Pkm.HAXORUS, 6, 2],
      [Pkm.DRUDDIGON, 3, 3], [Pkm.AGGRON, 4, 3], [Pkm.GARCHOMP, 5, 3], [Pkm.RESHIRAM, 6, 3]
    ],
    items: [
      [Item.MYSTIC_WATER, Item.SHELL_BELL], [Item.DRAGON_SCALE, Item.RAZOR_FANG], [Item.RAZOR_FANG, Item.RAZOR_CLAW],
      [Item.DRAGON_SCALE, Item.CHOICE_SPECS, Item.SCOPE_LENS], [Item.DRAGON_SCALE, Item.ASSAULT_VEST], [Item.DRAGON_SCALE, Item.RAZOR_CLAW, Item.SCOPE_LENS],
      [Item.DRAGON_SCALE, Item.ASSAULT_VEST], [Item.METAL_COAT, Item.ROCKY_HELMET], [Item.DRAGON_SCALE, Item.RAZOR_FANG], [Item.CHARCOAL, Item.CHOICE_SPECS, Item.POWER_LENS]
    ],
    bonusHP: 800,
    bonusAtk: 30,
    bonusAP: 80
  },
  {
    name: "Diantha",
    avatar: Pkm.GARDEVOIR,
    board: [
      [Pkm.GARDEVOIR, 3, 1], [Pkm.AURORUS, 5, 1], [Pkm.GOURGEIST, 2, 1],
      [Pkm.HAWLUCHA, 2, 2], [Pkm.GOODRA, 4, 2], [Pkm.TYRANTRUM, 6, 2],
      [Pkm.SYLVEON, 3, 3], [Pkm.DIANCIE, 4, 3], [Pkm.XERNEAS, 5, 3], [Pkm.ZYGARDE_50, 6, 3]
    ],
    items: [
      [Item.CHOICE_SPECS, Item.POWER_LENS, Item.SHELL_BELL], [Item.ICY_ROCK, Item.WIDE_LENS], [Item.SPELL_TAG, Item.SCOPE_LENS],
      [Item.BLACK_BELT, Item.RAZOR_CLAW], [Item.DRAGON_SCALE, Item.ROCKY_HELMET], [Item.ROCKY_HELMET, Item.ASSAULT_VEST],
      [Item.RAZOR_FANG, Item.CHOICE_SPECS], [Item.CHOICE_SPECS, Item.POWER_LENS, Item.SCOPE_LENS], [Item.RAZOR_FANG, Item.WIDE_LENS, Item.SHELL_BELL], [Item.DRAGON_SCALE, Item.ASSAULT_VEST]
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

export function getArceusEncounter(): SpireEncounter {
  return {
    name: "Arceus",
    avatar: Pkm.ARCEUS,
    board: [
      [Pkm.ARCEUS, 4, 2]
    ],
    items: [
      [Item.CHOICE_SPECS, Item.SCOPE_LENS, Item.SHELL_BELL, Item.MUSCLE_BAND, Item.UPGRADE, Item.SOUL_DEW,
       Item.ROCKY_HELMET, Item.SAFETY_GOGGLES, Item.GREEN_ORB, Item.BLUE_ORB, Item.RED_ORB, Item.MAX_REVIVE, Item.STICKY_BARB, Item.POWER_LENS]
    ],
    bonusHP: 5000,
    bonusAtk: 100,
    bonusDef: 40,
    bonusSpeDef: 40,
    bonusAP: 300
  }
}
