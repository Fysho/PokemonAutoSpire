import { max } from "./number"

export type RandomSource = () => number

let activeRandomSource: RandomSource = Math.random

export function randomFloat(): number {
  return activeRandomSource()
}

// Progression operations are synchronous. Keeping the override scoped prevents
// one room's deterministic run RNG from leaking into another room or combat.
export function withRandomSource<T>(
  source: RandomSource,
  operation: () => T
): T {
  const previousSource = activeRandomSource
  activeRandomSource = source
  try {
    return operation()
  } finally {
    activeRandomSource = previousSource
  }
}

export function hashStringToUint32(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

// Counter-based generator: random value n is derived directly from (seed, n),
// so restoring a run only needs the seed and counter, never replaying the stream.
export function counterRandom(seed: number, counter: number): number {
  let value = (seed + Math.imul((counter + 1) | 0, 0x9e3779b9)) | 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad)
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97)
  value ^= value >>> 15
  return (value >>> 0) / 0x100000000
}

export function chance(
  probability: number,
  pokemon?: { luck: number },
  cap = 1
): boolean {
  if (probability === 0) return false // prevent return true if 100% luck and 0 probability
  return (
    randomFloat() <
    max(cap)(Math.pow(probability, 1 - (pokemon?.luck ?? 0) / 100))
  )
}

export function randomWeighted<T extends string>(
  weights: { [item in T]?: number },
  totalWeight?: number,
  ap: number = 0,
  apScaling: number = 1,
  luck: number = 0
): T | null {
  if (totalWeight === undefined) {
    totalWeight = (Object.values(weights) as number[]).reduce(
      (sum: number, weight: number) => sum + weight,
      0
    )
  }
  let random =
    randomFloat() *
    totalWeight *
    (1 + ap * (apScaling / 100)) *
    (1 + luck / 100)
  for (const [item, weight] of Object.entries(weights) as [T, number][]) {
    if ((random -= weight) < 0) return item
  }
  return null
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(randomFloat() * (max - min + 1) + min)
}

export function pickRandomIn<T>(
  list: T[] | readonly T[] | Record<string, T>
): T {
  if (!Array.isArray(list)) return pickRandomIn(Object.values(list))
  return list[Math.floor(randomFloat() * list.length)]
}

export function pickNRandomIn<T>(
  array: T[] | readonly T[],
  number: number
): T[] {
  const selection: T[] = [],
    options = [...array]
  shuffleArray(options)
  while (selection.length < number && options.length > 0) {
    selection.push(options.pop()!)
  }
  return selection
}

/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
export function shuffleArray<T extends Array<unknown>>(array: T): T {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(randomFloat() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array
}

export function simpleHashSeededCoinFlip(seed: string) {
  // Simple hash function to turn a string into a boolean coin flip
  const hash = Array.from(seed).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0
  )
  return hash % 2 === 0
}
