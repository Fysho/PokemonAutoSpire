import { DungeonPMDO } from "../types/enum/Dungeon"
import { Pkm } from "../types/enum/Pokemon"
import { Synergy } from "../types/enum/Synergy"
import { MapNodeType } from "./colyseus-models/map-node"
import type { SpireEncounter } from "./spire-encounters"

// ─────────────────────────────────────────────────────────────────────────────
// TUTORIAL MODE — a fully-scripted, single-act guided run on the normal-mode
// ruleset. The map is fixed, every enemy team is deliberately weak so the player
// always wins, and a blocking dialog box teaches one mechanic per stage. Nothing
// here is saved/resumed or counted toward stats. Driven from `state.isTutorial`.
//
// The map is a list of floors; each floor is a list of node defs. Most floors
// have one node (linear), but the item and synergy stages have TWO wild nodes so
// the player also learns to choose a path. Floor numbers below are 1-based.
//
//  1  Wild battle         → map / region synergies, placement, HP & loss
//  2  Wild battle         → evolution (3 copies) + Ditto (given 2 Ditto)
//  3  Wild battle ×2       → ITEM crafting (given 1 of each component)
//  4  PokéMart            → shop, gold, leveling up
//  5  Wild battle ×2       → SYNERGIES (left panel + wiki)
//  6  Mystery event        → mystery encounters (Pokémon Day Care)
//  7  Elite fight          → tougher fights, better rewards
//  8  Pokémon Center       → heal / rest bonuses
//  9  Gym leader (Misty)   → win rewards (synergy gem)
// 10  Act Boss (Mew)       → final test → tutorial complete
// ─────────────────────────────────────────────────────────────────────────────

export type TutorialNodeDef = {
  nodeType: MapNodeType
  /** WILD_BATTLE only: the region whose synergy pool / icons show on the map. */
  region?: DungeonPMDO
  /** GYM_LEADER only: the synergy the gym (and its gem reward) is themed on. */
  gymSynergy?: Synergy
  /** Display name shown on the map node. */
  displayName?: string
}

// One entry per floor; each floor is an array of node defs (1 = linear, 2 = the
// player picks one of two wild battles).
export const TUTORIAL_MAP: TutorialNodeDef[][] = [
  [{ nodeType: MapNodeType.WILD_BATTLE, region: DungeonPMDO.AppleWoods }],
  [{ nodeType: MapNodeType.WILD_BATTLE, region: DungeonPMDO.AmpPlains }],
  [
    { nodeType: MapNodeType.WILD_BATTLE, region: DungeonPMDO.BeachCave },
    { nodeType: MapNodeType.WILD_BATTLE, region: DungeonPMDO.CraggyCoast }
  ],
  [{ nodeType: MapNodeType.POKEMART }],
  [
    { nodeType: MapNodeType.WILD_BATTLE, region: DungeonPMDO.BarrenValley },
    { nodeType: MapNodeType.WILD_BATTLE, region: DungeonPMDO.CrystalCave1 }
  ],
  [{ nodeType: MapNodeType.MYSTERY_ENCOUNTER }],
  [{ nodeType: MapNodeType.ELITE, displayName: "Elite" }],
  [{ nodeType: MapNodeType.POKEMON_CENTER }],
  [{ nodeType: MapNodeType.GYM_LEADER, gymSynergy: Synergy.WATER, displayName: "Misty" }],
  [{ nodeType: MapNodeType.LEGENDARY_BOSS, displayName: "Act Boss" }]
]

