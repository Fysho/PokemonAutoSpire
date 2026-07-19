import Simulation from "../core/simulation"
import Player from "../models/colyseus-models/player"
import { computeSynergies } from "../models/colyseus-models/synergies"
import PokemonFactory from "../models/pokemon-factory"
import type GameRoom from "../rooms/game-room"
import GameState from "../rooms/states/game-state"
import { Emotion, Role } from "../types"
import { Team } from "../types/enum/Game"
import type { Item } from "../types/enum/Item"
import type { Pkm } from "../types/enum/Pokemon"
import { Synergy } from "../types/enum/Synergy"
import { logger } from "../utils/logger"
import { getWeather } from "../utils/weather"
import {
  type AsyncFightOpponent,
  getAllAsyncOpponentsForStage
} from "./async-fight-pool"
import { reconstructTeamAsPlayer } from "./team-snapshot"

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

// ============================================================================
// Headless success-rate measurement
//
// Fights a design against recorded classic teams at Easy, Normal, Hard, and
// Impossible. Each difficulty runs exactly 100 fights against both milestone
// pools, for 200 fights per difficulty and 800 per full measurement. Underfilled
// nonempty pools are cycled deterministically; an empty pool makes the measure
// incomplete and no result is saved. Bosses use their act's floor 15 + 20 pools.
//
// Side-effect hygiene: the simulations are never added to state.simulations
// (nothing syncs to clients) and neither temp player gets a simulationId, so
// Simulation.onFinish treats both as ghosts and skips life damage / battle
// history / gold. room.broadcast is no-oped via a Proxy so ability/board-event
// chatter from ~200 fights never reaches the connected client.
// ============================================================================

const SIM_TICK_MS = 50
// Per-fight simulated-time cap; anything still standing on both sides is a draw.
// Mirrors the live fight duration (FIGHTING_PHASE_DURATION = 45s) with headroom.
const SIM_TIME_CAP_MS = 60000
export const FIGHTS_PER_MEASURE_POOL = 100
export const ELITE_MEASURE_DIFFICULTIES = [
  "easy",
  "normal",
  "hard",
  "impossible"
] as const
export type EliteMeasureDifficulty = (typeof ELITE_MEASURE_DIFFICULTIES)[number]

export interface EliteMeasureResult {
  difficulty: EliteMeasureDifficulty
  stage: string
  wins: number
  draws: number
  losses: number
  sampleSize: number
}

// Produces the exact 100-opponent schedule for one milestone pool. FIFO pools
// normally hold 100 distinct recordings; while a new pool fills, cycling keeps
// the requested sample size stable without changing which teams are represented.
export function buildMeasurementPoolSchedule<T>(opponents: readonly T[]): T[] {
  if (opponents.length === 0) return []
  return Array.from(
    { length: FIGHTS_PER_MEASURE_POOL },
    (_, index) => opponents[index % opponents.length]
  )
}

// Maps an elite design's act + stage range to the milestone pools that bracket
// it. Boss designs use "boss" and always face floor 15 + floor 20 of their act.
// Classic recordings add the `classic-<difficulty>-` prefix at query time.
export function bracketStagesForDesign(
  act: number,
  stageRange: string
): string[] {
  if (stageRange === "boss") {
    return [`act${act}-floor15`, `act${act}-floor20`]
  }
  const m = stageRange.match(/^(\d+)-(\d+)$/)
  if (!m) return []
  const lo = parseInt(m[1])
  const hi = parseInt(m[2])
  const stages: string[] = []
  if (lo <= 5) {
    if (act > 1) stages.push(`act${act - 1}-floor20`)
  } else {
    stages.push(`act${act}-floor${lo - 1}`)
  }
  stages.push(`act${act}-floor${hi}`)
  return stages
}

// Builds a temporary blue-team bot Player carrying the design's board. Fresh per
// fight so beforeSimulationStart hooks can't accumulate state across fights.
function buildDesignPlayer(
  design: ParsedEliteDesign,
  state: GameState
): Player {
  const player = new Player(
    `elite-design-${crypto.randomUUID()}`,
    design.name,
    1200,
    0,
    "0019/Normal",
    true,
    1,
    new Map(),
    "",
    Role.BOT,
    state
  )
  player.team = Team.BLUE_TEAM
  applyEliteDesignToPlayer(player, design, state)
  return player
}

