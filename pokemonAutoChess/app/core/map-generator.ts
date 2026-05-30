import { ArraySchema, MapSchema } from "@colyseus/schema"
import { MapEdge, MapNode, MapNodeType } from "../models/colyseus-models/map-node"
import { getEliteEncounterAvatar, getEliteEncounterCount, getEliteEncounterName, getEliteFourDisplayName, getEliteFourSynergies, getGymLeaderDisplayName, getGymSynergies, getUnlockEncounterAvatar, getUnlockEncounterCount, getUnlockEncounterName, pickLegendaryBoss } from "../models/spire-encounters"
import { loadChampionData, type DifficultyMode } from "../services/champion-data"
import { PkmIndex } from "../types/enum/Pokemon"
import { DungeonPMDO } from "../types/enum/Dungeon"
import { getPokemonCustomFromAvatar } from "../utils/avatar"
import { pickRandomIn, randomBetween, shuffleArray } from "../utils/random"

const ALL_DUNGEONS = Object.values(DungeonPMDO)

const FLOORS_PER_ACT = 20
const MIN_NODES_PER_FLOOR = 3
const MAX_NODES_PER_FLOOR = 5

function nodeId(act: number, floor: number, col: number): string {
  return `${act}-${floor}-${col}`
}

const ENDLESS_ASYNC_FLOORS = new Set([5, 10, 15, 20])
const ENDLESS_GYM_FLOORS = new Set([7, 17])
const ENDLESS_CENTER_FLOORS = new Set([9, 19])

function assignEndlessNodeType(floor: number, totalFloors: number): MapNodeType {
  if (ENDLESS_ASYNC_FLOORS.has(floor)) return MapNodeType.ASYNC_FIGHT
  if (floor === 1) return MapNodeType.WILD_BATTLE
  if (ENDLESS_GYM_FLOORS.has(floor)) return MapNodeType.GYM_LEADER
  if (ENDLESS_CENTER_FLOORS.has(floor)) return MapNodeType.POKEMON_CENTER

  const roll = Math.random()
  if (floor === 16) return roll < 0.5 ? MapNodeType.POKEMART : MapNodeType.WILD_BATTLE

  if (floor === 8 || floor === 13 || floor === 18) {
    const eliteChance = 0.5
    if (roll < eliteChance) {
      return Math.random() < 0.5 ? MapNodeType.ELITE : MapNodeType.UNLOCK
    }
    return MapNodeType.WILD_BATTLE
  }

  if (floor === 4 || floor === 11) {
    if (roll < 0.3) {
      return Math.random() < 0.5 ? MapNodeType.ELITE : MapNodeType.UNLOCK
    }
    return MapNodeType.WILD_BATTLE
  }

  if (roll < 0.50) return MapNodeType.WILD_BATTLE
  if (roll < 0.62) return MapNodeType.MYSTERY_ENCOUNTER
  if (floor >= 6 && roll < 0.78) return MapNodeType.POKEMART
  if (floor >= 4 && roll < 0.82) return MapNodeType.POKEMON_CENTER
  return MapNodeType.WILD_BATTLE
}

