import Player from "../models/colyseus-models/player"
import { computeSynergies } from "../models/colyseus-models/synergies"
import PokemonFactory from "../models/pokemon-factory"
import GameState from "../rooms/states/game-state"
import { Emotion } from "../types"
import { Item } from "../types/enum/Item"
import { Pkm } from "../types/enum/Pokemon"
import { Synergy } from "../types/enum/Synergy"

// Structured form of an Elite Designer export (see buildExportString in
// app/public/src/pages/component/bot-builder/elite-designer.tsx). Only the fields
// needed to build a battle team are kept — rewards/act/stages are ignored here.
export interface ParsedEliteDesign {
  name: string
  board: { name: Pkm; x: number; y: number; items: Item[] }[]
  bonus: Record<string, number>
  icon?: Pkm
}

// Parse an Elite Designer export string into a structured design. Returns null on
// malformed input. Mirrors the compact-JSON shape produced by buildExportString:
// { name, act, stages, icon?, board:[[pkm,x,y]], items?:[[...]], bonus?:{...}, ... }
export function parseEliteDesignExport(str: string): ParsedEliteDesign | null {
  try {
    const obj = JSON.parse(str)
    if (!obj || !Array.isArray(obj.board)) return null
    const items: Item[][] = Array.isArray(obj.items) ? obj.items : []
    const board = obj.board
      .filter((e: unknown) => Array.isArray(e) && e[0])
      .map((entry: [Pkm, number, number], i: number) => ({
        name: entry[0],
        x: Number(entry[1]),
        y: Number(entry[2]),
        items: Array.isArray(items[i]) ? items[i] : []
      }))
    return {
      name: typeof obj.name === "string" ? obj.name : "Custom Elite",
      board,
      bonus:
        obj.bonus && typeof obj.bonus === "object"
          ? (obj.bonus as Record<string, number>)
          : {},
      icon: typeof obj.icon === "string" ? (obj.icon as Pkm) : undefined
    }
  } catch {
    return null
  }
}

// Replaces a player's board with the team described by an Elite Design and applies
// the design's configured bonus stats (team-wide to every unit, main-only to the
// icon/first unit), then recomputes synergies + effects directly — bypassing
// player.updateSynergies(), whose side effects (scarves, artificial items, TMs,
// wands...) would corrupt the reused player. Same hygiene as reconstructTeamAsPlayer.
export function applyEliteDesignToPlayer(
  player: Player,
  design: ParsedEliteDesign,
  _state: GameState
): void {
  player.board.forEach((_p, key) => player.board.delete(key))

  const created: {
    pkm: ReturnType<typeof PokemonFactory.createPokemonFromName>
    entry: ParsedEliteDesign["board"][number]
  }[] = []
  for (const entry of design.board) {
    if (entry.y <= 0) continue
    const pkm = PokemonFactory.createPokemonFromName(entry.name, {
      emotion: Emotion.NORMAL,
      shiny: false
    })
    pkm.positionX = entry.x
    pkm.positionY = entry.y
    for (const item of entry.items) {
      if (!pkm.items.has(item)) pkm.items.add(item)
    }
    player.board.set(pkm.id, pkm)
    created.push({ pkm, entry })
  }

  // The "main" unit (gets the mainBonus* stats) is the icon Pokémon if it's on
  // the board, otherwise the first in board reading order (top row, left first) —
  // matching how the live elite encounter applies eliteMainBonus to board[0].
  const ordered = [...created].sort(
    (a, b) => a.entry.y - b.entry.y || a.entry.x - b.entry.x
  )
  const main =
    (design.icon
      ? ordered.find((c) => c.entry.name === design.icon)?.pkm
      : undefined) ?? ordered[0]?.pkm

  const b = design.bonus
  const num = (k: string) => Math.round(Number(b[k]) || 0)
  const teamHP = num("bonusHP")
  const teamAtk = num("bonusAtk")
  const teamDef = num("bonusDef")
  const teamSpeDef = num("bonusSpeDef")
  const teamAP = num("bonusAP")
  const teamPP = num("bonusPP")
  if (teamHP || teamAtk || teamDef || teamSpeDef || teamAP || teamPP) {
    player.board.forEach((pkm) => {
      if (pkm.positionY <= 0) return
      if (teamHP) pkm.addMaxHP(teamHP)
      if (teamAtk) pkm.addAttack(teamAtk)
      if (teamDef) pkm.addDefense(teamDef)
      if (teamSpeDef) pkm.addSpecialDefense(teamSpeDef)
      if (teamAP) pkm.addAbilityPower(teamAP)
      if (teamPP) pkm.maxPP = Math.min(255, pkm.maxPP + teamPP)
    })
  }
  if (main) {
    const mainHP = num("mainBonusHP")
    const mainAtk = num("mainBonusAtk")
    const mainAP = num("mainBonusAP")
    if (mainHP) main.addMaxHP(mainHP)
    if (mainAtk) main.addAttack(mainAtk)
    if (mainAP) main.addAbilityPower(mainAP)
  }

  // Recompute synergies (set every key, 0 for absent, to clear stale values from a
  // prior test) then effects (Effects.update() clears itself first).
  const counts = computeSynergies(Array.from(player.board.values()))
  Object.keys(Synergy).forEach((key) =>
    player.synergies.set(key as Synergy, counts.get(key as Synergy) ?? 0)
  )
  player.effects.update(player.synergies, player.board)
}
