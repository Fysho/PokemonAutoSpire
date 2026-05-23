import { Pkm } from "../types/enum/Pokemon"
import { Item } from "../types/enum/Item"

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

export function getGoldReward(nodeType: string, act: number): number {
  switch (nodeType) {
    case "WILD_BATTLE": return 2 + act
    case "GYM_LEADER": return 6 + act * 2
    case "LEGENDARY_BOSS": return 12 + act * 3
    default: return 0
  }
}
