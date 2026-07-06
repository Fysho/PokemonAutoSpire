import type Player from "../models/colyseus-models/player"
import { Synergy } from "../types/enum/Synergy"
import {
  Effect,
  OnAttackEffect,
  OnKillEffect,
  OnSpawnEffect,
  PeriodicEffect
} from "./effects/effect"
import type { PokemonEntity } from "./pokemon-entity"
import { Relic } from "./relics"

/**
 * Battle effects for the 6 class **starting relics**.
 *
 * Each relic buffs ONLY the player's board Pokémon whose `types` include one of
 * the relic's synergies (`RELIC_SYNERGIES`). "Has the type" is enough — the
 * synergy does NOT need to be active. Effects are player-team only (never the
 * reconstructed Champion/E4/async opponent), re-applied fresh each battle, and
 * **stack**: a Pokémon matching several held relics gets all of them.
 *
 * The synergy lists live here (decoupled from `spire-classes.ts`) on purpose —
 * this is a relic effect, not a class effect.
 */
export const RELIC_SYNERGIES: Partial<Record<Relic, Synergy[]>> = {
  [Relic.BurningBlood]: [
    Synergy.FIELD,
    Synergy.NORMAL,
    Synergy.WILD,
    Synergy.ELECTRIC,
    Synergy.FIRE
  ],
  [Relic.RingoftheSnake]: [
    Synergy.BUG,
    Synergy.POISON,
    Synergy.GRASS,
    Synergy.FLORA,
    Synergy.FAIRY
  ],
  [Relic.CrackedCore]: [
    Synergy.HUMAN,
    Synergy.FIGHTING,
    Synergy.PSYCHIC,
    Synergy.LIGHT,
    Synergy.ELECTRIC
  ],
  [Relic.PureWater_0]: [
    Synergy.DARK,
    Synergy.GHOST,
    Synergy.PSYCHIC,
    Synergy.FIRE,
    Synergy.LIGHT
  ],
  [Relic.Captain_wheel]: [
    Synergy.WATER,
    Synergy.AQUATIC,
    Synergy.ICE,
    Synergy.FLYING,
    Synergy.SOUND
  ],
  [Relic.FossilizedHelix]: [
    Synergy.GROUND,
    Synergy.ROCK,
    Synergy.FOSSIL,
    Synergy.MONSTER,
    Synergy.STEEL
  ],
  // Silent-exclusive reward relics (see CLASS_EXCLUSIVE_RELICS)
  [Relic.HappyFlower]: [Synergy.FLORA],
  [Relic.Violet_lotus]: [Synergy.FAIRY]
}

// Produces the Effect a relic attaches to a qualifying entity (a fresh instance
// per entity so per-entity state like PeriodicEffect timers don't get shared).
const RELIC_EFFECT_FACTORIES: Partial<Record<Relic, () => Effect>> = {
  // Ironclad — +1 ATK per basic attack (copies the Fire synergy's FireHitEffect)
  [Relic.BurningBlood]: () =>
    new OnAttackEffect(({ pokemon }) => {
      pokemon.addAttack(1, pokemon, 0, false)
    }, Relic.BurningBlood),

  // Silent — heal 1% of max HP each second
  [Relic.RingoftheSnake]: () =>
    new PeriodicEffect(
      (entity) => {
        entity.handleHeal(Math.ceil(entity.maxHP * 0.01), entity, 0, false)
      },
      Relic.RingoftheSnake,
      1000
    ),

  // Defect — +2 PP each second
  [Relic.CrackedCore]: () =>
    new PeriodicEffect(
      (entity) => {
        entity.addPP(2, entity, 0, false)
      },
      Relic.CrackedCore,
      1000
    ),

  // Watcher — +2 AP each second
  [Relic.PureWater_0]: () =>
    new PeriodicEffect(
      (entity) => {
        entity.addAbilityPower(2, entity, 0, false)
      },
      Relic.PureWater_0,
      1000
    ),

  // Drifter — +5% attack speed & +5% dodge at battle start
  [Relic.Captain_wheel]: () =>
    new OnSpawnEffect((entity) => {
      entity.addSpeed(Math.max(1, Math.round(entity.speed * 0.05)), entity, 0, false)
      entity.addDodgeChance(0.05, entity, 0, false)
    }, Relic.Captain_wheel),

  // Behemoth — shield = 10% of max HP at battle start
  [Relic.FossilizedHelix]: () =>
    new OnSpawnEffect((entity) => {
      entity.addShield(Math.ceil(entity.maxHP * 0.1), entity, 0, false)
    }, Relic.FossilizedHelix),

  // Happy Flower (Silent) — kills by FLORA Pokémon each grant 1 mulch stack
  [Relic.HappyFlower]: () =>
    new OnKillEffect(({ attacker }) => {
      if (attacker.player && !attacker.isGhostOpponent) {
        attacker.player.collectMulch(1)
      }
    }, Relic.HappyFlower),

  // Violet Lotus (Silent) — FAIRY Pokémon heal adjacent allies 1% of their
  // max HP every second (Green Orb-style aura)
  [Relic.Violet_lotus]: () =>
    new PeriodicEffect(
      (entity, board) => {
        const adjacentCells = board.getAdjacentCells(
          entity.positionX,
          entity.positionY
        )
        for (const cell of adjacentCells) {
          if (cell.value && cell.value.team === entity.team) {
            cell.value.handleHeal(
              Math.ceil(cell.value.maxHP * 0.01),
              entity,
              0,
              false
            )
          }
        }
      },
      Relic.Violet_lotus,
      1000
    )
}

function entityMatchesRelic(entity: PokemonEntity, relic: Relic): boolean {
  const synergies = RELIC_SYNERGIES[relic]
  if (!synergies) return false
  return synergies.some((s) => entity.types.has(s))
}

/**
 * Attach the player's relic battle effects to one of their board entities.
 * Called from `Simulation.addPokemon` for the player's (BLUE) team only.
 */
export function applyRelicBattleEffects(
  entity: PokemonEntity,
  player: Player | undefined
) {
  if (!player?.relics?.length) return
  for (const relic of player.relics) {
    const factory = RELIC_EFFECT_FACTORIES[relic as Relic]
    if (!factory) continue
    if (!entityMatchesRelic(entity, relic as Relic)) continue
    entity.effectsSet.add(factory())
  }
}
