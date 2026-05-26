import { MapSchema } from "@colyseus/schema"
import Player from "../models/colyseus-models/player"
import { Pokemon } from "../models/colyseus-models/pokemon"
import Synergies, { computeSynergies } from "../models/colyseus-models/synergies"
import { Effects } from "../models/effects"
import PokemonFactory from "../models/pokemon-factory"
import GameState from "../rooms/states/game-state"
import { AbilityPerTM, Emotion, Role, TMs } from "../types"
import { Ability } from "../types/enum/Ability"
import { EffectEnum } from "../types/enum/Effect"
import { Team } from "../types/enum/Game"
import { Item, SynergyGem, SynergyGivenByGem } from "../types/enum/Item"
import { Pkm } from "../types/enum/Pokemon"
import { Synergy } from "../types/enum/Synergy"

export interface PokemonStatBoosts {
  hp: number
  atk: number
  def: number
  speDef: number
  ap: number
  speed: number
}

export interface SnapshotPokemon {
  name: Pkm
  x: number
  y: number
  items: Item[]
  shiny?: boolean
  emotion?: Emotion
  statBoosts?: PokemonStatBoosts
  skill?: Ability
  dishes?: Item[]
}

export interface TeamSnapshot {
  name: string
  avatar: string
  pokemon: SnapshotPokemon[]
  inventory: Item[]
  groundHoles: number[]
  lightX: number
  lightY: number
}

export function snapshotPlayerTeam(
  player: Player,
  options?: { includeBench?: boolean }
): TeamSnapshot {
  const pokemon: SnapshotPokemon[] = []

  player.board.forEach((pkm) => {
    if (!options?.includeBench && pkm.positionY <= 0) return

    const baseline = PokemonFactory.createPokemonFromName(pkm.name as Pkm)
    const boosts: PokemonStatBoosts = {
      hp: pkm.hp - baseline.hp,
      atk: pkm.atk - baseline.atk,
      def: pkm.def - baseline.def,
      speDef: pkm.speDef - baseline.speDef,
      ap: pkm.ap - baseline.ap,
      speed: pkm.speed - baseline.speed
    }
    const hasBoosts = boosts.hp || boosts.atk || boosts.def || boosts.speDef || boosts.ap || boosts.speed

    const snap: SnapshotPokemon = {
      name: pkm.name as Pkm,
      x: pkm.positionX,
      y: pkm.positionY,
      items: [...pkm.items] as Item[]
    }

    if (pkm.shiny) snap.shiny = true
    if (pkm.emotion !== Emotion.NORMAL) snap.emotion = pkm.emotion
    if (hasBoosts) snap.statBoosts = boosts
    if (pkm.skill !== baseline.skill) snap.skill = pkm.skill
    if (pkm.dishes?.size > 0) snap.dishes = [...pkm.dishes] as Item[]

    pokemon.push(snap)
  })

  return {
    name: player.name,
    avatar: player.avatar,
    pokemon,
    inventory: [...player.items] as Item[],
    groundHoles: [...player.groundHoles],
    lightX: player.lightX,
    lightY: player.lightY
  }
}

export function reconstructTeamAsBoard(snapshot: TeamSnapshot): {
  board: MapSchema<Pokemon>
  effects: Set<EffectEnum>
} {
  const board = new MapSchema<Pokemon>()

  for (const snap of snapshot.pokemon) {
    if (snap.y <= 0) continue

    const pkm = PokemonFactory.createPokemonFromName(snap.name, {
      emotion: snap.emotion ?? Emotion.NORMAL,
      shiny: !!snap.shiny
    })
    pkm.positionX = snap.x
    pkm.positionY = snap.y

    if (snap.items) {
      for (const item of snap.items) {
        if (TMs.includes(item)) {
          const ability = AbilityPerTM[item]
          if (ability && pkm.types.has(Synergy.HUMAN)) {
            pkm.tm = ability
            pkm.skill = ability
            pkm.maxPP = 100
          }
        } else if (!pkm.items.has(item)) {
          pkm.items.add(item)
        }
      }
    }

    if (snap.skill && !snap.items?.some((i) => TMs.includes(i))) {
      pkm.skill = snap.skill
    }

    if (snap.statBoosts) {
      const b = snap.statBoosts
      if (b.hp) pkm.addMaxHP(b.hp)
      if (b.atk) pkm.addAttack(b.atk)
      if (b.def) pkm.addDefense(b.def)
      if (b.speDef) pkm.addSpecialDefense(b.speDef)
      if (b.ap) pkm.addAbilityPower(b.ap)
      if (b.speed) pkm.addSpeed(b.speed)
    }

    if (snap.dishes) {
      for (const dish of snap.dishes) {
        pkm.dishes.add(dish)
      }
    }

    board.set(pkm.id, pkm)
  }

  const bonusSynergies = new Map<Synergy, number>()
  if (snapshot.inventory) {
    for (const item of snapshot.inventory) {
      const synType = SynergyGivenByGem[item as SynergyGem]
      if (synType) {
        bonusSynergies.set(synType, (bonusSynergies.get(synType) ?? 0) + 1)
      }
    }
  }

  const synergies = new Synergies(
    computeSynergies(
      Array.from(board.values()),
      bonusSynergies.size > 0 ? bonusSynergies : undefined
    )
  )
  const pveEffects = new Effects()
  pveEffects.update(synergies, board)
  const effectsSet = new Set<EffectEnum>()
  pveEffects.forEach((e) => effectsSet.add(e))

  return { board, effects: effectsSet }
}

