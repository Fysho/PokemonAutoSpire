import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
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
  [MapNodeType.UNLOCK]: "#c0392b",
  [MapNodeType.POKEMART]: "#3498db",
  [MapNodeType.POKEMON_CENTER]: "#2ecc71",
  [MapNodeType.MYSTERY_ENCOUNTER]: "#9b59b6",
  [MapNodeType.LEGENDARY_BOSS]: "#e67e22",
  [MapNodeType.ELITE_FOUR]: "#8e44ad",
  [MapNodeType.CHAMPION]: "#f1c40f",
  [MapNodeType.ARCEUS_BOSS]: "#f1c40f"
}

const NODE_ICONS: Record<string, string> = {
  [MapNodeType.POKEMART]: "/assets/ui/pokemart-sprite.png",
  [MapNodeType.MYSTERY_ENCOUNTER]: "/assets/unown/unown-qm.png",
  [MapNodeType.POKEMON_CENTER]: "/assets/ui/pokecenter-sprite.png"
}

const NODE_LABELS: Record<string, string> = {
  [MapNodeType.GYM_LEADER]: "🏅",
  [MapNodeType.ELITE]: "⚔️",
  [MapNodeType.UNLOCK]: "⚔️",
  [MapNodeType.LEGENDARY_BOSS]: "👑",
  [MapNodeType.ELITE_FOUR]: "🏆",
  [MapNodeType.CHAMPION]: "👑",
  [MapNodeType.ARCEUS_BOSS]: "✦"
}

