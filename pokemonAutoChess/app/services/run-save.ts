import type { ArraySchema, MapSchema } from "@colyseus/schema"
import { MapEdge, MapNode } from "../models/colyseus-models/map-node"
import type Player from "../models/colyseus-models/player"
import {
  PlayerChoice,
  type PlayerChoiceType
} from "../models/colyseus-models/player-choice"
import type { Pokemon } from "../models/colyseus-models/pokemon"
import { computeSynergies } from "../models/colyseus-models/synergies"
import { RunHistory } from "../models/mongo-models/run-history"
import { type ISavedRun, SavedRun } from "../models/mongo-models/saved-run"
import UserMetadata from "../models/mongo-models/user-metadata"
import PokemonFactory from "../models/pokemon-factory"
import GameState, {
  type PendingRunEncounter,
  type PersistedShopItem
} from "../rooms/states/game-state"
import { Emotion } from "../types"
import type { Ability } from "../types/enum/Ability"
import { GamePhaseState } from "../types/enum/Game"
import type { Item } from "../types/enum/Item"
import { type Pkm, PkmIndex } from "../types/enum/Pokemon"
import type { Synergy } from "../types/enum/Synergy"
import { getAvatarString } from "../utils/avatar"
import { logger } from "../utils/logger"
import type { SpireEliteDesignData } from "./elite-design"
import {
  type PokemonStatBoosts,
  SnapshotPokemon,
  snapshotPlayerTeam,
  type TeamSnapshot
} from "./team-snapshot"

interface SerializedMapNode {
  id: string
  nodeType: string
  x: number
  y: number
  act: number
  floor: number
  visited: boolean
  available: boolean
  encounterKey: string
  region: string
  gymLeaderIndex: number
  gymLeaderIsEarly: boolean
  gymLeaderSynergy: string
  eliteEncounterIndex: number
  eliteAvatar: string
  bossSprites: string
  displayName: string
}

interface SerializedFlowerPot {
  name: string
  positionX: number
  positionY: number
  shiny: boolean
  emotion: string
  // Flower-pot mons live in player.flowerPots, NOT player.board, so they bypass
  // snapshotPlayerTeam entirely. Persist their permanent stat boosts the same way
  // the board snapshot does (e.g. Amaze Mulch's +50 HP / +30 AP) — without this the
  // boost is silently dropped on resume because the pot is rebuilt from name alone.
  statBoosts?: PokemonStatBoosts
}

export interface SavedRunData {
  // Game state
  runId: string
  currentAct: number
  currentFloor: number
  difficultyMode: number
  isEndless: boolean
  isSpire?: boolean
  spireClass?: string
  runHP: number
  stageLevel: number
  eliteFourAvailable: boolean
  runComplete: boolean
  championChallenged?: boolean
  arceusChallenged?: boolean
  gameSpeed: number
  challengeItem: string
  gameLightX: number
  gameLightY: number

  // Map
  mapNodes: SerializedMapNode[]
  mapEdges: { from: string; to: string }[]
  currentNodeId: string
  pendingFightNodeId: string
  // Deterministic run progression and exact pending materializations.
  runRngSeed?: number
  runRngCounter?: number
  pendingEncounter?: PendingRunEncounter | null
  eliteDesignAssignments?: [string, SpireEliteDesignData][]
  spireShopItems?: PersistedShopItem[]
  postBattleEffectsNodeId?: string
  spireEventResolved?: boolean
  spireEventName?: string
  spireEventDescription?: string
  spireEventPortrait?: string
  spireEventChoiceLabels?: string[]
  spireEventChoiceDescs?: string[]

  // Player team (full snapshot with bench)
  team: TeamSnapshot

  // Player economy
  money: number
  level: number
  experience: number

  // Player persistent state
  berryTreesType: string[]
  berryTreesStages: number[]
  flowerPots: SerializedFlowerPot[]
  mulch: number
  mulchCap: number
  artificialItems: string[]
  buriedItems: (string | null)[]
  tms: string[]
  weatherRocks: string[]
  bonusSynergies: [string, number][]
  eggChance: number
  goldenEggChance: number
  cellBattery: number
  titles: string[]
  regionalPokemons: string[]
  commonRegionalPool: string[]
  uncommonRegionalPool: string[]
  rareRegionalPool: string[]
  epicRegionalPool: string[]
  ultraRegionalPool: string[]
  pokemonsPlayed: string[]
  randomComponentsGiven: string[]
  randomEggsGiven: string[]
  flowerPotsSpawnOrder: string[]
  firstPartner: string | null
  dojoFamilies: string[]
  scarvesItems: string[]
  fairyWands: string[]
  regions: string[]
  shopsSinceLastUnownShop: number
  choices?: {
    type: string
    pokemons: string[]
    items: string[]
    value?: number
  }[]
  phase?: number
}

