import { ArraySchema, MapSchema } from "@colyseus/schema"
import { MapEdge, MapNode, MapNodeType } from "../models/colyseus-models/map-node"
import { getEliteEncounterCount, getEliteEncounterName, getEliteFourDisplayName, getEliteFourSynergies, getGymLeaderDisplayName, getGymSynergies } from "../models/spire-encounters"
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
    return roll < 0.5 ? MapNodeType.ELITE : MapNodeType.WILD_BATTLE
  }

  if (floor === 9 || floor === 15) {
    return roll < 0.4 ? MapNodeType.GYM_LEADER : MapNodeType.WILD_BATTLE
  }

  const pokemonCenterChance = act >= 3 ? 0.05 : 0.10
  if (roll < 0.50) return MapNodeType.WILD_BATTLE
  if (roll < 0.62) return MapNodeType.MYSTERY_ENCOUNTER
  if (floor >= 6 && roll < 0.78) return MapNodeType.POKEMART
  if (roll < 0.78 + pokemonCenterChance) return MapNodeType.POKEMON_CENTER
  return MapNodeType.WILD_BATTLE
}

function generateEliteFourMap(
  mapNodes: MapSchema<MapNode>,
  mapEdges: ArraySchema<MapEdge>
) {
  const act = 4
  const e4Synergies = [...getEliteFourSynergies()]
  shuffleArray(e4Synergies)

  // 10 floors: odd = rest/shop (2 nodes), even = E4 fight (1 node), floor 10 = champion
  const floorNodes: string[][] = []
  for (let floor = 1; floor <= 10; floor++) {
    const ids: string[] = []

    if (floor === 10) {
      const id = nodeId(act, floor, 0)
      const node = new MapNode(id, MapNodeType.CHAMPION, 2, floor, act, floor, `act4_champion`, "")
      node.displayName = "Champion"
      mapNodes.set(id, node)
      ids.push(id)
    } else if (floor % 2 === 1) {
      // Rest/shop floor: 2 nodes (Pokemon Center + PokeMart)
      const centerId = nodeId(act, floor, 0)
      const centerNode = new MapNode(centerId, MapNodeType.POKEMON_CENTER, 1, floor, act, floor, `act4_floor${floor}_center`, "")
      mapNodes.set(centerId, centerNode)
      ids.push(centerId)

      const martId = nodeId(act, floor, 1)
      const martNode = new MapNode(martId, MapNodeType.POKEMART, 3, floor, act, floor, `act4_floor${floor}_mart`, "")
      mapNodes.set(martId, martNode)
      ids.push(martId)
    } else {
      // E4 fight floor: 1 node
      const e4Index = Math.floor(floor / 2) - 1 // 0,1,2,3
      const synergy = e4Synergies[e4Index % e4Synergies.length]
      const id = nodeId(act, floor, 0)
      const node = new MapNode(id, MapNodeType.ELITE_FOUR, 2, floor, act, floor, `act4_e4_${e4Index}`, "")
      node.gymLeaderSynergy = synergy
      node.displayName = getEliteFourDisplayName(synergy)
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

export function generateActMap(
  act: number,
  mapNodes: MapSchema<MapNode>,
  mapEdges: ArraySchema<MapEdge>
) {
  if (act === 4) {
    return generateEliteFourMap(mapNodes, mapEdges)
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
    // Build set of edges that are the sole outgoing edge for a node — these are protected
    const outgoingCount = new Map<number, number>()
    kept.forEach((e) => outgoingCount.set(e.from, (outgoingCount.get(e.from) ?? 0) + 1))
    const baseCount = Math.max(current.length, next.length)
    const finalEdges = kept.filter((edge, i) => {
      if (i < baseCount) return true
      if ((outgoingCount.get(edge.from) ?? 0) <= 1) return true
      if (Math.random() < 0.7) return true
      outgoingCount.set(edge.from, (outgoingCount.get(edge.from) ?? 1) - 1)
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
