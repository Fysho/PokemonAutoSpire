import React from "react"
import { RegionDetails } from "../../../../../config"
import { MapEdge, MapNode, MapNodeType } from "../../../../../models/colyseus-models/map-node"
import { Transfer } from "../../../../../types"
import { DungeonPMDO } from "../../../../../types/enum/Dungeon"
import { Synergy } from "../../../../../types/enum/Synergy"
import { rooms } from "../../../network"

const NODE_COLORS: Record<string, string> = {
  [MapNodeType.WILD_BATTLE]: "#e74c3c",
  [MapNodeType.GYM_LEADER]: "#f39c12",
  [MapNodeType.ELITE]: "#c0392b",
  [MapNodeType.POKEMART]: "#3498db",
  [MapNodeType.POKEMON_CENTER]: "#2ecc71",
  [MapNodeType.MYSTERY_ENCOUNTER]: "#9b59b6",
  [MapNodeType.LEGENDARY_BOSS]: "#e67e22"
}

const NODE_ICONS: Record<string, string> = {
  [MapNodeType.POKEMART]: "/assets/ui/pokeball.svg",
  [MapNodeType.MYSTERY_ENCOUNTER]: "/assets/unown/unown-qm.png",
  [MapNodeType.POKEMON_CENTER]: "/assets/portraits/0113/Happy.png"
}

const NODE_LABELS: Record<string, string> = {
  [MapNodeType.GYM_LEADER]: "🏅",
  [MapNodeType.ELITE]: "⚔️",
  [MapNodeType.LEGENDARY_BOSS]: "👑"
}

const NODE_NAMES: Record<string, string> = {
  [MapNodeType.WILD_BATTLE]: "Wild Battle",
  [MapNodeType.GYM_LEADER]: "Gym Leader",
  [MapNodeType.ELITE]: "Elite",
  [MapNodeType.POKEMART]: "PokeMart",
  [MapNodeType.POKEMON_CENTER]: "Pokemon Center",
  [MapNodeType.MYSTERY_ENCOUNTER]: "Mystery",
  [MapNodeType.LEGENDARY_BOSS]: "BOSS"
}

function getRegionSynergies(region: string): Synergy[] {
  if (!region || region === "") return []
  const details = RegionDetails[region as DungeonPMDO]
  return details?.synergies ?? []
}

interface GameMapProps {
  mapNodes: Map<string, MapNode>
  mapEdges: MapEdge[]
  currentAct: number
  currentFloor: number
  runHP: number
  onHide: () => void
}