// Runs one headless fight: design (blue) vs a recorded player team (red).
//
// CLOCK GOTCHA: abilities/synergies/passives schedule delayed effects on
// `simulation.room.clock` (e.g. the FIELD on-death heal, synergies.ts). A
// headless fight completes in ~0 real time, so timers placed on the REAL room
// clock would (a) never fire during the fight and (b) fire LATER on the live
// clock against a torn-down simulation — `delete pokemon.simulation` in
// sim.stop() made that a server-killing `undefined.weather` crash. So each
// fight gets its own virtual ClockTimer, served via the room Proxy and ticked
// in lockstep with sim.update(); leftovers are cleared in the finally.
function runHeadlessEliteFight(
  room: GameRoom,
  state: GameState,
  design: ParsedEliteDesign,
  opponent: AsyncFightOpponent
): "win" | "loss" | "draw" {
  const { ClockTimer } = require("@colyseus/timer")
  let virtualNow = 0
  const clock = new ClockTimer(false)
  clock.now = () => virtualNow
  clock.start(false) // re-anchor currentTime to virtual 0

  const silentRoom = new Proxy(room, {
    get(target, key) {
      if (key === "broadcast") return () => {}
      if (key === "clock") return clock
      return Reflect.get(target, key)
    }
  }) as GameRoom

  let sim: Simulation | null = null
  try {
    const blue = buildDesignPlayer(design, state)
    const red = reconstructTeamAsPlayer(opponent.snapshot, state)
    const weather = getWeather(blue, red, red.board)
    sim = new Simulation(
      crypto.randomUUID(),
      silentRoom,
      blue,
      red,
      state.stageLevel,
      weather,
      false
    )
    sim.start()

    let elapsed = 0
    while (!sim.finished && elapsed < SIM_TIME_CAP_MS) {
      sim.update(SIM_TICK_MS)
      elapsed += SIM_TICK_MS
      virtualNow = elapsed
      clock.tick()
    }
    // update() only finishes at the START of a tick, so a kill landing exactly on
    // the final tick before the cap needs one more check to register.
    if (!sim.finished && (sim.blueTeam.size === 0 || sim.redTeam.size === 0)) {
      sim.onFinish()
    }

    return sim.winnerId === blue.id
      ? "win"
      : sim.winnerId === red.id
        ? "loss"
        : "draw"
  } finally {
    // Drop any still-pending delayed effects BEFORE tearing the sim down, so
    // nothing can fire against deleted references — then stop the sim.
    clock.clear()
    clock.stop()
    try {
      sim?.stop()
    } catch {
      // teardown errors must not mask the fight outcome
    }
  }
}

// One measurement at a time server-wide (CPU latch for the 2-vCPU droplet).
let measureRunning = false
export function isEliteMeasureRunning(): boolean {
  return measureRunning
}

// A stand-in GameRoom for measurements triggered outside a live room (the REST
// path — see elite-measure.ts). The ELITE_TEST room never runs startGame, so
// its state is a virgin GameState parked in an idle PICK phase; this recreates
// exactly that environment without Colyseus. The stub surface is the complete
// set of `room.*` accesses reachable from a Simulation (audited via grep over
// app/core): state.{time,shop,players,stageLevel,specialGameRule,townEncounter,
// mapNodes,currentNodeId} — all served by the real GameState — plus broadcast /
// clock (both overridden per fight by the runHeadlessEliteFight Proxy anyway),
// clients, and 4 no-op methods. If a future ability touches a NEW room member,
// add it here (a real room isn't behind the Proxy on this path to catch it).
export function createHeadlessMeasureRoom(): GameRoom {
  const { GameMode, GamePhaseState } = require("../types/enum/Game")
  const { ClockTimer } = require("@colyseus/timer")
  const state = new GameState(
    "elite-measure",
    "EliteMeasure",
    true,
    GameMode.CUSTOM_LOBBY,
    null,
    null,
    null
  )
  // Mirror startEliteTestMode()'s idle PICK phase so fights behave identically
  // whether measured from a test room or via REST.
  state.phase = GamePhaseState.PICK
  state.time = 999 * 1000
  state.roundTime = 999
  const stub = {
    state,
    clients: [] as unknown[],
    broadcast: () => {},
    clock: new ClockTimer(false),
    computeRoundDamage: () => 0,
    rankPlayers: () => {},
    spawnOnBench: () => {},
    checkEvolutionsAfterPokemonAcquired: () => {},
    checkEvolutionsAfterItemAcquired: () => {}
  }
  return stub as unknown as GameRoom
}