function serializeMapNodes(nodes: MapSchema<MapNode>): SerializedMapNode[] {
  const result: SerializedMapNode[] = []
  nodes.forEach((node) => {
    result.push({
      id: node.id,
      nodeType: node.nodeType,
      x: node.x,
      y: node.y,
      act: node.act,
      floor: node.floor,
      visited: node.visited,
      available: node.available,
      encounterKey: node.encounterKey,
      region: node.region,
      gymLeaderIndex: node.gymLeaderIndex,
      gymLeaderIsEarly: node.gymLeaderIsEarly,
      gymLeaderSynergy: node.gymLeaderSynergy,
      eliteEncounterIndex: node.eliteEncounterIndex,
      eliteAvatar: node.eliteAvatar,
      bossSprites: node.bossSprites,
      displayName: node.displayName
    })
  })
  return result
}

function serializeMapEdges(
  edges: ArraySchema<MapEdge>
): { from: string; to: string }[] {
  return Array.from(edges).map((e) => ({ from: e.from, to: e.to }))
}

function serializeFlowerPots(pots: Pokemon[]): SerializedFlowerPot[] {
  return pots
    .filter((p) => p && p.name)
    .map((p) => {
      const baseline = PokemonFactory.createPokemonFromName(p.name as Pkm)
      const boosts: PokemonStatBoosts = {
        hp: p.hp - baseline.hp,
        atk: p.atk - baseline.atk,
        def: p.def - baseline.def,
        speDef: p.speDef - baseline.speDef,
        ap: p.ap - baseline.ap,
        speed: p.speed - baseline.speed,
        luck: p.luck - baseline.luck
      }
      const hasBoosts =
        boosts.hp ||
        boosts.atk ||
        boosts.def ||
        boosts.speDef ||
        boosts.ap ||
        boosts.speed ||
        boosts.luck
      const serialized: SerializedFlowerPot = {
        name: p.name,
        positionX: p.positionX,
        positionY: p.positionY,
        shiny: p.shiny,
        emotion: p.emotion
      }
      if (hasBoosts) serialized.statBoosts = boosts
      return serialized
    })
}

// Per-player serialized save queues. Saves are dispatched fire-and-forget from
// the game loop; chaining each player's writes guarantees they apply in dispatch
// order so a slow/older write can never resolve last and clobber newer progress.
const saveQueues = new Map<string, Promise<unknown>>()
// Consecutive save-failure count per player. Any non-zero value means the run is
// silently frozen in the DB and WILL rewind on resume — surfaced loudly in logs.
const saveFailureStreak = new Map<string, number>()

function recordSaveFailure(odToken: string): number {
  const streak = (saveFailureStreak.get(odToken) ?? 0) + 1
  saveFailureStreak.set(odToken, streak)
  return streak
}

// Await any in-flight/queued saves for this player to settle. Called before a
// resume reads the DB so loadRun can't pick up a stale doc while a newer save is
// still draining through the queue (the "resume one floor behind" race).
export async function flushSaves(odToken: string): Promise<void> {
  const pending = saveQueues.get(odToken)
  if (pending) {
    try {
      await pending
    } catch {
      /* individual save errors are already logged inside saveRun */
    }
  }
}

