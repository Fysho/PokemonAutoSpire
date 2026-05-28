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
  portrait: string
  choices: SpireEventChoice[]
}

export const SPIRE_EVENTS: SpireEvent[] = [
  {
    name: "Pokemon Day Care",
    description: "An elderly couple runs a small day care on the roadside. \"We've got a few Pokemon that need a good home!\"",
    portrait: "0000-0004",
    choices: [
      { label: "Take an Egg", description: "Receive a random egg Pokemon" },
      { label: "Dojo Ticket", description: "Receive a Dojo Ticket" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Mysterious Trader",
    description: "A cloaked figure offers you a deal...",
    portrait: "0908",
    choices: [
      { label: "Trade 10 gold", description: "Receive a random tool" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Lost Tower",
    description: "A crumbling tower looms in the mist. Ghostly whispers echo from within...",
    portrait: "0092",
    choices: [
      { label: "Sacrifice (costs 20 HP)", description: "Receive a crafted item" },
      { label: "Offering (costs 10 HP)", description: "Receive an item component" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Berry Grove",
    description: "You discover a grove full of berry trees!",
    portrait: "0820",
    choices: [
      { label: "Pick berries", description: "Receive 3 random berries (free)" },
      { label: "Pick more berries (3 gold)", description: "Receive 5 random berries" },
      { label: "Pick all berries (6 gold)", description: "Receive 7 random berries" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Wandering Kecleon",
    description: "A Kecleon has set up a small shop along the path. \"I've got some rare finds today!\"",
    portrait: "0352",
    choices: [
      { label: "Buy supplies (8 gold)", description: "Receive 2 random items" },
      { label: "Rob them (lose 40 HP)", description: "Receive 2 random items for free" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Abandoned Mine",
    description: "An old mine entrance beckons...",
    portrait: "0095",
    choices: [
      { label: "Dig for gems", description: "Receive a random synergy stone" },
      { label: "Search for fossils", description: "Receive a Fossil Stone" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Battle Challenge",
    description: "A martial artist blocks your path. \"Prove your strength! I'll equip the next wild Pokemon with powerful gear. Defeat them and the gear is yours.\"",
    portrait: "0532",
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
    portrait: "0383",
    choices: [
      { label: "Red Orb challenge", description: "Next wild encounter: all enemies get Red Orb. Win to earn one." },
      { label: "Blue Orb challenge", description: "Next wild encounter: all enemies get Blue Orb. Win to earn one." },
      { label: "Green Orb challenge", description: "Next wild encounter: all enemies get Green Orb. Win to earn one." },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Kecleon",
    description: "A Kecleon rummages through a pile of odds and ends. \"I've got some useful tickets if you're interested!\"",
    portrait: "0352",
    choices: [
      { label: "2 Exchange Tickets", description: "Receive 2 Exchange Tickets" },
      { label: "1 Exchange + 1 Recycle", description: "Receive 1 Exchange Ticket and 1 Recycle Ticket" },
      { label: "2 Recycle Tickets", description: "Receive 2 Recycle Tickets" },
      { label: "Skip", description: "Nothing happens" }
    ]
  },
  {
    name: "Fisherman",
    description: "A fisherman casts his line into a quiet pond. \"I've got a few catches if you're interested!\"",
    portrait: "0130",
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
    portrait: "0242",
    choices: [
      { label: "Potion", description: "Restore 20 HP (free)" },
      { label: "Rest (10 gold)", description: "Restore 50 HP" },
      { label: "Berries for the road (3 gold)", description: "Receive 5 Oran Berries" },
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
