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
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Mysterious Trader",
    description: "A cloaked figure offers you a deal...",
    choices: [
      { label: "Trade 10 gold", description: "Receive a rare item" },
      { label: "Trade an item", description: "Receive 8 gold" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Ancient Shrine",
    description: "An ancient shrine radiates mysterious energy...",
    choices: [
      { label: "Sacrifice (costs 20 HP)", description: "Receive a crafted item" },
      { label: "Offering (costs 10 HP)", description: "Receive an item component" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Berry Grove",
    description: "You discover a grove full of berry trees!",
    choices: [
      { label: "Pick berries", description: "Receive 3 random berries (free)" },
      { label: "Pick more berries (3 gold)", description: "Receive 5 random berries" },
      { label: "Pick all berries (6 gold)", description: "Receive 7 random berries" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Wandering Merchant",
    description: "A traveling merchant has rare wares...",
    choices: [
      { label: "Buy supplies (8 gold)", description: "Receive 2 random items" },
      { label: "Rob them (lose 30 HP)", description: "Gain 15 gold" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Abandoned Mine",
    description: "An old mine entrance beckons...",
    choices: [
      { label: "Explore", description: "Find a random item (or nothing)" },
      { label: "Mine for gems", description: "Gain 6 gold" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Battle Challenge",
    description: "A martial artist blocks your path. \"Prove your strength! I'll equip the next wild Pokemon with powerful gear. Defeat them and the gear is yours.\"",
    choices: [
      { label: "Rocky Helmet challenge", description: "Next wild encounter: all enemies get Rocky Helmet. Win to earn one." },
      { label: "Assault Vest challenge", description: "Next wild encounter: all enemies get Assault Vest. Win to earn one." },
      { label: "Kings Rock challenge", description: "Next wild encounter: all enemies get Kings Rock. Win to earn one." },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Elemental Trial",
    description: "An ancient guardian offers you a trial by element. \"Channel the power of the orbs — but first, you must overcome it.\"",
    choices: [
      { label: "Red Orb challenge", description: "Next wild encounter: all enemies get Red Orb. Win to earn one." },
      { label: "Blue Orb challenge", description: "Next wild encounter: all enemies get Blue Orb. Win to earn one." },
      { label: "Green Orb challenge", description: "Next wild encounter: all enemies get Green Orb. Win to earn one." },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Junk Collector",
    description: "A scruffy collector rummages through a pile of odds and ends. \"I've got some useful tools if you're interested!\"",
    choices: [
      { label: "Exchange Ticket", description: "Receive an Exchange Ticket" },
      { label: "Recycle Ticket", description: "Receive a Recycle Ticket" },
      { label: "Trash", description: "Receive a Trash item" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Fisherman",
    description: "A fisherman casts his line into a quiet pond. \"I've got a few catches if you're interested!\"",
    choices: [
      { label: "Take a Carp", description: "Receive a Magikarp (free)" },
      { label: "Buy a Feebas (10 gold)", description: "Receive a Feebas" },
      { label: "Buy a Wishiwashi (20 gold)", description: "Receive a Wishiwashi" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Nurse Joy",
    description: "Nurse Joy is set up at a roadside aid station. \"Let me take care of your team!\"",
    choices: [
      { label: "Potion", description: "Restore 20 HP (free)" },
      { label: "Rest (10 gold)", description: "Restore 50 HP" },
      { label: "Berries for the road (3 gold)", description: "Receive 3 Oran Berries" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Shady Gambler",
    description: "A gambler shuffles cards at a makeshift table. \"Feeling lucky? Double or nothing!\"",
    choices: [
      { label: "Gamble 10 gold", description: "50% chance: win 20 gold or lose your bet" },
      { label: "Gamble 5 gold", description: "50% chance: win 10 gold or lose your bet" },
      { label: "Skip", description: "Nothing happens" }
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