export function saveRun(
  odToken: string,
  state: GameState,
  player: Player
): Promise<void> {
  // Guests can't save/resume, and they ALL share odToken "local-player" — saving
  // them collides every guest's run onto one shared document (the "saves swapped"
  // / SAVE WENT BACKWARD reports). Skip them entirely. (Mirrors saveRunHistory.)
  if (odToken === "local-player") return Promise.resolve()

  // 1) Build the payload SYNCHRONOUSLY so the queued write captures the run state
  //    at call time, not whenever the DB write later runs. Serialization (esp.
  //    snapshotPlayerTeam) is the most likely thing to throw — a failure here
  //    silently froze the save before, so it's now logged loudly.
  const expectedAct = state.currentAct
  const expectedFloor = state.currentFloor
  let update: Record<string, unknown>
  try {
    const team = snapshotPlayerTeam(player, { includeBench: true })

    const data: SavedRunData = {
      runId: state.runId,
      currentAct: state.currentAct,
      currentFloor: state.currentFloor,
      difficultyMode: state.difficultyMode,
      isEndless: state.isEndless,
      isSpire: state.isSpire,
      spireClass: state.spireClass,
      runHP: state.runHP,
      stageLevel: state.stageLevel,
      eliteFourAvailable: state.eliteFourAvailable,
      runComplete: state.runComplete,
      championChallenged: state.championChallenged,
      arceusChallenged: state.arceusChallenged,
      gameSpeed: state.gameSpeed,
      challengeItem: state.challengeItem,
      gameLightX: state.lightX,
      gameLightY: state.lightY,

      mapNodes: serializeMapNodes(state.mapNodes),
      mapEdges: serializeMapEdges(state.mapEdges),
      currentNodeId: state.currentNodeId,
      pendingFightNodeId: state.pendingFightNodeId,
      runRngSeed: state.runRngSeed,
      runRngCounter: state.runRngCounter,
      pendingEncounter: state.pendingEncounter,
      eliteDesignAssignments: Array.from(
        state.eliteDesignAssignments.entries()
      ),
      spireShopItems: state.spireShopItems,
      postBattleEffectsNodeId: state.postBattleEffectsNodeId,
      spireEventResolved: state.spireEventResolved,
      spireEventName: state.spireEventName,
      spireEventDescription: state.spireEventDescription,
      spireEventPortrait: state.spireEventPortrait,
      spireEventChoiceLabels: [...state.spireEventChoiceLabels],
      spireEventChoiceDescs: [...state.spireEventChoiceDescs],

      team,

      money: player.money,
      level: player.experienceManager.level,
      experience: player.experienceManager.experience,

      berryTreesType: [...player.berryTreesType] as string[],
      berryTreesStages: [...player.berryTreesStages],
      flowerPots: serializeFlowerPots(player.flowerPots),
      mulch: player.mulch,
      mulchCap: player.mulchCap,
      artificialItems: [...player.artificialItems] as string[],
      buriedItems: player.buriedItems.map((i) => (i as string) ?? null),
      tms: [...player.tms] as string[],
      weatherRocks: [...player.weatherRocks] as string[],
      bonusSynergies: Array.from(player.bonusSynergies.entries()) as [
        string,
        number
      ][],
      eggChance: player.eggChance,
      goldenEggChance: player.goldenEggChance,
      cellBattery: player.cellBattery,
      titles: Array.from(player.titles) as string[],
      regionalPokemons: [...player.regionalPokemons] as string[],
      commonRegionalPool: [...player.commonRegionalPool] as string[],
      uncommonRegionalPool: [...player.uncommonRegionalPool] as string[],
      rareRegionalPool: [...player.rareRegionalPool] as string[],
      epicRegionalPool: [...player.epicRegionalPool] as string[],
      ultraRegionalPool: [...player.ultraRegionalPool] as string[],
      pokemonsPlayed: Array.from(player.pokemonsPlayed) as string[],
      randomComponentsGiven: [...player.randomComponentsGiven] as string[],
      randomEggsGiven: [...player.randomEggsGiven] as string[],
      flowerPotsSpawnOrder: [...player.flowerPotsSpawnOrder] as string[],
      firstPartner: (player.firstPartner as string) ?? null,
      dojoFamilies: [...player.dojoFamilies] as string[],
      scarvesItems: [...player.scarvesItems] as string[],
      fairyWands: [...player.fairyWands] as string[],
      regions: [...player.regions] as string[],
      shopsSinceLastUnownShop: player.shopsSinceLastUnownShop,
      choices:
        player.choices.length > 0
          ? Array.from(player.choices).map((c) => ({
              type: c.type,
              pokemons: [...c.pokemons] as string[],
              items: [...c.items] as string[],
              value: c.value
            }))
          : undefined,
      phase: state.phase
    }

    const teamPreview = team.pokemon.filter((p) => p.y > 0).map((p) => p.name)

    update = {
      odToken,
      savedAt: new Date(),
      runId: state.runId,
      currentAct: state.currentAct,
      currentFloor: state.currentFloor,
      difficultyMode: state.difficultyMode,
      isEndless: state.isEndless,
      isSpire: state.isSpire,
      spireClass: state.spireClass,
      runHP: state.runHP,
      teamPreview,
      data
    }
  } catch (e) {
    const streak = recordSaveFailure(odToken)
    logger.error(
      `🛑 RUN SAVE FAILED (serialize) — ${player.name} [${odToken}] act ${expectedAct} floor ${expectedFloor}; run is FROZEN and will rewind on resume (consecutive failures: ${streak})`,
      e
    )
    return Promise.resolve()
  }

  // 2) Chain the DB write after any in-flight save for this player so concurrent
  //    fire-and-forget saves apply strictly in dispatch order (no out-of-order
  //    clobber). `returnDocument: "before"` hands us the run we're overwriting so
  //    we can detect lost progress.
  const prev = saveQueues.get(odToken) ?? Promise.resolve()
  const task = prev
    .catch(() => {})
    .then(async () => {
      try {
        // Read the run we're about to overwrite first (queue serializes saves for
        // this player, so no other save races between this read and the write).
        const before = (await SavedRun.findOne({
          odToken
        }).lean()) as ISavedRun | null

        // 3) Run-fenced monotonic guard. A run's (act, floor) only ever moves
        //    forward, so a backward write is a regression. But only block it when it
        //    belongs to the SAME run (matching runId) — that's a lingering/abandoned
        //    room saving late, and rewinding the live run would lose progress. A
        //    DIFFERENT run writing backward is a legitimate takeover (e.g. the player
        //    started a new run, or the newest session won) and must overwrite.
        const sameRun = !!(
          before &&
          before.runId &&
          state.runId &&
          before.runId === state.runId
        )
        const regressing = !!(
          before &&
          (before.currentAct > expectedAct ||
            (before.currentAct === expectedAct &&
              before.currentFloor > expectedFloor))
        )
        if (regressing && sameRun) {
          logger.error(
            `⛔ SAVE BLOCKED (stale write) — ${player.name} [${odToken}]: same run, keeping stored act ${before!.currentAct} floor ${before!.currentFloor}, refused stale act ${expectedAct} floor ${expectedFloor} (abandoned room saving late).`
          )
          return
        }
        if (regressing && !sameRun) {
          logger.info(
            `↪️ NEW RUN OVERWRITE — ${player.name} [${odToken}]: replacing stored act ${before!.currentAct} floor ${before!.currentFloor} with a different run at act ${expectedAct} floor ${expectedFloor}.`
          )
        }

        await SavedRun.findOneAndUpdate({ odToken }, update, { upsert: true })
        saveFailureStreak.set(odToken, 0)

        // Dropped-save detection (same run only): overwriting a save 2+ floors behind
        // means earlier saves were lost — the "resume rewound me N nodes" symptom.
        if (sameRun && before!.currentAct === expectedAct) {
          const gap = expectedFloor - before!.currentFloor
          if (gap >= 2) {
            logger.error(
              `⚠️ SAVE GAP — ${player.name} [${odToken}]: stored save was act ${before!.currentAct} floor ${before!.currentFloor} but now saving act ${expectedAct} floor ${expectedFloor} (skipped ${gap} floors). Earlier saves were LOST — resume would have rewound ${gap} floors.`
            )
          }
        }

        // Streak integrity: a DIFFERENT run (different runId) overwriting an existing
        // saved run means that old run is being abandoned — a new run was started over
        // it (or a newer session won) — WITHOUT it ever formally ending. Loss-on-abandon
        // was otherwise only enforced by the client calling DELETE /api/saved-run, so a
        // player could keep a victory streak alive forever by starting a fresh run on top
        // of a losing one (this upsert silently clobbers it, no loss recorded). Record the
        // loss here, server-side, so the streak resets no matter how the old run was
        // discarded. Runs that already reached a victory (Act-3 boss beaten — counted once
        // at boss fall) are skipped: don't double-count the win, don't mislabel it a loss.
        // Endless/guests are no-ops inside updateVictoryRecord; recordLoss just zeroes the
        // streak, so a benign race with a normal run-end delete is idempotent/harmless.
        const overwritingDifferentRun = !!(
          before &&
          before.runId &&
          state.runId &&
          before.runId !== state.runId
        )
        if (
          overwritingDifferentRun &&
          before!.data &&
          !isRunVictory(before!.data as SavedRunData)
        ) {
          try {
            await saveRunHistoryFromSavedRun(
              odToken,
              before!.data as SavedRunData
            )
            await updateVictoryRecord(
              odToken,
              player.name,
              player.avatar,
              before!.difficultyMode,
              false,
              before!.isEndless ?? false
            )
            logger.info(
              `↪️ ABANDON LOSS — ${player.name} [${odToken}]: recorded a loss for run ${before!.runId} discarded by a new run (streak reset).`
            )
          } catch (lossErr) {
            logger.error(
              `Failed to record loss for overwritten run — ${player.name} [${odToken}]`,
              lossErr
            )
          }
        }
      } catch (e) {
        const streak = recordSaveFailure(odToken)
        logger.error(
          `🛑 RUN SAVE FAILED (db write) — ${player.name} [${odToken}] act ${expectedAct} floor ${expectedFloor}; run is FROZEN and will rewind on resume (consecutive failures: ${streak})`,
          e
        )
      }
    })
    .finally(() => {
      // Drop the queue entry once this is the tail, to bound memory growth.
      if (saveQueues.get(odToken) === task) {
        saveQueues.delete(odToken)
        if ((saveFailureStreak.get(odToken) ?? 0) === 0)
          saveFailureStreak.delete(odToken)
      }
    })
  saveQueues.set(odToken, task)
  return task as Promise<void>
}

