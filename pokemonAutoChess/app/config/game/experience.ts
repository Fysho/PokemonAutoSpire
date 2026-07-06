// Player experience gains based on rank
export const ExpPlace = [700, 400, 350, 300, 250, 200, 200, 200]

export const ExpThreshold = 1000

export const MAX_LEVEL = 9

// Experience required to move from level n to level n+1
export const ExpTable: { [key: number]: number } = Object.freeze({
  1: 0,
  2: 2,
  3: 6,
  4: 10,
  5: 22,
  6: 34,
  7: 52,
  8: 72,
  9: 250,
  10: 500,
  11: 750,
  12: 1000,
  13: 255
})

// Spire mode's OWN level-up curve (independent of classic). Players start at
// level 1; tune freely without affecting classic/endless.
export const SpireExpTable: { [key: number]: number } = Object.freeze({
  1: 2,
  2: 6,
  3: 10,
  4: 16,
  5: 22,
  6: 34,
  7: 52,
  8: 72,
  9: 250,
  10: 500,
  11: 750,
  12: 1000,
  13: 255
})

export const ENDLESS_MAX_LEVEL = 13
