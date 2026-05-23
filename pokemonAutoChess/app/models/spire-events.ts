import { Item, ItemComponentsNoFossilOrScarf, NonSpecialBerries } from "../types/enum/Item"
import { Pkm } from "../types/enum/Pokemon"
import { pickNRandomIn, pickRandomIn } from "../utils/random"

export interface SpireEventChoice {
  label: string
  description: string
}

export interface SpireEvent {
  name: string
  description: string
  choices: SpireEventChoice[]
}

export const SPIRE_EVENTS: SpireEvent[] = [
  {
    name: "Abandoned Daycare",
    description: "You find an old daycare with some eggs left behind...",
    choices: [
      { label: "Take an Egg", description: "Receive a random egg Pokemon" },
      { label: "Search the grounds", description: "Find 2 random items" },
      { label: "Leave", description: "Nothing happens" }
    ]
  },
  {
    name: "Mysterious Trader",
    description: "A cloaked figure offers you a deal...",
    choices: [
      { label: "Trade 10 gold", description: "Receive a rare item" },
      { label: "Trade an item", description: "Receive 8 gold" },
      { label: "Decline", description: "Nothing happens" }
    ]
  },
  {
    name: "Ancient Shrine",
    description: "An ancient shrine radiates mysterious energy...",
    choices: [
      { label: "Pray (costs 15 HP)", description: "Receive a powerful item" },
      { label: "Meditate", description: "Gain 5 gold" },
      { label: "Walk away", description: "Nothing happens" }
    ]
  },
  {
    name: "Berry Grove",
    description: "You discover a grove full of berry trees!",
    choices: [
      { label: "Pick berries", description: "Receive 3 random berries" },
      { label: "Rest under a tree", description: "Heal 10 HP" }
    ]
  },
  {
    name: "Wandering Merchant",
    description: "A traveling merchant has rare wares...",
    choices: [
      { label: "Buy supplies (8 gold)", description: "Receive 2 random items" },
      { label: "Chat", description: "Learn something useful - gain 4 XP" },
      { label: "Rob them (lose 10 HP)", description: "Gain 15 gold" }
    ]
  },
  {
    name: "Abandoned Mine",
    description: "An old mine entrance beckons...",
    choices: [
      { label: "Explore", description: "Find a random item (or nothing)" },
      { label: "Mine for gems", description: "Gain 6 gold" }
    ]
  },
  {
    name: "Battle Challenge",
    description: "A martial artist blocks your path. \"Prove your strength! I'll equip the next wild Pokemon with powerful gear. Defeat them and the gear is yours.\"",
    choices: [
      { label: "Rocky Helmet challenge", description: "Next wild encounter: all enemies get Rocky Helmet. Win to earn one." },
      { label: "Assault Vest challenge", description: "Next wild encounter: all enemies get Assault Vest. Win to earn one." },
      { label: "Kings Rock challenge", description: "Next wild encounter: all enemies get Kings Rock. Win to earn one." }
    ]
  },
  {
    name: "Elemental Trial",
    description: "An ancient guardian offers you a trial by element. \"Channel the power of the orbs — but first, you must overcome it.\"",
    choices: [
      { label: "Red Orb challenge", description: "Next wild encounter: all enemies get Red Orb. Win to earn one." },
      { label: "Blue Orb challenge", description: "Next wild encounter: all enemies get Blue Orb. Win to earn one." },
      { label: "Green Orb challenge", description: "Next wild encounter: all enemies get Green Orb. Win to earn one." }
    ]
  }
]

export function getRandomEvent(): SpireEvent {
  return pickRandomIn(SPIRE_EVENTS)
}

export function getEventItems(count: number): Item[] {
  return pickNRandomIn(ItemComponentsNoFossilOrScarf, count)
}

export function getEventBerries(count: number): Item[] {
  return pickNRandomIn(NonSpecialBerries, count)
}