export async function loadRun(odToken: string): Promise<ISavedRun | null> {
  try {
    return await SavedRun.findOne({ odToken }).lean()
  } catch (e) {
    logger.error("Failed to load run:", e)
    return null
  }
}

export async function deleteSavedRun(odToken: string): Promise<boolean> {
  try {
    const result = await SavedRun.deleteOne({ odToken })
    return result.deletedCount > 0
  } catch (e) {
    logger.error("Failed to delete saved run:", e)
    return false
  }
}

export async function getSavedRunSummary(odToken: string) {
  try {
    return await SavedRun.findOne({ odToken })
      .select(
        "odToken savedAt currentAct currentFloor difficultyMode isEndless runHP teamPreview"
      )
      .lean()
  } catch (e) {
    logger.error("Failed to get saved run summary:", e)
    return null
  }
}

export function restoreRunToState(
  state: GameState,
  player: Player,
  savedData: SavedRunData
) {
  // Restore game state. Keep the run's identity so a resumed run is recognised as
  // the SAME run by the save fence (legacy saves without one get a fresh id).
  state.runId = savedData.runId || crypto.randomUUID()
  state.currentAct = savedData.currentAct
  state.currentFloor = savedData.currentFloor
  state.difficultyMode = savedData.difficultyMode
  state.isEndless = savedData.isEndless ?? false
  state.isSpire = savedData.isSpire ?? false
  state.spireClass = savedData.spireClass ?? ""
  state.runHP = savedData.runHP
  state.stageLevel = savedData.stageLevel
  state.eliteFourAvailable = savedData.eliteFourAvailable
  state.runComplete = savedData.runComplete ?? false
  state.championChallenged = savedData.championChallenged ?? false
  state.arceusChallenged = savedData.arceusChallenged ?? false
  state.gameSpeed = savedData.gameSpeed
  state.challengeItem = savedData.challengeItem
  state.lightX = savedData.gameLightX
  state.lightY = savedData.gameLightY
  state.currentNodeId = savedData.currentNodeId
  state.pendingFightNodeId = savedData.pendingFightNodeId ?? ""
  if (savedData.runRngSeed === undefined) {
    // Legacy saves begin a deterministic stream from their existing run id.
    state.initializeRunRng()
  } else {
    state.runRngSeed = savedData.runRngSeed >>> 0
    state.runRngCounter = (savedData.runRngCounter ?? 0) >>> 0
  }
  state.pendingEncounter = savedData.pendingEncounter ?? null
  state.eliteDesignAssignments.clear()
  for (const [nodeId, design] of savedData.eliteDesignAssignments ?? []) {
    state.eliteDesignAssignments.set(nodeId, design)
  }
  state.spireShopItems = savedData.spireShopItems ?? []
  state.postBattleEffectsNodeId = savedData.postBattleEffectsNodeId ?? ""
  state.spireEventResolved = savedData.spireEventResolved ?? false
  state.spireEventName = savedData.spireEventName ?? ""
  state.spireEventDescription = savedData.spireEventDescription ?? ""
  state.spireEventPortrait = savedData.spireEventPortrait ?? ""
  state.spireEventChoiceLabels.clear()
  state.spireEventChoiceLabels.push(...(savedData.spireEventChoiceLabels ?? []))
  state.spireEventChoiceDescs.clear()
  state.spireEventChoiceDescs.push(...(savedData.spireEventChoiceDescs ?? []))

  // Restore map
  state.mapNodes.clear()
  for (const n of savedData.mapNodes) {
    const node = new MapNode(
      n.id,
      n.nodeType as any,
      n.x,
      n.y,
      n.act,
      n.floor,
      n.encounterKey,
      n.region
    )
    node.visited = n.visited
    node.available = n.available
    node.gymLeaderIndex = n.gymLeaderIndex
    node.gymLeaderIsEarly = n.gymLeaderIsEarly
    node.gymLeaderSynergy = n.gymLeaderSynergy
    node.eliteEncounterIndex = n.eliteEncounterIndex
    node.eliteAvatar = n.eliteAvatar
    node.bossSprites = n.bossSprites
    node.displayName = n.displayName
    state.mapNodes.set(n.id, node)
  }

  state.mapEdges.clear()
  for (const e of savedData.mapEdges) {
    state.mapEdges.push(new MapEdge(e.from, e.to))
  }

  // Restore player team
  player.board.forEach((_pkm, key) => player.board.delete(key))
  const team = savedData.team
  for (const snap of team.pokemon) {
    const pkm = PokemonFactory.createPokemonFromName(snap.name as Pkm, {
      emotion: (snap.emotion as Emotion) ?? Emotion.NORMAL,
      shiny: !!snap.shiny
    })
    pkm.positionX = snap.x
    pkm.positionY = snap.y

    if (snap.items) {
      for (const item of snap.items) {
        if (!pkm.items.has(item as Item)) {
          pkm.items.add(item as Item)
        }
      }
    }

    // Restore the ability. A TM takes precedence (re-applies the tm marker +
    // skill + 100 PP, like applying the TM); otherwise a non-TM skill change
    // (Skill Swap / Sketch) just sets the skill. Mirrors reconstructTeamAsPlayer.
    if (snap.tm) {
      pkm.tm = snap.tm as Ability
      pkm.skill = snap.tm as Ability
      pkm.maxPP = 100
    } else if (snap.skill) {
      pkm.skill = snap.skill as Ability
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
        pkm.dishes.add(dish as Item)
      }
    }

    if (snap.evolution) pkm.evolution = snap.evolution as Pkm
    if (snap.stacks) pkm.stacks = snap.stacks
    if (snap.stacksRequired) pkm.stacksRequired = snap.stacksRequired
    if (snap.deathCount) pkm.deathCount = snap.deathCount
    if (snap.originalMap)
      (pkm as { originalMap?: string }).originalMap = snap.originalMap

    player.board.set(pkm.id, pkm)
  }

  // Restore player inventory
  player.items.clear()
  for (const item of team.inventory) {
    player.items.push(item as Item)
  }

  // Restore ground holes and light
  for (
    let i = 0;
    i < team.groundHoles.length && i < player.groundHoles.length;
    i++
  ) {
    player.groundHoles[i] = team.groundHoles[i]
  }
  player.lightX = team.lightX
  player.lightY = team.lightY

  // Restore economy
  player.money = savedData.money
  player.experienceManager.level = savedData.level
  player.experienceManager.experience = savedData.experience
  const { ExpTable, ENDLESS_MAX_LEVEL } = require("../config")
  if (savedData.isSpire) {
    // Re-point to the Spire curve (runtime flag isn't part of the snapshot),
    // keeping the restored level.
    player.experienceManager.useSpireMode(false)
  } else {
    player.experienceManager.expNeeded = ExpTable[savedData.level] ?? 4
  }
  if (savedData.isEndless) {
    player.experienceManager.maxLevel = ENDLESS_MAX_LEVEL
  }

  // Restore life to match runHP
  player.life = savedData.runHP

  // Restore berry trees
  if (savedData.berryTreesType) {
    for (let i = 0; i < savedData.berryTreesType.length; i++) {
      player.berryTreesType[i] = savedData.berryTreesType[i] as Item
    }
  }
  if (savedData.berryTreesStages) {
    for (let i = 0; i < savedData.berryTreesStages.length; i++) {
      player.berryTreesStages[i] = savedData.berryTreesStages[i]
    }
  }

  // Restore flower pots
  if (savedData.flowerPots?.length) {
    for (
      let i = 0;
      i < savedData.flowerPots.length && i < player.flowerPots.length;
      i++
    ) {
      const fp = savedData.flowerPots[i]
      if (fp?.name) {
        const pot = PokemonFactory.createPokemonFromName(fp.name as Pkm, {
          shiny: fp.shiny,
          emotion: (fp.emotion as Emotion) ?? Emotion.NORMAL
        })
        pot.positionX = fp.positionX
        pot.positionY = fp.positionY
        if (fp.statBoosts) {
          const b = fp.statBoosts
          if (b.hp) pot.addMaxHP(b.hp)
          if (b.atk) pot.addAttack(b.atk)
          if (b.def) pot.addDefense(b.def)
          if (b.speDef) pot.addSpecialDefense(b.speDef)
          if (b.ap) pot.addAbilityPower(b.ap)
          if (b.speed) pot.addSpeed(b.speed)
          if (b.luck) pot.addLuck(b.luck)
        }
        player.flowerPots[i] = pot
      }
    }
  }

  player.mulch = savedData.mulch
  player.mulchCap = savedData.mulchCap

  // Restore miscellaneous player state
  player.artificialItems = (savedData.artificialItems ?? []) as Item[]
  player.buriedItems = (savedData.buriedItems ?? []).map(
    (i) => (i as Item) ?? null
  )
  player.tms = (savedData.tms ?? []) as Item[]
  player.weatherRocks = (savedData.weatherRocks ?? []) as Item[]
  player.eggChance = savedData.eggChance ?? 0
  player.goldenEggChance = savedData.goldenEggChance ?? 0
  player.cellBattery = savedData.cellBattery ?? 0
  player.shopsSinceLastUnownShop = savedData.shopsSinceLastUnownShop ?? 0
  player.firstPartner = (savedData.firstPartner as Pkm) ?? undefined
  player.regions = (savedData.regions ?? []) as any[]

  // Restore sets and maps
  player.bonusSynergies.clear()
  for (const [syn, count] of savedData.bonusSynergies ?? []) {
    player.bonusSynergies.set(syn as Synergy, count)
  }

  player.titles.clear()
  for (const t of savedData.titles ?? []) {
    player.titles.add(t as any)
  }

  player.pokemonsPlayed.clear()
  for (const p of savedData.pokemonsPlayed ?? []) {
    player.pokemonsPlayed.add(p as Pkm)
  }

  // Restore array schemas
  player.randomComponentsGiven = (savedData.randomComponentsGiven ??
    []) as Item[]
  player.randomEggsGiven = (savedData.randomEggsGiven ?? []) as Pkm[]
  player.flowerPotsSpawnOrder = (savedData.flowerPotsSpawnOrder ?? []) as any[]

  // Restore synced array schemas
  const resetArray = (arr: ArraySchema<any>, values: any[]) => {
    arr.clear()
    for (const v of values) arr.push(v)
  }
  resetArray(player.dojoFamilies, savedData.dojoFamilies ?? [])
  resetArray(player.scarvesItems, savedData.scarvesItems ?? [])
  resetArray(player.fairyWands, savedData.fairyWands ?? [])
  resetArray(player.regionalPokemons, savedData.regionalPokemons ?? [])

  // Restore regional pools
  player.commonRegionalPool = (savedData.commonRegionalPool ?? []) as Pkm[]
  player.uncommonRegionalPool = (savedData.uncommonRegionalPool ?? []) as Pkm[]
  player.rareRegionalPool = (savedData.rareRegionalPool ?? []) as Pkm[]
  player.epicRegionalPool = (savedData.epicRegionalPool ?? []) as Pkm[]
  player.ultraRegionalPool = (savedData.ultraRegionalPool ?? []) as Pkm[]

  // Compute synergies and effects directly, bypassing updateSynergies()
  // which has side effects (scarves, artificial items, TMs, wands, etc.)
  // that duplicate items already restored from the snapshot
  const synergyCounts = computeSynergies(
    Array.from(player.board.values()),
    player.bonusSynergies.size > 0 ? player.bonusSynergies : undefined
  )
  synergyCounts.forEach((value, synergy) => {
    player.synergies.set(synergy, value)
  })
  player.effects.update(player.synergies, player.board)

  // Restore pending reward choices
  if (savedData.choices?.length) {
    for (const c of savedData.choices) {
      player.choices.push(
        new PlayerChoice({
          type: c.type as PlayerChoiceType,
          pokemons: c.pokemons as any[],
          items: c.items as Item[],
          value: c.value
        })
      )
    }
    if (savedData.phase === GamePhaseState.REWARD) {
      state.phase = GamePhaseState.REWARD
    }
  }
}