// Measures a design against its classic difficulty milestone pools. Yields to
// the event loop between fights so room ticks/IO never starve. Returns one
// result per difficulty + bracket stage (sampleSize 0 means no recorded teams).
//
// opts.shouldAbort — checked between fights; return true to stop the batch
//   (partial results discarded, nothing saved). The room path passes "room is
//   empty"; the REST path passes its cancel flag. Default: never abort.
// opts.poolCache — shared across a bulk run so designs in the same bracket
//   don't re-fetch the same pools (see measure-all in elite-measure.ts).
// opts.skipLatch — the caller already holds the measureRunning latch for a
//   whole batch (measure-all); skip the per-design acquire/release.
export async function measureEliteDesign(
  room: GameRoom,
  designJson: string,
  act: number,
  stageRange: string,
  onProgress?: (done: number, total: number) => void,
  opts?: {
    shouldAbort?: () => boolean
    poolCache?: Map<string, AsyncFightOpponent[]>
    skipLatch?: boolean
  }
): Promise<EliteMeasureResult[] | { error: string }> {
  if (!opts?.skipLatch && measureRunning) return { error: "busy" }
  const design = parseEliteDesignExport(designJson)
  if (!design || design.board.length === 0) return { error: "empty_design" }
  const stages = bracketStagesForDesign(act, stageRange)
  if (stages.length === 0) return { error: "bad_stage" }
  const shouldAbort = opts?.shouldAbort ?? (() => false)

  if (!opts?.skipLatch) measureRunning = true
  try {
    const pools: {
      difficulty: EliteMeasureDifficulty
      stage: string
      opponents: AsyncFightOpponent[]
    }[] = []
    for (const difficulty of ELITE_MEASURE_DIFFICULTIES) {
      for (const stage of stages) {
        const poolKey = `classic-${difficulty}-${stage}`
        let opponents = opts?.poolCache?.get(poolKey)
        if (!opponents) {
          opponents = await getAllAsyncOpponentsForStage(poolKey)
          opts?.poolCache?.set(poolKey, opponents)
        }
        pools.push({ difficulty, stage, opponents })
      }
    }
    if (pools.some((pool) => pool.opponents.length === 0)) {
      return { error: "insufficient_data" }
    }
    const total = pools.length * FIGHTS_PER_MEASURE_POOL
    let done = 0
    const results: EliteMeasureResult[] = []
    for (const pool of pools) {
      const r: EliteMeasureResult = {
        difficulty: pool.difficulty,
        stage: pool.stage,
        wins: 0,
        draws: 0,
        losses: 0,
        sampleSize: 0
      }
      const schedule = buildMeasurementPoolSchedule(pool.opponents)
      for (const opponent of schedule) {
        // Caller-defined abort (room emptied / REST cancel) — stop the batch;
        // partial results are discarded (nothing saved on abort).
        if (shouldAbort()) return { error: "aborted" }
        try {
          const outcome = runHeadlessEliteFight(
            room,
            room.state,
            design,
            opponent
          )
          if (outcome === "win") r.wins++
          else if (outcome === "loss") r.losses++
          else r.draws++
          r.sampleSize++
        } catch (e) {
          logger.error("elite measure fight error", e)
        }
        done++
        if (done % 5 === 0 || done === total) onProgress?.(done, total)
        // Yield between fights — keeps the room update loop and IO responsive.
        await new Promise<void>((resolve) => setImmediate(resolve))
      }
      if (r.sampleSize !== FIGHTS_PER_MEASURE_POOL) {
        return { error: "simulation_error" }
      }
      results.push(r)
    }
    return results
  } finally {
    if (!opts?.skipLatch) measureRunning = false
  }
}

// Batch-latch helpers for measure-all (elite-measure.ts): hold the server-wide
// latch across a whole bulk run, with measureEliteDesign called skipLatch.
export function acquireEliteMeasureLatch(): boolean {
  if (measureRunning) return false
  measureRunning = true
  return true
}
export function releaseEliteMeasureLatch(): void {
  measureRunning = false
}