export default function GameMap({
  mapNodes,
  mapEdges,
  currentAct,
  currentFloor,
  runHP,
  onHide
}: GameMapProps) {
  const handleNodeClick = (nodeId: string) => {
    const node = mapNodes.get(nodeId)
    if (node && node.available) {
      rooms.game?.send(Transfer.SELECT_MAP_NODE, nodeId)
    }
  }

  const nodes = Array.from(mapNodes.values())
  const maxFloor = Math.max(...nodes.map((n) => n.floor), 1)
  const svgWidth = 1000
  const svgHeight = maxFloor * 80 + 80
  const floorHeight = 75
  const nodeSpread = svgWidth * 0.8
  const nodeOffset = svgWidth * 0.1

  const getNodePos = (node: MapNode) => ({
    cx: nodeOffset + (node.x / 4) * nodeSpread,
    cy: svgHeight - (node.floor * floorHeight + 40)
  })

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.85)",
        zIndex: 100,
        color: "white"
      }}
    >
      <h2 style={{ margin: "0 0 8px 0", fontSize: "24px" }}>
        Act {currentAct} - Floor {currentFloor}
      </h2>
      <div style={{ display: "flex", gap: "20px", marginBottom: "12px", fontSize: "16px" }}>
        <span>HP: {runHP}/100</span>
      </div>

      <div
        style={{
          overflow: "auto",
          maxHeight: "80vh",
          border: "2px solid #444",
          borderRadius: "8px",
          background: "#1a1a2e",
          padding: "10px"
        }}
      >
        <svg width={svgWidth} height={svgHeight}>
          {mapEdges.map((edge, i) => {
            const fromNode = mapNodes.get(edge.from)
            const toNode = mapNodes.get(edge.to)
            if (!fromNode || !toNode) return null
            const from = getNodePos(fromNode)
            const to = getNodePos(toNode)
            return (
              <line
                key={`edge-${i}`}
                x1={from.cx}
                y1={from.cy}
                x2={to.cx}
                y2={to.cy}
                stroke={fromNode.visited && toNode.visited ? "#666" : "#333"}
                strokeWidth={2}
              />
            )
          })}

          {nodes.map((node) => {
            const pos = getNodePos(node)
            const color = NODE_COLORS[node.nodeType] || "#888"
            const isAvailable = node.available
            const isVisited = node.visited
            const synergies = getRegionSynergies(node.region)
            const isWild = node.nodeType === MapNodeType.WILD_BATTLE
            const isGym = node.nodeType === MapNodeType.GYM_LEADER
            const hasSynergyIcon = (isWild && synergies.length > 0) || (isGym && node.gymLeaderSynergy)
            const nodeRadius = hasSynergyIcon ? 28 : (isAvailable ? 24 : 20)

            return (
              <g
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                style={{ cursor: isAvailable ? "pointer" : "default" }}
              >
                {!hasSynergyIcon && (
                  <circle
                    cx={pos.cx}
                    cy={pos.cy}
                    r={nodeRadius}
                    fill={isVisited ? "#333" : color}
                    stroke={isAvailable ? "#fff" : isVisited ? "#555" : color}
                    strokeWidth={isAvailable ? 3 : 1}
                    opacity={isVisited ? 0.4 : isAvailable ? 1 : 0.6}
                  />
                )}
                {isGym && node.gymLeaderSynergy ? (
                  <>
                    <circle
                      cx={pos.cx}
                      cy={pos.cy}
                      r={nodeRadius}
                      fill={isVisited ? "#333" : color}
                      stroke={isAvailable ? "#fff" : isVisited ? "#555" : color}
                      strokeWidth={isAvailable ? 3 : 1}
                      opacity={isVisited ? 0.4 : isAvailable ? 1 : 0.6}
                    />
                    <image
                      href={`/assets/item/${node.gymLeaderSynergy}_GEM.png`}
                      x={pos.cx - 18}
                      y={pos.cy - 18}
                      width={36}
                      height={36}
                      opacity={isVisited ? 0.3 : isAvailable ? 1 : 0.6}
                    />
                  </>
                ) : isWild && synergies.length > 0 ? (
                  synergies.map((syn, si) => {
                    const iconSize = 40
                    let ix = pos.cx
                    let iy = pos.cy
                    if (synergies.length === 2) {
                      ix = pos.cx + (si === 0 ? -14 : 14)
                    } else if (synergies.length === 3) {
                      if (si === 0) { ix = pos.cx; iy = pos.cy - 16 }
                      else if (si === 1) { ix = pos.cx - 17; iy = pos.cy + 10 }
                      else { ix = pos.cx + 17; iy = pos.cy + 10 }
                    }
                    return (
                      <image
                        key={`${node.id}-syn-${si}`}
                        href={`/assets/types/${syn}.svg`}
                        x={ix - iconSize / 2}
                        y={iy - iconSize / 2}
                        width={iconSize}
                        height={iconSize}
                        opacity={isVisited ? 0.3 : isAvailable ? 1 : 0.5}
                      />
                    )
                  })
                ) : NODE_ICONS[node.nodeType] ? (
                  <image
                    href={NODE_ICONS[node.nodeType]}
                    x={pos.cx - (node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 32 : 16)}
                    y={pos.cy - (node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 32 : 16)}
                    width={node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 64 : 32}
                    height={node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 64 : 32}
                    opacity={isVisited ? 0.3 : isAvailable ? 1 : 0.5}
                  />
                ) : (
                  <text
                    x={pos.cx}
                    y={pos.cy + 7}
                    textAnchor="middle"
                    fontSize="20"
                    fill="white"
                  >
                    {NODE_LABELS[node.nodeType]}
                  </text>
                )}
                {isAvailable && (
                  <text
                    x={pos.cx}
                    y={pos.cy + 42}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#ccc"
                  >
                    {isWild && node.region
                      ? node.region.replace(/([A-Z])/g, " $1").trim()
                      : NODE_NAMES[node.nodeType]}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
        <button
          onClick={onHide}
          style={{
            padding: "8px 24px",
            fontSize: "14px",
            borderRadius: "6px",
            border: "1px solid #666",
            background: "#333",
            color: "#ccc",
            cursor: "pointer"
          }}
        >
          Hide Map (View Board)
        </button>
        <span style={{ fontSize: "12px", color: "#888" }}>
          Click an available node to proceed
        </span>
      </div>
    </div>
  )
}
