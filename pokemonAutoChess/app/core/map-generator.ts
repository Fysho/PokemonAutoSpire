import { ArraySchema, MapSchema } from "@colyseus/schema"
import { MapEdge, MapNode, MapNodeType } from "../models/colyseus-models/map-node"
import { getGymLeaderCount, getGymLeaderEncounter } from "../models/spire-encounters"
import { DungeonPMDO } from "../types/enum/Dungeon"
import { pickRandomIn, randomBetween, shuffleArray } from "../utils/random"

const ALL_DUNGEONS = Object.values(DungeonPMDO)

const FLOORS_PER_ACT = 15
const MIN_NODES_PER_FLOOR = 2
const MAX_NODES_PER_FLOOR = 4

function nodeId(act: number, floor: number, col: number): string {
  return `${act}-${floor}-${col}`
}

function assignNodeType(act: number, floor: number, totalFloors: number): MapNodeType {
  if (floor === totalFloors) {
    return MapNodeType.LEGENDARY_BOSS
  }
  if (floor === 1) {
    return MapNodeType.WILD_BATTLE
  }

  const roll = Math.random()

  if (floor === 5 || floor === 10) {
    return MapNodeType.POKEMON_CENTER
  }

  if (floor === 4 || floor === 8 || floor === 12) {
    return roll < 0.5 ? MapNodeType.POKEMART : MapNodeType.WILD_BATTLE
  }

  if (floor === 7 || floor === 13) {
    return MapNodeType.GYM_LEADER
  }

  if (roll < 0.55) return MapNodeType.WILD_BATTLE
  if (roll < 0.70) return MapNodeType.MYSTERY_ENCOUNTER
  if (roll < 0.85) return MapNodeType.POKEMART
  return MapNodeType.POKEMON_CENTER
}

export function generateActMap(
  act: number,
  mapNodes: MapSchema<MapNode>,
  mapEdges: ArraySchema<MapEdge>
) {
  const totalFloors = FLOORS_PER_ACT
  const floorNodes: string[][] = []

  const gymLeaderTotal = getGymLeaderCount()
  const gymLeaderIndices = Array.from({ length: gymLeaderTotal }, (_, i) => i)
  shuffleArray(gymLeaderIndices)
  let gymLeaderPick = 0

  for (let floor = 1; floor <= totalFloors; floor++) {
    let nodeCount: number
    if (floor === totalFloors) {
      nodeCount = 1
    } else if (floor === 1) {
      nodeCount = 3
    } else if (floor === 5 || floor === 10) {
      nodeCount = randomBetween(2, 3)
    } else {
      nodeCount = randomBetween(MIN_NODES_PER_FLOOR, MAX_NODES_PER_FLOOR)
    }

    const ids: string[] = []
    const usedRegions: string[] = []
    for (let col = 0; col < nodeCount; col++) {
      const id = nodeId(act, floor, col)
      const x = nodeCount === 1 ? 2 : Math.round((col / (nodeCount - 1)) * 4)
      const nodeType = assignNodeType(act, floor, totalFloors)

      let region = ""
      if (nodeType === MapNodeType.WILD_BATTLE) {
        const available = ALL_DUNGEONS.filter((d) => !usedRegions.includes(d))
        region = pickRandomIn(available.length > 0 ? available : ALL_DUNGEONS)
        usedRegions.push(region)
      }
      const node = new MapNode(id, nodeType, x, floor, act, floor, `act${act}_floor${floor}_${col}`, region)

      if (nodeType === MapNodeType.GYM_LEADER) {
        const idx = gymLeaderIndices[gymLeaderPick % gymLeaderIndices.length]
        gymLeaderPick++
        node.gymLeaderIndex = idx
        const encounter = getGymLeaderEncounter(idx)
        node.gymLeaderSynergy = encounter.synergy ?? ""
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

    const connected = new Set<string>()

    for (let i = 0; i < current.length; i++) {
      const fromId = current[i]
      const targetIdx = Math.min(i, next.length - 1)
      const toId = next[targetIdx]
      mapEdges.push(new MapEdge(fromId, toId))
      connected.add(toId)

      if (Math.random() < 0.4 && targetIdx + 1 < next.length) {
        mapEdges.push(new MapEdge(fromId, next[targetIdx + 1]))
        connected.add(next[targetIdx + 1])
      }
      if (Math.random() < 0.3 && targetIdx - 1 >= 0) {
        mapEdges.push(new MapEdge(fromId, next[targetIdx - 1]))
        connected.add(next[targetIdx - 1])
      }
    }

    for (const toId of next) {
      if (!connected.has(toId)) {
        const fromId = pickRandomIn(current)
        mapEdges.push(new MapEdge(fromId, toId))
      }
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