const NODE_NAMES: Record<string, string> = {
  [MapNodeType.WILD_BATTLE]: "Wild Battle",
  [MapNodeType.GYM_LEADER]: "Gym Leader",
  [MapNodeType.ELITE]: "Elite",
  [MapNodeType.UNLOCK]: "Unlock",
  [MapNodeType.POKEMART]: "PokeMart",
  [MapNodeType.POKEMON_CENTER]: "Pokemon Center",
  [MapNodeType.MYSTERY_ENCOUNTER]: "Mystery",
  [MapNodeType.LEGENDARY_BOSS]: "BOSS",
  [MapNodeType.ELITE_FOUR]: "Elite Four",
  [MapNodeType.CHAMPION]: "CHAMPION",
  [MapNodeType.ARCEUS_BOSS]: "ARCEUS"
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
  const svgHeight = maxFloor * floorHeight + 200
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

  useLayoutEffect(() => {
    if (scrollRef.current) {
      const currentFloorY = svgHeight - (currentFloor * floorHeight + 40)
      const containerHeight = scrollRef.current.clientHeight
      scrollRef.current.scrollTop = currentFloorY - containerHeight / 2
    }
  }, [currentFloor, currentAct, svgHeight])

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
        {currentAct === 4 ? "Elite Four" : `Act ${currentAct}`} - Floor {currentFloor}
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
          border: "2px solid #999",
          borderRadius: "8px",
          background: "#1a1a2e",
          padding: "10px",
          cursor: "grab",
          userSelect: "none",
          position: "relative"
        }}
      >
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: svgHeight + 20,
          backgroundImage: "url('assets/posters/hd/6.6.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.2,
          pointerEvents: "none"
        }} />
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height={svgHeight} style={{ position: "relative" }}>
          <defs>
            <filter id="white-outline" x="-10%" y="-10%" width="120%" height="120%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="expanded" />
              <feFlood floodColor="white" floodOpacity="1" result="white" />
              <feComposite in="white" in2="expanded" operator="in" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="white-outline-hover" x="-15%" y="-15%" width="130%" height="130%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="expanded" />
              <feFlood floodColor="white" floodOpacity="1" result="white" />
              <feComposite in="white" in2="expanded" operator="in" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="red-outline" x="-10%" y="-10%" width="120%" height="120%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="expanded" />
              <feComposite in="expanded" in2="SourceAlpha" operator="out" result="ring" />
              <feFlood floodColor="#ff4444" floodOpacity="0.5" result="red" />
              <feComposite in="red" in2="ring" operator="in" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="red-outline-hover" x="-15%" y="-15%" width="130%" height="130%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="expanded" />
              <feComposite in="expanded" in2="SourceAlpha" operator="out" result="ring" />
              <feFlood floodColor="#ff4444" floodOpacity="0.7" result="red" />
              <feComposite in="red" in2="ring" operator="in" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="red-outline-dark" x="-15%" y="-15%" width="130%" height="130%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="expanded" />
              <feComposite in="expanded" in2="SourceAlpha" operator="out" result="ring" />
              <feFlood floodColor="#cc0000" floodOpacity="0.9" result="red" />
              <feComposite in="red" in2="ring" operator="in" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
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
                stroke={bothVisited ? "#aaa" : eitherMissed ? "#444" : "#999"}
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
            const isE4 = node.nodeType === MapNodeType.ELITE_FOUR
            const isChampion = node.nodeType === MapNodeType.CHAMPION
            const isUnlock = node.nodeType === MapNodeType.UNLOCK
            const isElite = node.nodeType === MapNodeType.ELITE
            const hasAvatar = (isElite || isUnlock || isE4 || isChampion) && !!node.eliteAvatar
            const isBoss = (node.nodeType === MapNodeType.LEGENDARY_BOSS || node.nodeType === MapNodeType.ARCEUS_BOSS) && !!node.bossSprites
            const hasSynergyIcon = (isWild && synergies.length > 0) || ((isGym || isE4) && node.gymLeaderSynergy) || hasAvatar || isBoss
            const nodeRadius = isBoss ? 48 : hasSynergyIcon ? 28 : (isAvailable ? 24 : 20)
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
                <g filter={
                  isElite && isHovered ? "url(#red-outline-dark)" :
                  isElite && isAvailable ? "url(#red-outline-hover)" :
                  isElite ? "url(#red-outline)" :
                  isHovered ? "url(#white-outline-hover)" :
                  isAvailable ? "url(#white-outline)" :
                  undefined
                }>
                {isBoss ? (() => {
                  const sprites = node.bossSprites.split(",").filter(Boolean)
                  const isArceus = node.nodeType === MapNodeType.ARCEUS_BOSS
                  const spriteSize = isArceus ? 192 : 144
                  if (sprites.length === 1) {
                    return (
                      <image
                        href={`/assets/ui/elite-sprites-v2/${sprites[0]}.png`}
                        x={pos.cx - spriteSize / 2}
                        y={pos.cy - spriteSize / 2}
                        width={spriteSize}
                        height={spriteSize}
                        opacity={nodeOpacity}
                        style={{ imageRendering: "pixelated" as const, ...(isMissed ? { filter: "grayscale(1)" } : {}) }}
                      />
                    )
                  }
                  const totalWidth = sprites.length * spriteSize * 0.6
                  return (
                    <g opacity={nodeOpacity}>
                      {sprites.map((s, i) => {
                        const ox = (i - (sprites.length - 1) / 2) * spriteSize * 0.6
                        return (
                          <image
                            key={`boss-${node.id}-${i}`}
                            href={`/assets/ui/elite-sprites-v2/${s}.png`}
                            x={pos.cx + ox - spriteSize / 2}
                            y={pos.cy - spriteSize / 2}
                            width={spriteSize}
                            height={spriteSize}
                            style={{ imageRendering: "pixelated" as const, ...(isMissed ? { filter: "grayscale(1)" } : {}) }}
                          />
                        )
                      })}
                    </g>
                  )
                })()
                : (isGym || isE4) && node.gymLeaderSynergy ? (
                  <image
                    href={`/assets/item/${node.gymLeaderSynergy}_GEM.png`}
                    x={pos.cx - 27}
                    y={pos.cy - 27}
                    width={54}
                    height={54}
                    opacity={nodeOpacity}
                    style={isMissed ? { filter: "grayscale(1)" } : undefined}
                  />
                ) : hasAvatar ? (() => {
                  const spriteSize = isChampion ? 216 : 108
                  return (
                  <foreignObject
                    x={pos.cx - spriteSize / 2}
                    y={pos.cy - spriteSize / 2}
                    width={spriteSize}
                    height={spriteSize}
                    opacity={nodeOpacity}
                  >
                    <img
                      src={`/assets/ui/elite-sprites-v2/${node.eliteAvatar}.png`}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement
                        img.style.display = "none"
                        const fallback = img.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = "flex"
                      }}
                      style={{
                        width: "100%", height: "100%",
                        objectFit: "contain",
                        imageRendering: "pixelated" as const,
                        ...(isMissed ? { filter: "grayscale(1)" } : {})
                      }}
                    />
                    <div style={{
                      display: "none",
                      width: spriteSize, height: spriteSize,
                      alignItems: "center", justifyContent: "center",
                      fontSize: "48px", fontWeight: "bold", color: "#fff",
                      textShadow: "2px 2px 4px #000", pointerEvents: "none"
                    }}>?</div>
                  </foreignObject>
                  )
                })()
                : isWild && synergies.length > 0 ? (
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
                    x={pos.cx - (node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 48 : 36)}
                    y={pos.cy - (node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 48 : 36)}
                    width={node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 96 : 72}
                    height={node.nodeType === MapNodeType.MYSTERY_ENCOUNTER ? 96 : 72}
                    opacity={nodeOpacity}
                    style={{ imageRendering: "pixelated" as const, ...(isMissed ? { filter: "grayscale(1)" } : {}) }}
                  />
                ) : (
                  <text
                    x={pos.cx}
                    y={pos.cy + (node.nodeType === MapNodeType.LEGENDARY_BOSS || node.nodeType === MapNodeType.CHAMPION ? 21 : 11)}
                    textAnchor="middle"
                    fontSize={node.nodeType === MapNodeType.LEGENDARY_BOSS || node.nodeType === MapNodeType.CHAMPION ? "60" : "30"}
                    fill={isMissed ? "#555" : "white"}
                    opacity={nodeOpacity}
                  >
                    {NODE_LABELS[node.nodeType]}
                  </text>
                )}
                </g>
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