function assignNodeType(act: number, floor: number, totalFloors: number): MapNodeType {
  if (floor === totalFloors) {
    return MapNodeType.LEGENDARY_BOSS
  }
  if (floor === 1) {
    return MapNodeType.WILD_BATTLE
  }

  if (floor === totalFloors - 1) {
    return MapNodeType.POKEMON_CENTER
  }

  const roll = Math.random()

  if (floor === 5) {
    return MapNodeType.WILD_BATTLE
  }
  if (floor === 16) {
    return roll < 0.5 ? MapNodeType.POKEMART : MapNodeType.WILD_BATTLE
  }

  if (floor === 6 || floor === 12 || floor === 18) {
    return MapNodeType.GYM_LEADER
  }

  if (floor === 8 || floor === 13 || floor === 17) {
    const eliteChance = act === 1 ? 0.7 : 0.5
    if (roll < eliteChance) {
      const eliteWeight = act === 1 ? 0.5 : 0.1
      return Math.random() < eliteWeight ? MapNodeType.ELITE : MapNodeType.UNLOCK
    }
    return MapNodeType.WILD_BATTLE
  }

  if (floor === 4 || floor === 11) {
    const eliteChance = act === 1 ? 0.4 : 0.3
    if (roll < eliteChance) {
      const eliteWeight = act === 1 ? 0.5 : 0.1
      return Math.random() < eliteWeight ? MapNodeType.ELITE : MapNodeType.UNLOCK
    }
    return MapNodeType.WILD_BATTLE
  }

  if (floor === 9 || floor === 15) {
    return roll < 0.4 ? MapNodeType.GYM_LEADER : MapNodeType.WILD_BATTLE
  }

  if (floor === 10) {
    return roll < 0.5 ? MapNodeType.POKEMON_CENTER : MapNodeType.POKEMART
  }

  if (roll < 0.50) return MapNodeType.WILD_BATTLE
  if (roll < 0.62) return MapNodeType.MYSTERY_ENCOUNTER
  if (floor >= 6 && roll < 0.78) return MapNodeType.POKEMART
  if (floor >= 4 && roll < 0.82) return MapNodeType.POKEMON_CENTER
  return MapNodeType.WILD_BATTLE
}

function generateEliteFourMap(
  mapNodes: MapSchema<MapNode>,
  mapEdges: ArraySchema<MapEdge>,
  difficultyMode: DifficultyMode = 1
) {
  const act = 4
  const championData = loadChampionData(difficultyMode)

  // 5 floors: 4 E4 fights, then champion
  const floorNodes: string[][] = []
  for (let floor = 1; floor <= 5; floor++) {
    const ids: string[] = []

    if (floor === 5) {
      const id = nodeId(act, floor, 0)
      const node = new MapNode(id, MapNodeType.CHAMPION, 2, floor, act, floor, `act4_champion`, "")
      node.displayName = `Champion ${championData.champion.name}`
      const champCustom = getPokemonCustomFromAvatar(championData.champion.avatar)
      node.eliteAvatar = PkmIndex[champCustom.name] ?? ""
      mapNodes.set(id, node)
      ids.push(id)
    } else {
      const e4Index = floor - 1 // 0,1,2,3
      const id = nodeId(act, floor, 0)
      const node = new MapNode(id, MapNodeType.ELITE_FOUR, 2, floor, act, floor, `act4_e4_${e4Index}`, "")
      node.displayName = `E4 ${championData.eliteFour[e4Index].name}`
      const e4Custom = getPokemonCustomFromAvatar(championData.eliteFour[e4Index].avatar)
      node.eliteAvatar = PkmIndex[e4Custom.name] ?? ""
      mapNodes.set(id, node)
      ids.push(id)
    }

    if (floor === 1) {
      ids.forEach(id => {
        const node = mapNodes.get(id)
        if (node) node.available = true
      })
    }

    floorNodes.push(ids)
  }

  // Connect floors linearly
  for (let f = 0; f < floorNodes.length - 1; f++) {
    const current = floorNodes[f]
    const next = floorNodes[f + 1]
    for (const fromId of current) {
      for (const toId of next) {
        mapEdges.push(new MapEdge(fromId, toId))
      }
    }
  }
}

function generateAct5Map(
  mapNodes: MapSchema<MapNode>,
  mapEdges: ArraySchema<MapEdge>
) {
  const act = 5

  const arceusId = nodeId(act, 1, 0)
  const arceusNode = new MapNode(arceusId, MapNodeType.ARCEUS_BOSS, 2, 1, act, 1, `act5_arceus`, "")
  arceusNode.displayName = "Arceus"
  arceusNode.bossSprites = "0493"
  arceusNode.available = true
  mapNodes.set(arceusId, arceusNode)
}

