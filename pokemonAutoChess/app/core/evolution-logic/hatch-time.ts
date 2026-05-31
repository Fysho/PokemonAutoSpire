import { EvolutionTime } from "../../config"
import type Player from "../../models/colyseus-models/player"
import type { Pokemon } from "../../models/colyseus-models/pokemon"
import { EvolutionRuleType } from "../../types/EvolutionRules"
import { EffectEnum } from "../../types/enum/Effect"
import { Pkm } from "../../types/enum/Pokemon"

export function getHatchTime(pokemon: Pokemon, player: Player): number {
  // Spire: timer-based evolutions (Tandemaus/Maushold) carry a fixed hatchTime in their
  // rule data, replacing the old TimerEvolutionRule.getHatchTime(). See 6.9→6.10 migration doc.
  if (
    pokemon.evolutionRule.type === EvolutionRuleType.HATCH &&
    pokemon.evolutionRule.hatchTime != null
  ) {
    return pokemon.evolutionRule.hatchTime
  }
  if (pokemon.name === Pkm.EGG) {
    return player.effects.has(EffectEnum.BREEDER) ||
      player.effects.has(EffectEnum.GOLDEN_EGGS)
      ? EvolutionTime.EGG_HATCH - 1
      : EvolutionTime.EGG_HATCH
  }
  return EvolutionTime.EVOLVE_HATCH
}
