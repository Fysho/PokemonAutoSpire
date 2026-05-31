import { ArraySchema, MapSchema } from "@colyseus/schema"
import Player from "../models/colyseus-models/player"
import { PlayerChoice, PlayerChoiceType } from "../models/colyseus-models/player-choice"
import { Pokemon } from "../models/colyseus-models/pokemon"
import { MapNode, MapEdge } from "../models/colyseus-models/map-node"
import { SavedRun, ISavedRun } from "../models/mongo-models/saved-run"
import { RunHistory } from "../models/mongo-models/run-history"
import UserMetadata from "../models/mongo-models/user-metadata"
import PokemonFactory from "../models/pokemon-factory"
import GameState from "../rooms/states/game-state"
import { snapshotPlayerTeam, SnapshotPokemon, TeamSnapshot } from "./team-snapshot"
import { Emotion } from "../types"
import { Ability } from "../types/enum/Ability"
import { GamePhaseState } from "../types/enum/Game"
import { Item } from "../types/enum/Item"
import { Pkm, PkmIndex } from "../types/enum/Pokemon"
import { Synergy } from "../types/enum/Synergy"
import { computeSynergies } from "../models/colyseus-models/synergies"
import { getAvatarString } from "../utils/avatar"
import { logger } from "../utils/logger"

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
}

interface SavedRunData {
  // Game state
  currentAct: number
  currentFloor: number
  difficultyMode: number
  isEndless: boolean
  runHP: number
  stageLevel: number
  eliteFourAvailable: boolean
  runComplete: boolean
  gameSpeed: number
  challengeItem: string
  gameLightX: number
  gameLightY: number

  // Map
  mapNodes: SerializedMapNode[]
  mapEdges: { from: string; to: string }[]
  currentNodeId: string

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
  choices?: { type: string; pokemons: string[]; items: string[] }[]
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

function serializeMapEdges(edges: ArraySchema<MapEdge>): { from: string; to: string }[] {
  return Array.from(edges).map((e) => ({ from: e.from, to: e.to }))
}

function serializeFlowerPots(pots: Pokemon[]): SerializedFlowerPot[] {
  return pots
    .filter((p) => p && p.name)
    .map((p) => ({
      name: p.name,
      positionX: p.positionX,
      positionY: p.positionY,
      shiny: p.shiny,
      emotion: p.emotion
    }))
}

export async function saveRun(odToken: string, state: GameState, player: Player): Promise<void> {
  try {
    const team = snapshotPlayerTeam(player, { includeBench: true })

    const data: SavedRunData = {
      currentAct: state.currentAct,
      currentFloor: state.currentFloor,
      difficultyMode: state.difficultyMode,
      isEndless: state.isEndless,
      runHP: state.runHP,
      stageLevel: state.stageLevel,
      eliteFourAvailable: state.eliteFourAvailable,
      runComplete: state.runComplete,
      gameSpeed: state.gameSpeed,
      challengeItem: state.challengeItem,
      gameLightX: state.lightX,
      gameLightY: state.lightY,

      mapNodes: serializeMapNodes(state.mapNodes),
      mapEdges: serializeMapEdges(state.mapEdges),
      currentNodeId: state.currentNodeId,

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
      bonusSynergies: Array.from(player.bonusSynergies.entries()) as [string, number][],
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
      choices: player.choices.length > 0
        ? Array.from(player.choices).map((c) => ({
            type: c.type,
            pokemons: [...c.pokemons] as string[],
            items: [...c.items] as string[]
          }))
        : undefined,
      phase: state.phase
    }

    const teamPreview = team.pokemon
      .filter((p) => p.y > 0)
      .map((p) => p.name)

    await SavedRun.findOneAndUpdate(
      { odToken },
      {
        odToken,
        savedAt: new Date(),
        currentAct: state.currentAct,
        currentFloor: state.currentFloor,
        difficultyMode: state.difficultyMode,
        isEndless: state.isEndless,
        runHP: state.runHP,
        teamPreview,
        data
      },
      { upsert: true, returnDocument: "after" }
    )
  } catch (e) {
    logger.error("Failed to save run:", e)
  }
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
      .select("odToken savedAt currentAct currentFloor difficultyMode isEndless runHP teamPreview")
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
  // Restore game state
  state.currentAct = savedData.currentAct
  state.currentFloor = savedData.currentFloor
  state.difficultyMode = savedData.difficultyMode
  state.isEndless = savedData.isEndless ?? false
  state.runHP = savedData.runHP
  state.stageLevel = savedData.stageLevel
  state.eliteFourAvailable = savedData.eliteFourAvailable
  state.runComplete = savedData.runComplete ?? false
  state.gameSpeed = savedData.gameSpeed
  state.challengeItem = savedData.challengeItem
  state.lightX = savedData.gameLightX
  state.lightY = savedData.gameLightY
  state.currentNodeId = savedData.currentNodeId

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

    if (snap.skill) {
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
    }

    if (snap.dishes) {
      for (const dish of snap.dishes) {
        pkm.dishes.add(dish as Item)
      }
    }

    if (snap.evolution) pkm.evolution = snap.evolution as Pkm
    if (snap.stacks) pkm.stacks = snap.stacks
    if (snap.stacksRequired) pkm.stacksRequired = snap.stacksRequired

    player.board.set(pkm.id, pkm)
  }

