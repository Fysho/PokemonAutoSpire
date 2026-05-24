import { RegionDetails } from "../config"
import { PRECOMPUTED_REGIONAL_MONS } from "./precomputed/precomputed-pokemon-data"
import { getPokemonData } from "./precomputed/precomputed-pokemon-data"
import { PRECOMPUTED_POKEMONS_PER_TYPE } from "./precomputed/precomputed-types"
import { DungeonPMDO } from "../types/enum/Dungeon"
import { Pkm } from "../types/enum/Pokemon"
import { CraftableItems, Item, ItemComponents, NonSpecialBerries, Tools } from "../types/enum/Item"
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
  [Synergy.BUG]: [Pkm.SCIZOR, Pkm.FORRETRESS, Pkm.SCOLIPEDE, Pkm.CATERPIE, Pkm.METAPOD, Pkm.BUTTERFREE, Pkm.WEEDLE, Pkm.KAKUNA, Pkm.BEEDRILL]
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
  [Synergy.BUG]: ["Bugsy", "Burgh", "Viola"]
}

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
    avatar: Pkm.ABSOL,
    pokemon: [Pkm.ABSOL, Pkm.SPIRITOMB, Pkm.MEGA_SABLEYE],
    rewards: [Pkm.ABSOL, Pkm.SPIRITOMB, Pkm.SABLEYE],
    board: [[Pkm.ABSOL, 3, 2], [Pkm.SPIRITOMB, 5, 2], [Pkm.MEGA_SABLEYE, 4, 3]],
    items: [[], [], [Item.RED_ORB]]
  },
  {
    name: "Masquerade",
    avatar: Pkm.MIMIKYU,
    pokemon: [Pkm.MIMIKYU, Pkm.ZOROARK, Pkm.DITTO],
    rewards: [Pkm.MIMIKYU, Pkm.DITTO, Pkm.ZORUA],
    board: [
      [Pkm.MIMIKYU, 4, 2],
      [Pkm.ZOROARK, 4, 3],
      [Pkm.DITTO, 2, 1], [Pkm.DITTO, 6, 1], [Pkm.DITTO, 3, 1], [Pkm.DITTO, 5, 1], [Pkm.DITTO, 4, 1]
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
    pokemon: [Pkm.KANGASKHAN, Pkm.KANGASKHAN, Pkm.KANGASKHAN, Pkm.KANGASKHAN],
    rewards: [Pkm.KANGASKHAN],
    board: [[Pkm.KANGASKHAN, 3, 3], [Pkm.KANGASKHAN, 5, 3], [Pkm.KANGASKHAN, 2, 1], [Pkm.KANGASKHAN, 6, 1]]
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
        [Item.LEFTOVERS],
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
        [Item.CHOICE_SPECS, Item.WIDE_LENS],
        [Item.SHELL_BELL, Item.SOUL_DEW],
        [Item.LEFTOVERS, Item.WISE_GLASSES]
      ],
      bonusHP: 100,
      bonusAtk: 5,
      bonusAP: 20
    }
  ],
  2: [
    {
      name: "Weather Trio",
      avatar: Pkm.RAYQUAZA,
      board: [[Pkm.GROUDON, 2, 2], [Pkm.KYOGRE, 6, 2], [Pkm.RAYQUAZA, 4, 3]],
      items: [
        [Item.RED_ORB, Item.ROCKY_HELMET, Item.ASSAULT_VEST],
        [Item.BLUE_ORB, Item.SHELL_BELL, Item.WISE_GLASSES],
        [Item.RAZOR_CLAW, Item.SCOPE_LENS, Item.RAZOR_FANG]
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
        [Item.LEFTOVERS, Item.SHELL_BELL],
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
      avatar: Pkm.RAYQUAZA,
      board: [[Pkm.GROUDON, 2, 2], [Pkm.KYOGRE, 6, 2], [Pkm.RAYQUAZA, 4, 3]],
      items: [
        [Item.RED_ORB, Item.ROCKY_HELMET, Item.ASSAULT_VEST],
        [Item.BLUE_ORB, Item.SHELL_BELL, Item.WISE_GLASSES],
        [Item.RAZOR_CLAW, Item.SCOPE_LENS, Item.RAZOR_FANG]
      ],
      bonusHP: 2000,
      bonusAtk: 30,
      bonusAP: 100
    }
  ]
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
          data.stars <= difficulty.maxStars &&
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
  // In acts 2+3, fill most slots from the focus synergy pool
  const selected: Pkm[] = []
  const focusPool = [...primaryPool]
  const offPool = [...secondaryPool]
  const usePool = focusSynergy ? focusPool : [...candidatePool]

  for (let i = 0; i < difficulty.pokemonCount && (usePool.length > 0 || offPool.length > 0 || candidatePool.length > 0); i++) {
    // Last 1-2 slots can come from secondary synergy for variety
    const pickFromOff = focusSynergy && i >= difficulty.pokemonCount - 1 && offPool.length > 0
    const pool = pickFromOff ? offPool : (usePool.length > 0 ? usePool : offPool.length > 0 ? offPool : candidatePool)

    if (pool.length === 0) break

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

export function generateGymEncounter(synergy: Synergy, act: number, floor: number): SpireEncounter {
  const difficulty = getDifficultyConfig(act, floor)
  const signaturePokemon = GYM_LEADER_POKEMON[synergy] ?? []
  const names = GYM_LEADER_NAMES[synergy] ?? ["Gym Leader"]
  const name = pickRandomIn(names)

  const candidatePool: Pkm[] = []
  for (const pkm of signaturePokemon) {
    const data = getPokemonData(pkm)
    if (data.stars <= difficulty.maxStars && difficulty.allowedRarities.includes(data.rarity)) {
      candidatePool.push(pkm)
    }
  }

  // Fill from synergy type if not enough signature Pokemon
  const typed = PRECOMPUTED_POKEMONS_PER_TYPE[synergy] ?? []
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

  // In act 2, bias toward unique/rare Pokemon
  if (act >= 2) {
    const uniqueTyped = typed.filter(pkm => {
      const data = getPokemonData(pkm)
      return data.stars <= difficulty.maxStars && (data.rarity === "ULTRA" || data.rarity === "EPIC") && !candidatePool.includes(pkm)
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
      if (data.stars <= difficulty.maxStars && !candidatePool.includes(pkm)) {
        candidatePool.push(pkm)
      }
    }
  }

  // Select Pokemon
  const targetCount = Math.max(3, difficulty.pokemonCount)
  const selected: Pkm[] = []
  const pool = [...candidatePool]

  // Add legendary first if act 3
  if (legendaryPick) {
    selected.push(legendaryPick)
  }

  // Fill remaining slots, biasing signature Pokemon
  const sigPool = pool.filter(p => signaturePokemon.includes(p))
  const otherPool = pool.filter(p => !signaturePokemon.includes(p))

  while (selected.length < targetCount && (sigPool.length > 0 || otherPool.length > 0)) {
    // 70% chance to pick from signature pool when available
    const useSig = sigPool.length > 0 && (otherPool.length === 0 || Math.random() < 0.7)
    const source = useSig ? sigPool : otherPool
    if (source.length === 0) break
    if (selected.length >= targetCount - 2 && difficulty.maxStars >= 2) {
      const highStar = source.filter(p => getPokemonData(p).stars >= 2)
      if (highStar.length > 0) {
        const pick = pickRandomIn(highStar)
        selected.push(pick)
        source.splice(source.indexOf(pick), 1)
        continue
      }
    }
    const pick = pickRandomIn(source)
    selected.push(pick)
    source.splice(source.indexOf(pick), 1)
  }

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

  return {
    name,
    avatar: selected[0],
    board,
    items,
    synergy
  }
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
    const zoroarkItems = pickNRandomIn(CraftableItems, 3)
    return {
      name: template.name,
      avatar: template.avatar,
      board: [...template.board],
      items: [[], zoroarkItems, [], [], [], [], []]
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

export function getEliteEncounterName(index: number, act: number): string {
  const encounters = ELITE_ENCOUNTERS_BY_ACT[act] ?? ACT1_ELITE_ENCOUNTERS
  return encounters[index % encounters.length]?.name ?? "Elite"
}

export function getGymLeaderDisplayName(synergy: string): string {
  const names = GYM_LEADER_NAMES[synergy as Synergy]
  if (names && names.length > 0) return pickRandomIn(names)
  return synergy.replace(/_/g, " ")
}

export function getLegendaryBossEncounter(act: number): SpireEncounter {
  const bosses = LEGENDARY_BOSSES[act] || LEGENDARY_BOSSES[1]
  return pickRandomIn(bosses)
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
    case "WILD_BATTLE": return 2 + act
    case "ELITE": return 3 + act * 2
    case "GYM_LEADER": return 5 + act * 3
    case "LEGENDARY_BOSS": return 11 + act * 4
    default: return 0
  }
}