export async function saveRunHistory(
  odToken: string,
  state: GameState,
  player: Player,
  victory: boolean
): Promise<void> {
  if (odToken === "local-player") return
  try {
    const pokemons: { name: string; avatar: string; items: string[] }[] = []
    player.board.forEach((pokemon) => {
      if (pokemon.positionY !== 0) {
        pokemons.push({
          name: pokemon.name,
          avatar: getAvatarString(
            PkmIndex[pokemon.name],
            pokemon.shiny,
            pokemon.emotion
          ),
          items: Array.from(pokemon.items.values())
        })
      }
    })
    // Capture the player's exact synergy counts at save time (includes gem
    // bonus synergies, type-changing stones, Dragon double-types, etc.)
    const synergies: { type: string; count: number }[] = []
    player.synergies.forEach((count, type) => {
      if (count > 0) synergies.push({ type, count })
    })
    const historyAct = state.currentAct >= 5 ? 4 : state.currentAct
    const historyFloor = state.currentAct >= 5 ? 5 : state.currentFloor
    const doc = {
      odToken,
      runId: state.runId,
      time: Date.now(),
      currentAct: historyAct,
      currentFloor: historyFloor,
      difficultyMode: state.difficultyMode,
      runHP: state.runHP,
      arceusDamageDealt: state.arceusDamageDealt,
      victory,
      pokemons,
      synergies
    }
    // One document per run: upsert by runId so the Act 3 → Elite Four → Champion →
    // Arceus milestones all UPDATE the same record (later milestones overwrite with
    // higher act/floor + final arceus damage) instead of appending duplicates. Falls
    // back to create() for the (impossible in practice) case of a run without an id.
    if (state.runId) {
      await RunHistory.updateOne(
        { runId: state.runId },
        { $set: doc },
        { upsert: true }
      )
    } else {
      await RunHistory.create(doc)
    }
    const result = victory ? "victory" : "defeat"
    const arceus =
      state.arceusDamageDealt > 0
        ? ` | arceus dmg: ${state.arceusDamageDealt}`
        : ""
    logger.info(
      `Run saved | ${player.name} | ${result} | act ${historyAct} floor ${historyFloor}${arceus}`
    )
  } catch (e) {
    logger.error("Failed to save run history:", e)
  }
}