// Scripted, intentionally weak enemy teams. Kept to 1-2 low-tier 1★ mons with no
// items so the player reliably wins every fight (loss is taught by text, never
// forced). board entries are [pkm, x, y]; y=1 is the front opponent row. Both
// nodes of a two-node floor share the floor's encounter.
export function getTutorialEncounter(floor: number): SpireEncounter {
  switch (floor) {
    case 1:
      return { name: "Wild Rattata", avatar: Pkm.RATTATA, board: [[Pkm.RATTATA, 4, 1]], items: [[]] }
    case 2:
      return { name: "Wild Pidgey", avatar: Pkm.PIDGEY, board: [[Pkm.PIDGEY, 4, 1]], items: [[]] }
    case 3:
      return { name: "Wild Caterpie", avatar: Pkm.CATERPIE, board: [[Pkm.CATERPIE, 4, 1]], items: [[]] }
    case 5:
      return { name: "Wild Weedle", avatar: Pkm.WEEDLE, board: [[Pkm.WEEDLE, 4, 1]], items: [[]] }
    case 7:
      return {
        name: "Elite",
        avatar: Pkm.ONIX,
        board: [
          [Pkm.GEODUDE, 3, 1],
          [Pkm.MACHOP, 5, 1],
          [Pkm.ONIX, 4, 2],
          [Pkm.ZUBAT, 6, 2]
        ],
        items: [[], [], [], []]
      }
    case 9:
      return {
        name: "Misty",
        avatar: Pkm.STARYU,
        board: [
          [Pkm.PSYDUCK, 3, 1],
          [Pkm.STARYU, 5, 1]
        ],
        items: [[], []]
      }
    case 10:
      return { name: "Act Boss", avatar: Pkm.MEW, board: [[Pkm.MEW, 4, 1]], items: [[]] }
    default:
      return { name: "Wild Magikarp", avatar: Pkm.MAGIKARP, board: [[Pkm.MAGIKARP, 4, 1]], items: [[]] }
  }
}

// ─── Dialog scripts ──────────────────────────────────────────────────────────
// Each trigger maps to an ordered list of i18n keys. The server sends the array
// for a trigger; the client (tutorial-dialog.tsx) shows them one at a time with a
// Next button, looking the text up via react-i18next (so they localize).

export const TutorialDialog = {
  START: "start",
  MAP_INTRO: "map_intro",
  WILD1_PICK: "wild1_pick",
  WILD1_REWARD: "wild1_reward",
  EVOLUTION: "evolution",
  PATH_CHOICE: "path_choice",
  ITEM_CRAFT: "item_craft",
  MART: "mart",
  SYNERGIES: "synergies",
  MYSTERY: "mystery",
  ELITE_PICK: "elite_pick",
  CENTER: "center",
  GYM_PICK: "gym_pick",
  GYM_REWARD: "gym_reward",
  BOSS_PICK: "boss_pick",
  COMPLETE: "complete"
} as const

export type TutorialDialogTrigger =
  (typeof TutorialDialog)[keyof typeof TutorialDialog]

export const TUTORIAL_DIALOG_STEPS: Record<TutorialDialogTrigger, string[]> = {
  start: ["tutorial.welcome", "tutorial.pick_starter"],
  map_intro: ["tutorial.wild_intro", "tutorial.region_synergies"],
  wild1_pick: [
    "tutorial.placement",
    "tutorial.start_fight",
    "tutorial.hp_explain"
  ],
  wild1_reward: ["tutorial.win_reward", "tutorial.region_reward", "tutorial.ditto_chance"],
  evolution: ["tutorial.evo_intro", "tutorial.ditto_explain"],
  // path_choice is fired when the map opens on a branching floor (server-side in
  // initializeMapPhase), so the player reads it before picking a node.
  path_choice: ["tutorial.path_choice"],
  item_craft: ["tutorial.item_intro", "tutorial.item_craft", "tutorial.item_equip"],
  mart: ["tutorial.mart_intro", "tutorial.levelup"],
  synergies: ["tutorial.synergy_intro", "tutorial.synergy_wiki"],
  mystery: ["tutorial.mystery_intro"],
  elite_pick: ["tutorial.elite_intro"],
  center: ["tutorial.center_intro"],
  gym_pick: ["tutorial.gym_intro"],
  gym_reward: ["tutorial.gym_gem"],
  boss_pick: ["tutorial.boss_intro"],
  complete: [
    "tutorial.complete",
    "tutorial.acts",
    "tutorial.endgame",
    "tutorial.elite_four"
  ]
}

export function getTutorialDialogSteps(trigger: TutorialDialogTrigger): string[] {
  return TUTORIAL_DIALOG_STEPS[trigger] ?? []
}
