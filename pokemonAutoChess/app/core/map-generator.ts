import { ArraySchema, MapSchema } from "@colyseus/schema"
import { MapEdge, MapNode, MapNodeType } from "../models/colyseus-models/map-node"
import { getEarlyGymLeaderCount, getEarlyGymLeaderEncounter, getEliteEncounterCount, getLateGymLeaderCount, getLateGymLeaderEncounter } from "../models/spire-encounters"
import { DungeonPMDO } from "../types/enum/Dungeon"
import { pickRandomIn, randomBetween, shuffleArray } from "../utils/random"

const ALL_DUNGEONS = Object.values(DungeonPMDO)

const FLOORS_PER_ACT = 20
const MIN_NODES_PER_FLOOR = 3
const MAX_NODES_PER_FLOOR = 5

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

  if (floor === 10 || floor === totalFloors - 1) {
    return MapNodeType.POKEMON_CENTER
  }

  const roll = Math.random()

  if (floor === 5 || floor === 16) {
    return roll < 0.5 ? MapNodeType.POKEMART : MapNodeType.WILD_BATTLE
  }

  if (floor === 9 || floor === 18) {
    return MapNodeType.GYM_LEADER
  }

  if (floor === 8 || floor === 13 || floor === 17) {
    return roll < 0.5 ? MapNodeType.ELITE : MapNodeType.WILD_BATTLE
  }

  if (roll < 0.50) return MapNodeType.WILD_BATTLE
  if (roll < 0.62) return MapNodeType.MYSTERY_ENCOUNTER
  if (roll < 0.78) return MapNodeType.POKEMART
  if (roll < 0.88) return MapNodeType.POKEMON_CENTER
  return MapNodeType.WILD_BATTLE
}

export function generateActMap(
  act: number,
  mapNodes: MapSchema<MapNode>,
  mapEdges: ArraySchema<MapEdge>
) {
  const totalFloors = FLOORS_PER_ACT
  const floorNodes: string[][] = []

  const earlyGymIndices = Array.from({ length: getEarlyGymLeaderCount() }, (_, i) => i)
  shuffleArray(earlyGymIndices)
  let earlyGymPick = 0
  const lateGymIndices = Array.from({ length: getLateGymLeaderCount() }, (_, i) => i)
  shuffleArray(lateGymIndices)
  let lateGymPick = 0

  const eliteTotal = getEliteEncounterCount()
  const eliteIndices = Array.from({ length: eliteTotal }, (_, i) => i)
  shuffleArray(eliteIndices)
  let elitePick = 0

  for (let floor = 1; floor <= totalFloors; floor++) {
    let nodeCount: number
    if (floor === totalFloors) {
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
      const nodeType = assignNodeType(act, floor, totalFloors)

      let region = ""
      if (nodeType === MapNodeType.WILD_BATTLE) {
        const available = ALL_DUNGEONS.filter((d) => !usedRegions.includes(d))
        region = pickRandomIn(available.length > 0 ? available : ALL_DUNGEONS)
        usedRegions.push(region)
      }
      const node = new MapNode(id, nodeType, x, floor, act, floor, `act${act}_floor${floor}_${col}`, region)

      if (nodeType === MapNodeType.GYM_LEADER) {
        const isEarlyFloor = floor <= 12
        if (isEarlyFloor) {
          const idx = earlyGymIndices[earlyGymPick % earlyGymIndices.length]
          earlyGymPick++
          node.gymLeaderIndex = idx
          node.gymLeaderIsEarly = true
          const encounter = getEarlyGymLeaderEncounter(idx)
          node.gymLeaderSynergy = encounter.synergy ?? ""
        } else {
          const idx = lateGymIndices[lateGymPick % lateGymIndices.length]
          lateGymPick++
          node.gymLeaderIndex = idx
          node.gymLeaderIsEarly = false
          const encounter = getLateGymLeaderEncounter(idx)
          node.gymLeaderSynergy = encounter.synergy ?? ""
        }
      }

      if (nodeType === MapNodeType.ELITE) {
        node.eliteEncounterIndex = eliteIndices[elitePick % eliteIndices.length]
        elitePick++
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

    const floorEdges: { from: number; to: number }[] = []
    const connected = new Set<number>()

    for (let i = 0; i < current.length; i++) {
      const targetIdx = Math.min(i, next.length - 1)
      floorEdges.push({ from: i, to: targetIdx })
      connected.add(targetIdx)

      if (Math.random() < 0.55 && targetIdx + 1 < next.length) {
        floorEdges.push({ from: i, to: targetIdx + 1 })
        connected.add(targetIdx + 1)
      }
      if (Math.random() < 0.45 && targetIdx - 1 >= 0) {
        floorEdges.push({ from: i, to: targetIdx - 1 })
        connected.add(targetIdx - 1)
      }
    }

    for (let j = 0; j < next.length; j++) {
      if (!connected.has(j)) {
        const fromIdx = Math.min(j, current.length - 1)
        floorEdges.push({ from: fromIdx, to: j })
      }
    }

    // Remove crossing edges (keep the first one added, remove later ones that cross)
    const kept: { from: number; to: number }[] = []
    for (const edge of floorEdges) {
      const crosses = kept.some(
        (e) =>
          (e.from < edge.from && e.to > edge.to) ||
          (e.from > edge.from && e.to < edge.to)
      )
      if (!crosses) {
        kept.push(edge)
      }
    }

    // Ensure all next nodes are still reachable
    const reachable = new Set(kept.map((e) => e.to))
    for (let j = 0; j < next.length; j++) {
      if (!reachable.has(j)) {
        // Connect to nearest non-crossing source
        const nearest = Math.min(j, current.length - 1)
        kept.push({ from: nearest, to: j })
      }
    }

    for (const edge of kept) {
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
