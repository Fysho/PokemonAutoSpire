import React, { useCallback, useEffect, useRef, useState } from "react"
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
  [MapNodeType.POKEMON_CENTER]: "/assets/ui/chansey-sprite.png"
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
  readOnly?: boolean
}

export default function GameMap({
  mapNodes,
  mapEdges,
  currentAct,
  currentFloor,
  runHP,
  onHide,
  readOnly = false
}: GameMapProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  const handleNodeClick = (nodeId: string) => {
    if (readOnly) return
    const node = mapNodes.get(nodeId)
    if (node && node.available) {
      rooms.game?.send(Transfer.SELECT_MAP_NODE, nodeId)
    }
  }

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current
    if (!el) return
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }
    el.style.cursor = "grabbing"
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    scrollRef.current.scrollLeft = dragStart.current.scrollLeft - dx
    scrollRef.current.scrollTop = dragStart.current.scrollTop - dy
  }, [])

  const onMouseUp = useCallback(() => {
    isDragging.current = false
    if (scrollRef.current) scrollRef.current.style.cursor = "grab"
  }, [])

  const nodes = Array.from(mapNodes.values())
  const maxFloor = Math.max(...nodes.map((n) => n.floor), 1)
  const svgWidth = 1000
  const floorHeight = 100
  const svgHeight = maxFloor * floorHeight + 80
  const nodeSpread = svgWidth * 0.6
  const nodeOffset = svgWidth * 0.2

  const hashId = (id: string) => {
    let h = 0
    for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0
    return h
  }

  const floorNodeCounts = new Map<number, number>()
  nodes.forEach((n) => floorNodeCounts.set(n.floor, (floorNodeCounts.get(n.floor) ?? 0) + 1))

  const getNodePos = (node: MapNode) => {
    const h = hashId(node.id)
    const count = floorNodeCounts.get(node.floor) ?? 1
    const pullToCenter = count <= 2 ? 0.3 : count <= 3 ? 0.15 : 0
    const baseX = node.x / 4
    const centeredX = baseX + (0.5 - baseX) * pullToCenter
    const ox = ((h % 61) - 30) * 1.2
    const oy = (((h >> 8) % 41) - 20) * 0.6
    return {
      cx: nodeOffset + centeredX * nodeSpread + ox,
      cy: svgHeight - (node.floor * floorHeight + 40) + oy
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      const currentFloorY = svgHeight - (currentFloor * floorHeight + 40)
      const containerHeight = scrollRef.current.clientHeight
      scrollRef.current.scrollTop = currentFloorY - containerHeight / 2
    }
  }, [currentFloor, svgHeight])

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
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          overflowY: "auto",
          overflowX: "hidden",
          maxHeight: "80vh",
          width: "min(95vw, 1020px)",
          border: "2px solid #444",
          borderRadius: "8px",
          background: "#1a1a2e",
          padding: "10px",
          cursor: "grab",
          userSelect: "none"
        }}
      >
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height={svgHeight}>
          {mapEdges.map((edge, i) => {
            const fromNode = mapNodes.get(edge.from)
            const toNode = mapNodes.get(edge.to)
            if (!fromNode || !toNode) return null
            const from = getNodePos(fromNode)
            const to = getNodePos(toNode)
            const bothVisited = fromNode.visited && toNode.visited
            const eitherMissed = (!fromNode.visited && !fromNode.available && fromNode.floor <= currentFloor) ||
              (!toNode.visited && !toNode.available && toNode.floor <= currentFloor)
            return (
              <line
                key={`edge-${i}`}
                x1={from.cx}
                y1={from.cy}
                x2={to.cx}
                y2={to.cy}
                stroke={bothVisited ? "#666" : eitherMissed ? "#222" : "#333"}
                strokeWidth={2}
                strokeDasharray="6 4"
                opacity={eitherMissed ? 0.4 : 1}
              />
            )
          })}

          {nodes.map((node) => {
            const pos = getNodePos(node)
            const isAvailable = node.available
            const isVisited = node.visited
            const isMissed = !isVisited && !isAvailable && node.floor <= currentFloor
            const color = isMissed ? "#444" : (NODE_COLORS[node.nodeType] || "#888")
            const synergies = getRegionSynergies(node.region)
            const isWild = node.nodeType === MapNodeType.WILD_BATTLE
            const isGym = node.nodeType === MapNodeType.GYM_LEADER
            const hasSynergyIcon = (isWild && synergies.length > 0) || (isGym && node.gymLeaderSynergy)
            const nodeRadius = hasSynergyIcon ? 28 : (isAvailable ? 24 : 20)
            const nodeOpacity = isMissed ? 0.25 : isVisited ? 0.4 : isAvailable ? 1 : 0.6

            const isHovered = hoveredNode === node.id
            const getNodeName = () => {
              if (isWild && node.region) return node.region.replace(/([A-Z])/g, " $1").trim()
              if (node.displayName) return node.displayName
              return NODE_NAMES[node.nodeType] || ""
            }

            return (
              <g
                key={node.id}
                onClick={() => handleNodeClick(node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: isAvailable && !readOnly ? "pointer" : "default" }}
              >
                {(isAvailable || isHovered) && (
                  <circle
                    cx={pos.cx}
                    cy={pos.cy}
                    r={nodeRadius + 4}
                    fill="none"
                    stroke={isAvailable ? "#fff" : "#aaa"}
                    strokeWidth={isHovered ? 3 : 2}
                    opacity={isHovered ? 0.9 : 0.6}
                  />
                )}
                {isGym && node.gymLeaderSynergy ? (
                  <image
                    href={`/assets/item/${node.gymLeaderSynergy}_GEM.png`}
                    x={pos.cx - 18}
                    y={pos.cy - 18}
                    width={36}
                    height={36}
                    opacity={nodeOpacity}
                    style={isMissed ? { filter: "grayscale(1)" } : undefined}
                  />
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
                        opacity={nodeOpacity}
                        style={isMissed ? { filter: "grayscale(1)" } : undefined}
                      />
                    )
                  })
                ) : NODE_ICONS[node.nodeType] ? (
                  <image
                    href={NODE_ICONS[node.nodeType]}
                    x={pos.cx - (node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 48 : node.nodeType === MapNodeType.POKEMON_CENTER ? 27 : 24)}
                    y={pos.cy - (node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 48 : node.nodeType === MapNodeType.POKEMON_CENTER ? 45 : 24)}
                    width={node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 96 : node.nodeType === MapNodeType.POKEMON_CENTER ? 54 : 48}
                    height={node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 96 : node.nodeType === MapNodeType.POKEMON_CENTER ? 90 : 48}
                    opacity={nodeOpacity}
                    style={isMissed
                      ? { filter: "grayscale(1)", ...(node.nodeType === MapNodeType.POKEMON_CENTER ? { imageRendering: "pixelated" as const } : {}) }
                      : node.nodeType === MapNodeType.POKEMON_CENTER ? { imageRendering: "pixelated" as const } : undefined}
                  />
                ) : (
                  <text
                    x={pos.cx}
                    y={pos.cy + (node.nodeType === MapNodeType.LEGENDARY_BOSS ? 21 : 11)}
                    textAnchor="middle"
                    fontSize={node.nodeType === MapNodeType.LEGENDARY_BOSS ? "60" : "30"}
                    fill={isMissed ? "#555" : "white"}
                    opacity={nodeOpacity}
                  >
                    {NODE_LABELS[node.nodeType]}
                  </text>
                )}
                {(isAvailable || isHovered) && (
                  <text
                    x={pos.cx}
                    y={pos.cy + 42}
                    textAnchor="middle"
                    fontSize="12"
                    fill={isAvailable ? "#ccc" : "#999"}
                  >
                    {getNodeName()}
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
        {!readOnly && (
          <span style={{ fontSize: "12px", color: "#888" }}>
            Click an available node to proceed
          </span>
        )}
      </div>
    </div>
  )
}