export async function saveRunHistoryFromSavedRun(
  odToken: string,
  savedData: SavedRunData
): Promise<void> {
  if (odToken === "local-player") return
  try {
    const boardPokemon = savedData.team.pokemon.filter((p) => p.y > 0)
    const pokemons = boardPokemon.map((p) => ({
      name: p.name as string,
      avatar: getAvatarString(
        PkmIndex[p.name] ?? "",
        !!p.shiny,
        (p.emotion as Emotion) ?? Emotion.NORMAL
      ),
      items: (p.items ?? []) as string[]
    }))
    // Reconstruct synergy counts from the saved board + bonus synergies (gems)
    const bonusSynergies = new Map<Synergy, number>()
    for (const [syn, count] of savedData.bonusSynergies ?? []) {
      bonusSynergies.set(syn as Synergy, count)
    }
    const board = boardPokemon.map((p) => {
      const pkm = PokemonFactory.createPokemonFromName(p.name as Pkm)
      pkm.positionY = p.y
      ;(p.items ?? []).forEach((item) => pkm.items.add(item as Item))
      return pkm
    })
    const synergyCounts = computeSynergies(
      board,
      bonusSynergies.size > 0 ? bonusSynergies : undefined
    )
    const synergies: { type: string; count: number }[] = []
    synergyCounts.forEach((count, type) => {
      if (count > 0) synergies.push({ type, count })
    })
    const historyAct = savedData.currentAct >= 5 ? 4 : savedData.currentAct
    const historyFloor = savedData.currentAct >= 5 ? 5 : savedData.currentFloor
    const doc = {
      odToken,
      runId: savedData.runId,
      time: Date.now(),
      currentAct: historyAct,
      currentFloor: historyFloor,
      difficultyMode: savedData.difficultyMode,
      runHP: savedData.runHP,
      arceusDamageDealt: 0,
      victory: false,
      pokemons,
      synergies
    }
    // Same one-record-per-run upsert as saveRunHistory: an abandoned run shares the
    // runId of any earlier milestone record for that run, so abandoning never
    // creates a second row.
    if (savedData.runId) {
      await RunHistory.updateOne(
        { runId: savedData.runId },
        { $set: doc },
        { upsert: true }
      )
    } else {
      await RunHistory.create(doc)
    }
    logger.info(
      `Abandoned run history saved | ${savedData.team.name} | act ${historyAct} floor ${historyFloor}`
    )
  } catch (e) {
    logger.error("Failed to save abandoned run history:", e)
  }
}