  // Restore player inventory
  player.items.clear()
  for (const item of team.inventory) {
    player.items.push(item as Item)
  }

  // Restore ground holes and light
  for (let i = 0; i < team.groundHoles.length && i < player.groundHoles.length; i++) {
    player.groundHoles[i] = team.groundHoles[i]
  }
  player.lightX = team.lightX
  player.lightY = team.lightY

  // Restore economy
  player.money = savedData.money
  player.experienceManager.level = savedData.level
  player.experienceManager.experience = savedData.experience
  const { ExpTable, ENDLESS_MAX_LEVEL } = require("../config")
  player.experienceManager.expNeeded = ExpTable[savedData.level] ?? 4
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
    for (let i = 0; i < savedData.flowerPots.length && i < player.flowerPots.length; i++) {
      const fp = savedData.flowerPots[i]
      if (fp?.name) {
        const pot = PokemonFactory.createPokemonFromName(fp.name as Pkm, {
          shiny: fp.shiny,
          emotion: (fp.emotion as Emotion) ?? Emotion.NORMAL
        })
        pot.positionX = fp.positionX
        pot.positionY = fp.positionY
        player.flowerPots[i] = pot
      }
    }
  }

  player.mulch = savedData.mulch
  player.mulchCap = savedData.mulchCap

  // Restore miscellaneous player state
  player.artificialItems = (savedData.artificialItems ?? []) as Item[]
  player.buriedItems = (savedData.buriedItems ?? []).map((i) => (i as Item) ?? null)
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
  player.randomComponentsGiven = (savedData.randomComponentsGiven ?? []) as Item[]
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
          items: c.items as Item[]
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
          avatar: getAvatarString(PkmIndex[pokemon.name], pokemon.shiny, pokemon.emotion),
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
    await RunHistory.create({
      odToken,
      time: Date.now(),
      currentAct: historyAct,
      currentFloor: historyFloor,
      difficultyMode: state.difficultyMode,
      runHP: state.runHP,
      arceusDamageDealt: state.arceusDamageDealt,
      victory,
      pokemons,
      synergies
    })
    const result = victory ? "victory" : "defeat"
    const arceus = state.arceusDamageDealt > 0 ? ` | arceus dmg: ${state.arceusDamageDealt}` : ""
    logger.info(`Run saved | ${player.name} | ${result} | act ${historyAct} floor ${historyFloor}${arceus}`)
  } catch (e) {
    logger.error("Failed to save run history:", e)
  }
}

export async function saveRunHistoryFromSavedRun(odToken: string, savedData: SavedRunData): Promise<void> {
  if (odToken === "local-player") return
  try {
    const boardPokemon = savedData.team.pokemon.filter((p) => p.y > 0)
    const pokemons = boardPokemon.map((p) => ({
      name: p.name as string,
      avatar: getAvatarString(PkmIndex[p.name] ?? "", !!p.shiny, (p.emotion as Emotion) ?? Emotion.NORMAL),
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
    await RunHistory.create({
      odToken,
      time: Date.now(),
      currentAct: historyAct,
      currentFloor: historyFloor,
      difficultyMode: savedData.difficultyMode,
      runHP: savedData.runHP,
      arceusDamageDealt: 0,
      victory: false,
      pokemons,
      synergies
    })
    logger.info(`Abandoned run history saved | ${savedData.team.name} | act ${historyAct} floor ${historyFloor}`)
  } catch (e) {
    logger.error("Failed to save abandoned run history:", e)
  }
}

export async function getRunHistory(odToken: string, page: number = 1, pageSize: number = 10) {
  return RunHistory.find({ odToken })
    .sort({ time: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean()
}

const DIFF_KEY: Record<number, string> = { 0: "easy", 1: "normal", 2: "hard", 3: "impossible" }

export async function incrementRunStarted(uid: string, difficultyMode: number): Promise<void> {
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

export async function updateVictoryRecord(
  uid: string,
  name: string,
  avatar: string,
  difficultyMode: number,
  currentAct: number,
  isEndless: boolean
): Promise<void> {
  if (uid === "local-player" || isEndless) return
  const { recordVictory, recordLoss } = require("./victory-record")
  if (currentAct >= 4) {
    await recordVictory(uid, name, avatar, difficultyMode)
  } else {
    await recordLoss(uid, name, avatar, difficultyMode)
  }
}
