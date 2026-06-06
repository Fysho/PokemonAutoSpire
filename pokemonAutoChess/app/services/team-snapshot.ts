import { MapSchema } from "@colyseus/schema"
import Player from "../models/colyseus-models/player"
import { Pokemon } from "../models/colyseus-models/pokemon"
import Synergies, { computeSynergies } from "../models/colyseus-models/synergies"
import { Effects } from "../models/effects"
import PokemonFactory from "../models/pokemon-factory"
import GameState from "../rooms/states/game-state"
import { Emotion, Role, TMs } from "../types"
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
  luck: number
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
  tm?: Ability
  dishes?: Item[]
  evolution?: Pkm
  stacks?: number
  stacksRequired?: number
}

export interface TeamSnapshot {
  name: string
  avatar: string
  pokemon: SnapshotPokemon[]
  inventory: Item[]
  groundHoles: number[]
  lightX: number
  lightY: number
  region?: string
  // Hidden per-run id of the run that placed this team in the Elite Four / Champion
  // slot. Lets a single run be identified across the slots it occupies as it climbs,
  // and lets a player legitimately hold several teams (one per run) in the ladder.
  runId?: string
  // Gold the player held when the team was snapshotted. Reapplied to the
  // reconstructed opponent so gold-scaling effects work (Gold Bottle Cap crit power,
  // Gholdengo's gold damage). Optional for legacy snapshots saved before this field.
  money?: number
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
      speed: pkm.speed - baseline.speed,
      luck: pkm.luck - baseline.luck
    }
    const hasBoosts = boosts.hp || boosts.atk || boosts.def || boosts.speDef || boosts.ap || boosts.speed || boosts.luck

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
    if (pkm.tm !== Ability.DEFAULT) snap.tm = pkm.tm
    if (pkm.dishes?.size > 0) {
      snap.dishes = [...pkm.dishes] as Item[]
    } else if (pkm._cookedDishes?.length > 0) {
      snap.dishes = [...pkm._cookedDishes] as Item[]
    }

    if (pkm.evolution !== Pkm.DEFAULT) snap.evolution = pkm.evolution
    if (pkm.stacks > 0) snap.stacks = pkm.stacks
    if (pkm.stacksRequired > 0) snap.stacksRequired = pkm.stacksRequired

    pokemon.push(snap)
  })

  return {
    name: player.name,
    avatar: player.avatar,
    pokemon,
    inventory: [...player.items] as Item[],
    groundHoles: [...player.groundHoles],
    lightX: player.lightX,
    lightY: player.lightY,
    money: player.money
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
        if (TMs.includes(item)) continue // TMs aren't held items; restored via snap.tm below
        if (!pkm.items.has(item)) pkm.items.add(item)
      }
    }

    // Restore the ability. A TM takes precedence (sets the tm marker + skill +
    // 100 PP, like applying the TM); otherwise a non-TM skill change (Skill Swap
    // or Sketch-learned) just sets the skill.
    if (snap.tm) {
      pkm.tm = snap.tm
      pkm.skill = snap.tm
      pkm.maxPP = 100
    } else if (snap.skill) {
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
      if (b.luck) pkm.addLuck(b.luck)
    }

    if (snap.dishes) {
      for (const dish of snap.dishes) {
        pkm.dishes.add(dish)
      }
    }

    if (snap.evolution) pkm.evolution = snap.evolution
    if (snap.stacks) pkm.stacks = snap.stacks
    if (snap.stacksRequired) pkm.stacksRequired = snap.stacksRequired

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
        if (TMs.includes(item)) continue // TMs aren't held items; restored via snap.tm below
        if (!pkm.items.has(item)) pkm.items.add(item)
      }
    }

    // Restore the ability. A TM takes precedence (sets the tm marker + skill +
    // 100 PP, like applying the TM); otherwise a non-TM skill change (Skill Swap
    // or Sketch-learned) just sets the skill.
    if (snap.tm) {
      pkm.tm = snap.tm
      pkm.skill = snap.tm
      pkm.maxPP = 100
    } else if (snap.skill) {
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
      if (b.luck) pkm.addLuck(b.luck)
    }

    if (snap.dishes) {
      for (const dish of snap.dishes) {
        pkm.dishes.add(dish)
      }
    }

    if (snap.evolution) pkm.evolution = snap.evolution
    if (snap.stacks) pkm.stacks = snap.stacks
    if (snap.stacksRequired) pkm.stacksRequired = snap.stacksRequired

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

  // Reapply the snapshot's gold so gold-scaling effects fire for this opponent
  // (Gold Bottle Cap crit power, Gholdengo gold damage). Read-only during the fight.
  player.money = snapshot.money ?? 0

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
  // Format: name,x,y[,items...][|boosts[|dishes...]]
  // Dishes are kept in their own segment (NOT merged into items) so the client
  // can render them below the Pokemon via updateDishes() rather than as held
  // items to the right. Segments are positional: when dishes exist but boosts
  // don't, an empty boost segment is emitted to keep dishes at index 2.
  return snapshot.pokemon
    .filter((p) => p.y > 0)
    .map((p) => {
      const itemStr = p.items.length > 0 ? `,${p.items.join(",")}` : ""
      const b = p.statBoosts
      const hasBoosts =
        b && (b.hp || b.atk || b.def || b.speDef || b.ap || b.speed)
      const dishes = p.dishes ?? []
      let suffix = ""
      if (hasBoosts || dishes.length > 0) {
        suffix += `|${hasBoosts ? `${b!.hp},${b!.atk},${b!.def},${b!.speDef},${b!.ap},${b!.speed},${b!.luck}` : ""}`
      }
      if (dishes.length > 0) {
        suffix += `|${dishes.join(",")}`
      }
      return `${p.name},${p.x},${p.y}${itemStr}${suffix}`
    })
}