export function reconstructTeamAsPlayer(
  snapshot: TeamSnapshot,
  state: GameState
): Player {
  const player = new Player(
    `champion-${snapshot.name}`,
    snapshot.name,
    1200,
    0,
    snapshot.avatar,
    true,
    2,
    new Map(),
    "",
    Role.BOT,
    state
  )

  player.team = Team.RED_TEAM
  player.board.forEach((_p, key) => player.board.delete(key))

  for (const snap of snapshot.pokemon) {
    const pkm = PokemonFactory.createPokemonFromName(snap.name, {
      emotion: snap.emotion ?? Emotion.NORMAL,
      shiny: !!snap.shiny
    })
    pkm.positionX = snap.x
    pkm.positionY = snap.y

    if (snap.items) {
      for (const item of snap.items) {
        if (TMs.includes(item)) {
          const ability = AbilityPerTM[item]
          if (ability && pkm.types.has(Synergy.HUMAN)) {
            pkm.tm = ability
            pkm.skill = ability
            pkm.maxPP = 100
          }
        } else if (!pkm.items.has(item)) {
          pkm.items.add(item)
        }
      }
    }

    if (snap.skill && !snap.items?.some((i) => TMs.includes(i))) {
      pkm.skill = snap.skill
    }

    if (snap.statBoosts) {
      const b = snap.statBoosts
      if (b.hp) pkm.addMaxHP(b.hp)
      if (b.atk) pkm.addAttack(b.atk)
      if (b.def) pkm.addDefense(b.def)
      if (b.speDef) pkm.addSpecialDefense(b.speDef)
      if (b.ap) pkm.addAbilityPower(b.ap)
      if (b.speed) pkm.addSpeed(b.speed)
    }

    if (snap.dishes) {
      for (const dish of snap.dishes) {
        pkm.dishes.add(dish)
      }
    }

    player.board.set(pkm.id, pkm)
  }

  // Set inventory items (gems, relics, etc.)
  player.items.clear()
  for (const item of snapshot.inventory) {
    player.items.push(item)
  }

  // Set ground holes
  for (let i = 0; i < snapshot.groundHoles.length && i < player.groundHoles.length; i++) {
    player.groundHoles[i] = snapshot.groundHoles[i]
  }

  // Set light position
  player.lightX = snapshot.lightX
  player.lightY = snapshot.lightY

  // Compute synergies and effects directly, bypassing updateSynergies()
  // which has side effects (scarves, artificial items, TMs, wands, etc.)
  // that corrupt state on a freshly constructed Player
  const bonusSynergies = new Map<Synergy, number>()
  for (const item of snapshot.inventory) {
    const synType = SynergyGivenByGem[item as SynergyGem]
    if (synType) {
      bonusSynergies.set(synType, (bonusSynergies.get(synType) ?? 0) + 1)
    }
  }

  const synergyCounts = computeSynergies(
    Array.from(player.board.values()),
    bonusSynergies.size > 0 ? bonusSynergies : undefined
  )
  synergyCounts.forEach((value, synergy) => {
    player.synergies.set(synergy, value)
  })

  player.effects.update(player.synergies, player.board)

  return player
}

export function encodeSnapshotForClient(snapshot: TeamSnapshot): string[] {
  return snapshot.pokemon
    .filter((p) => p.y > 0)
    .map((p) => {
      const itemStr = p.items.length > 0 ? `,${p.items.join(",")}` : ""
      const b = p.statBoosts
      const boostStr =
        b && (b.hp || b.atk || b.def || b.speDef || b.ap || b.speed)
          ? `|${b.hp},${b.atk},${b.def},${b.speDef},${b.ap},${b.speed}`
          : ""
      return `${p.name},${p.x},${p.y}${itemStr}${boostStr}`
    })
}