export async function getRunHistory(
  odToken: string,
  page: number = 1,
  pageSize: number = 10
) {
  return RunHistory.find({ odToken })
    .sort({ time: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean()
}

const DIFF_KEY: Record<number, string> = {
  0: "easy",
  1: "normal",
  2: "hard",
  3: "impossible"
}

export async function incrementRunStarted(
  uid: string,
  difficultyMode: number
): Promise<void> {
  if (uid === "local-player") return
  const key = DIFF_KEY[difficultyMode] ?? "normal"
  try {
    await UserMetadata.updateOne(
      { uid },
      { $inc: { [`spireStats.${key}.runsStarted`]: 1 } },
      { upsert: false }
    )
  } catch (e) {
    logger.error("Failed to increment runsStarted:", e)
  }
}

// Tutorial completion flag on the player's profile. Set once when the tutorial
// boss is beaten; the lobby reads it to mark the Tutorial button done. Does not
// affect any stats/leaderboards.
export async function markTutorialCompleted(uid: string): Promise<void> {
  if (uid === "local-player") return
  try {
    await UserMetadata.updateOne(
      { uid },
      { $set: { tutorialCompleted: true } },
      { upsert: false }
    )
  } catch (e) {
    logger.error("Failed to mark tutorial completed:", e)
  }
}

export async function incrementRunEnd(
  uid: string,
  difficultyMode: number,
  victory: boolean,
  champion: boolean,
  arceusDamage: number
): Promise<void> {
  if (uid === "local-player") return
  const key = DIFF_KEY[difficultyMode] ?? "normal"
  const inc: Record<string, number> = {}
  if (victory) inc[`spireStats.${key}.wins`] = 1
  if (champion) inc[`spireStats.${key}.champion`] = 1
  if (arceusDamage > 0) inc[`spireStats.${key}.arceusDamage`] = arceusDamage
  if (Object.keys(inc).length === 0) return
  try {
    await UserMetadata.updateOne({ uid }, { $inc: inc }, { upsert: false })
  } catch (e) {
    logger.error("Failed to increment run end stats:", e)
  }
}

// A run counts as a victory the moment the act-3 boss is beaten. After that the
// player is in bonus content — Elite Four (act 4) or Arceus (act 5) — or sitting
// on the act-3 victory screen (currentAct 3 with runComplete set). Endless mode
// has no act-3 boss, so it never produces a victory.
export function isRunVictory(state: {
  currentAct: number
  runComplete: boolean
  isEndless: boolean
}): boolean {
  if (state.isEndless) return false
  return state.currentAct >= 4 || (state.currentAct === 3 && state.runComplete)
}

export async function updateVictoryRecord(
  uid: string,
  name: string,
  avatar: string,
  difficultyMode: number,
  won: boolean,
  isEndless: boolean
): Promise<void> {
  if (uid === "local-player" || isEndless) return
  const { recordVictory, recordLoss } = require("./victory-record")
  if (won) {
    await recordVictory(uid, name, avatar, difficultyMode)
  } else {
    await recordLoss(uid, name, avatar, difficultyMode)
  }
}