export function generateActMap(
  act: number,
  mapNodes: MapSchema<MapNode>,
  mapEdges: ArraySchema<MapEdge>,
  difficultyMode: DifficultyMode = 1,
  isEndless: boolean = false
) {
  if (!isEndless && act === 5) {
    return generateAct5Map(mapNodes, mapEdges)
  }
  if (!isEndless && act === 4) {
    return generateEliteFourMap(mapNodes, mapEdges, difficultyMode)
  }

  const totalFloors = FLOORS_PER_ACT
  const floorNodes: string[][] = []

  const gymSynergies = [...getGymSynergies()]
  shuffleArray(gymSynergies)
  let gymPick = 0

  const eliteTotal = getEliteEncounterCount(act)
  const eliteIndices = Array.from({ length: eliteTotal }, (_, i) => i)
  shuffleArray(eliteIndices)
  let elitePick = 0

  const unlockTotal = getUnlockEncounterCount(act, isEndless)
  const unlockIndices = Array.from({ length: unlockTotal }, (_, i) => i)
  shuffleArray(unlockIndices)
  let unlockPick = 0

  for (let floor = 1; floor <= totalFloors; floor++) {
    let nodeCount: number
    if (isEndless && ENDLESS_ASYNC_FLOORS.has(floor)) {
      nodeCount = 4
    } else if (floor === totalFloors && !isEndless) {
      nodeCount = 1
    } else if (floor === 1) {
      nodeCount = 3
    } else if (floor === 7 || floor === 14) {
      nodeCount = randomBetween(2, 3)
    } else {
      nodeCount = randomBetween(MIN_NODES_PER_FLOOR, MAX_NODES_PER_FLOOR)
    }

    const ids: string[] = []
    const usedRegions: string[] = []
    for (let col = 0; col < nodeCount; col++) {
      const id = nodeId(act, floor, col)
      const x = nodeCount === 1 ? 2 : Math.round((col / (nodeCount - 1)) * 4)
      const nodeType = isEndless
        ? assignEndlessNodeType(floor, totalFloors)
        : assignNodeType(act, floor, totalFloors)

      let region = ""
      if (nodeType === MapNodeType.WILD_BATTLE) {
        const available = ALL_DUNGEONS.filter((d) => !usedRegions.includes(d))
        region = pickRandomIn(available.length > 0 ? available : ALL_DUNGEONS)
        usedRegions.push(region)
      }
      const node = new MapNode(id, nodeType, x, floor, act, floor, `act${act}_floor${floor}_${col}`, region)

      if (nodeType === MapNodeType.GYM_LEADER) {
        const synergy = gymSynergies[gymPick % gymSynergies.length]
        gymPick++
        node.gymLeaderIndex = 0
        node.gymLeaderIsEarly = false
        node.gymLeaderSynergy = synergy
        node.displayName = getGymLeaderDisplayName(synergy)
      }

      if (nodeType === MapNodeType.ELITE) {
        node.eliteEncounterIndex = eliteIndices[elitePick % eliteIndices.length]
        elitePick++
        node.displayName = getEliteEncounterName(node.eliteEncounterIndex, act)
        const avatar = getEliteEncounterAvatar(node.eliteEncounterIndex, act)
        node.eliteAvatar = PkmIndex[avatar] ?? ""
      }

      if (nodeType === MapNodeType.UNLOCK) {
        node.eliteEncounterIndex = unlockIndices[unlockPick % unlockIndices.length]
        unlockPick++
        node.displayName = getUnlockEncounterName(node.eliteEncounterIndex, act, isEndless)
        const avatar = getUnlockEncounterAvatar(node.eliteEncounterIndex, act, isEndless)
        node.eliteAvatar = PkmIndex[avatar] ?? ""
      }

      if (nodeType === MapNodeType.LEGENDARY_BOSS) {
        const boss = pickLegendaryBoss(act)
        node.displayName = boss.name
        node.bossSprites = boss.sprites.map(p => PkmIndex[p] ?? "").join(",")
      }

      if (floor === 1) {
        node.available = true
      }

      mapNodes.set(id, node)
      ids.push(id)
    }
    floorNodes.push(ids)
  }

  for (let f = 0; f < floorNodes.length - 1; f++) {
    const current = floorNodes[f]
    const next = floorNodes[f + 1]

    if (next.length === 1) {
      for (const fromId of current) {
        mapEdges.push(new MapEdge(fromId, next[0]))
      }
      continue
    }

    if (current.length === 1) {
      for (const toId of next) {
        mapEdges.push(new MapEdge(current[0], toId))
      }
      continue
    }

    // Generate all possible edges between floors
    const allPossible: { from: number; to: number }[] = []
    for (let i = 0; i < current.length; i++) {
      for (let j = 0; j < next.length; j++) {
        allPossible.push({ from: i, to: j })
      }
    }

    // Shuffle so we get variety each run
    shuffleArray(allPossible)

    // Prioritize straight/nearby connections by sorting closer edges first
    allPossible.sort((a, b) => {
      const distA = Math.abs(a.from / (current.length - 1 || 1) - a.to / (next.length - 1 || 1))
      const distB = Math.abs(b.from / (current.length - 1 || 1) - b.to / (next.length - 1 || 1))
      return distA - distB
    })

    // Greedily add edges that don't cross existing ones
    const kept: { from: number; to: number }[] = []
    for (const edge of allPossible) {
      const crosses = kept.some(
        (e) =>
          (e.from < edge.from && e.to > edge.to) ||
          (e.from > edge.from && e.to < edge.to)
      )
      if (!crosses) {
        kept.push(edge)
      }
    }

    // Ensure all next nodes are reachable
    const reachable = new Set(kept.map((e) => e.to))
    for (let j = 0; j < next.length; j++) {
      if (!reachable.has(j)) {
        const nearest = Math.min(j, current.length - 1)
        kept.push({ from: nearest, to: j })
      }
    }

    // Ensure all current nodes have at least one outgoing edge
    const hasOutgoing = new Set(kept.map((e) => e.from))
    for (let i = 0; i < current.length; i++) {
      if (!hasOutgoing.has(i)) {
        const nearest = Math.min(i, next.length - 1)
        kept.push({ from: i, to: nearest })
      }
    }

    // Randomly drop some optional edges to add variety (keep at least the base connections)
    // Protect edges that are the sole outgoing for a source OR sole incoming for a target
    const outgoingCount = new Map<number, number>()
    const incomingCount = new Map<number, number>()
    kept.forEach((e) => {
      outgoingCount.set(e.from, (outgoingCount.get(e.from) ?? 0) + 1)
      incomingCount.set(e.to, (incomingCount.get(e.to) ?? 0) + 1)
    })
    const baseCount = Math.max(current.length, next.length)
    const finalEdges = kept.filter((edge, i) => {
      if (i < baseCount) return true
      if ((outgoingCount.get(edge.from) ?? 0) <= 1) return true
      if ((incomingCount.get(edge.to) ?? 0) <= 1) return true
      if (Math.random() < 0.7) return true
      outgoingCount.set(edge.from, (outgoingCount.get(edge.from) ?? 1) - 1)
      incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 1) - 1)
      return false
    })

    for (const edge of finalEdges) {
      mapEdges.push(new MapEdge(current[edge.from], next[edge.to]))
    }
  }
}

export function markAvailableNodes(
  visitedNodeId: string,
  mapNodes: MapSchema<MapNode>,
  mapEdges: ArraySchema<MapEdge>
) {
  mapNodes.forEach((node) => {
    node.available = false
  })

  const visitedNode = mapNodes.get(visitedNodeId)
  if (!visitedNode) return

  mapEdges.forEach((edge) => {
    if (edge.from === visitedNodeId) {
      const nextNode = mapNodes.get(edge.to)
      if (nextNode && !nextNode.visited) {
        nextNode.available = true
      }
    }
  })
}
