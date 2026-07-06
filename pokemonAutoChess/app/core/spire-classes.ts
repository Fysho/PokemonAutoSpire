import { Relic } from "./relics"
import { Synergy } from "../types/enum/Synergy"

/**
 * Spire Classes — the 6 selectable "characters" for Spire Mode.
 *
 * Each class groups 5 synergies (roster-overlap driven; see SYNERGY-CLASSES.md)
 * under a Slay-the-Spire-style identity, and ships with a starting relic.
 * Some synergies are shared across two classes ("double-ups"): FIRE, ELECTRIC,
 * PSYCHIC, LIGHT. The remaining 5 synergies (BABY, DRAGON, GOURMET, ARTIFICIAL,
 * AMORPHOUS) are the Colorless/universal pool and belong to no class.
 *
 * NOTE: classes are not yet wired into gameplay (no draft gating / starter pool
 * effect). This is the data + selection UI only.
 */
export enum SpireClass {
  IRONCLAD = "IRONCLAD",
  SILENT = "SILENT",
  DEFECT = "DEFECT",
  WATCHER = "WATCHER",
  DRIFTER = "DRIFTER",
  BEHEMOTH = "BEHEMOTH"
}

export interface SpireClassData {
  id: SpireClass
  name: string
  theme: string
  description: string
  synergies: Synergy[]
  startingRelic: Relic
}

export const SPIRE_CLASSES: Record<SpireClass, SpireClassData> = {
  [SpireClass.IRONCLAD]: {
    id: SpireClass.IRONCLAD,
    name: "The Ironclad",
    theme: "Beasts",
    description:
      "Raw strength and ferocity. Overwhelm the enemy with relentless physical force before they can react.",
    synergies: [
      Synergy.FIELD,
      Synergy.NORMAL,
      Synergy.WILD,
      Synergy.ELECTRIC,
      Synergy.FIRE
    ],
    startingRelic: Relic.BurningBlood
  },
  [SpireClass.SILENT]: {
    id: SpireClass.SILENT,
    name: "The Silent",
    theme: "Garden",
    description:
      "Toxins, swarms, and evasion. Whittle foes down with poison and numbers while slipping out of danger.",
    synergies: [
      Synergy.BUG,
      Synergy.POISON,
      Synergy.GRASS,
      Synergy.FLORA,
      Synergy.FAIRY
    ],
    startingRelic: Relic.RingoftheSnake
  },
  [SpireClass.DEFECT]: {
    id: SpireClass.DEFECT,
    name: "The Defect",
    theme: "Mind & Energy",
    description:
      "Channels focus and raw energy. Scales hard on spell power, light, and chained electric attacks.",
    synergies: [
      Synergy.HUMAN,
      Synergy.FIGHTING,
      Synergy.PSYCHIC,
      Synergy.LIGHT,
      Synergy.ELECTRIC
    ],
    startingRelic: Relic.CrackedCore
  },
  [SpireClass.WATCHER]: {
    id: SpireClass.WATCHER,
    name: "The Watcher",
    theme: "Dark",
    description:
      "Walks the line between light and shadow. Alternates holy radiance and cursed power for devastating bursts.",
    synergies: [
      Synergy.DARK,
      Synergy.GHOST,
      Synergy.PSYCHIC,
      Synergy.FIRE,
      Synergy.LIGHT
    ],
    startingRelic: Relic.PureWater_0
  },
  [SpireClass.DRIFTER]: {
    id: SpireClass.DRIFTER,
    name: "The Drifter",
    theme: "Sea & Sky",
    description:
      "A nomad of tide and storm. Slippery and weather-driven, controlling the battlefield from afar.",
    synergies: [
      Synergy.WATER,
      Synergy.AQUATIC,
      Synergy.ICE,
      Synergy.FLYING,
      Synergy.SOUND
    ],
    startingRelic: Relic.Captain_wheel
  },
  [SpireClass.BEHEMOTH]: {
    id: SpireClass.BEHEMOTH,
    name: "The Behemoth",
    theme: "Earth Monsters",
    description:
      "An immovable colossus of stone and steel. Slow to fall and crushing in return — a wall that hits back.",
    synergies: [
      Synergy.GROUND,
      Synergy.ROCK,
      Synergy.FOSSIL,
      Synergy.MONSTER,
      Synergy.STEEL
    ],
    startingRelic: Relic.FossilizedHelix
  }
}

export const ALL_SPIRE_CLASSES: SpireClassData[] = Object.values(SPIRE_CLASSES)

/**
 * Relics exclusive to one class: reward pools (e.g. the Spire gym-win relic
 * offer) only show them to that class. Holding/granting is NOT restricted —
 * the admin GIVE_RELIC cheat still works for any class.
 * The 6 class starting relics are gated to their own class so another class
 * can never be offered them as a reward.
 */
export const CLASS_EXCLUSIVE_RELICS: Partial<Record<Relic, SpireClass>> = {
  // class starting relics
  [Relic.BurningBlood]: SpireClass.IRONCLAD,
  [Relic.RingoftheSnake]: SpireClass.SILENT,
  [Relic.CrackedCore]: SpireClass.DEFECT,
  [Relic.PureWater_0]: SpireClass.WATCHER,
  [Relic.Captain_wheel]: SpireClass.DRIFTER,
  [Relic.FossilizedHelix]: SpireClass.BEHEMOTH,
  // Silent-exclusive reward relics
  [Relic.HappyFlower]: SpireClass.SILENT,
  [Relic.Mango]: SpireClass.SILENT,
  [Relic.OddMushroom]: SpireClass.SILENT,
  [Relic.RingoftheSerpent]: SpireClass.SILENT,
  [Relic.Violet_lotus]: SpireClass.SILENT
}
