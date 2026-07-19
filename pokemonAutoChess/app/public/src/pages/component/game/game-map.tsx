import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { RegionDetails } from "../../../../../config"
import { MapEdge, MapNode, MapNodeType } from "../../../../../models/colyseus-models/map-node"
import { Transfer } from "../../../../../types"
import { DungeonPMDO } from "../../../../../types/enum/Dungeon"
import { Synergy } from "../../../../../types/enum/Synergy"
import { rooms } from "../../../network"
import { Modal } from "../modal/modal"

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
  [MapNodeType.ARCEUS_BOSS]: "#f1c40f",
  [MapNodeType.ASYNC_FIGHT]: "#1abc9c"
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
  [MapNodeType.ARCEUS_BOSS]: "✦",
  [MapNodeType.ASYNC_FIGHT]: "⚔"
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
  [MapNodeType.ARCEUS_BOSS]: "ARCEUS",
  [MapNodeType.ASYNC_FIGHT]: "Trainer"
}

function getRegionSynergies(region: string): Synergy[] {
  if (!region || region === "") return []
  const details = RegionDetails[region as DungeonPMDO]
  return details?.synergies ?? []
}

const DIFFICULTY_MODE_LABELS: Record<number, string> = {
  0: "Easy",
  1: "Normal",
  2: "Hard",
  3: "Impossible"
}

interface GameMapProps {
  mapNodes: Map<string, MapNode>
  mapEdges: MapEdge[]
  currentAct: number
  currentFloor: number
  runHP: number
  difficultyMode?: number
  isEndless?: boolean
  onHide: () => void
  readOnly?: boolean
  showRerollMap?: boolean
  hasChoicesPending?: boolean
  canForfeitPendingChoices?: boolean
  isMapPhase?: boolean
  isAdmin?: boolean
}

export default function GameMap({
  mapNodes,
  mapEdges,
  currentAct,
  currentFloor,
  runHP,
  difficultyMode = 1,
  isEndless = false,
  onHide,
  readOnly = false,
  showRerollMap = false,
  hasChoicesPending = false,
  canForfeitPendingChoices = false,
  isMapPhase = false,
  isAdmin = false
}: GameMapProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Touch devices get a fullscreen map laid out horizontally (floors run
  // left → right, boss at the far right) — the underlying map data is
  // identical, only the projection changes. Same detection convention as
  // the rest of the mobile support ((pointer: coarse), not width).
  const [isMobile] = useState(
    () => window.matchMedia("(pointer: coarse)").matches
  )
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [warningText, setWarningText] = useState<string | null>(null)
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingForfeitNodeId, setPendingForfeitNodeId] = useState<
    string | null
  >(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  const showWarning = (msg: string) => {
    if (warningTimer.current) clearTimeout(warningTimer.current)
    setWarningText(msg)
    warningTimer.current = setTimeout(() => setWarningText(null), 2000)
  }

  const handleNodeClick = (nodeId: string) => {
    const node = mapNodes.get(nodeId)
    if (!node) return
    if (isAdmin && !node.available && !node.visited) {
      rooms.game?.send(Transfer.ADMIN_TELEPORT_NODE, nodeId)
      return
    }
    if (!node.available) return
    if (hasChoicesPending && canForfeitPendingChoices) {
      setPendingForfeitNodeId(nodeId)
      return
    }
    if (readOnly) {
      showWarning("Clear this floor first")
      return
    }
    if (hasChoicesPending) {
      showWarning("Select a reward first")
      return
    }
    // Ordinary node selection is legal only from MAP. A REWARD-phase click with
    // pending choices uses the confirmed, server-authoritative forfeit path above.
    // Admin teleport intentionally bypasses this phase guard.
    if (!isMapPhase && !isAdmin) {
      showWarning("Finish here first")
      return
    }
    rooms.game?.send(Transfer.SELECT_MAP_NODE, nodeId)
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

  // SVG uses painter's order for both display and pointer targeting. Render
  // available choices last so future nodes cannot cover or intercept them.
  const nodes = Array.from(mapNodes.values()).sort(
    (a, b) => Number(a.available) - Number(b.available)
  )
  const maxFloor = Math.max(...nodes.map((n) => n.floor), 1)
  const floorStep = 100
  // Desktop: vertical map (floors bottom → top) in a centered panel.
  // Mobile: horizontal map (floors left → right), so the main axis is the
  // width and the cross axis (where same-floor nodes spread out) is the height.
  const svgWidth = isMobile ? maxFloor * floorStep + 260 : 1000
  const svgHeight = isMobile ? 500 : maxFloor * floorStep + 200
  const crossSize = isMobile ? svgHeight : svgWidth
  const nodeSpread = isMobile ? crossSize * 0.7 : crossSize * 0.6
  const nodeOffset = isMobile ? crossSize * 0.15 : crossSize * 0.2

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
    // Cross-axis position (across the floor) + deterministic jitter along
    // both axes so same-floor nodes aren't perfectly aligned.
    const cross = nodeOffset + centeredX * nodeSpread
    const jCross = ((h % 61) - 30) * (isMobile ? 0.8 : 1.2)
    const jMain = (((h >> 8) % 41) - 20) * 0.6
    if (isMobile) {
      return {
        cx: node.floor * floorStep + 60 + jMain,
        cy: cross + jCross
      }
    }
    return {
      cx: cross + jCross,
      cy: svgHeight - (node.floor * floorStep + 40) + jMain
    }
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (isMobile) {
      // The svg is scaled to the container height, so convert viewBox
      // units to rendered pixels before centering the current floor.
      const scale = el.clientHeight > 0 ? el.clientHeight / svgHeight : 1
      const currentFloorX = (currentFloor * floorStep + 60) * scale
      el.scrollLeft = currentFloorX - el.clientWidth / 2
    } else {
      const currentFloorY = svgHeight - (currentFloor * floorStep + 40)
      el.scrollTop = currentFloorY - el.clientHeight / 2
    }
  }, [currentFloor, currentAct, svgHeight, svgWidth, isMobile])

  const title = `${currentAct === 4 ? "Elite Four" : `Act ${currentAct}`} - Floor ${currentFloor} (${isEndless ? "Endless" : DIFFICULTY_MODE_LABELS[difficultyMode] ?? "Normal"})`

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
        alignItems: isMobile ? "stretch" : "center",
        justifyContent: isMobile ? "flex-start" : "center",
        background: isMobile ? "#1a1a2e" : "rgba(0,0,0,0.85)",
        zIndex: 100,
        color: "white"
      }}
    >
      {/* Mobile: the map is fullscreen, so the poster backdrop is a fixed
          layer behind everything instead of scrolling with the svg. */}
      {isMobile && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: "url('assets/posters/hd/6.6.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.2,
          pointerEvents: "none"
        }} />
      )}

      {isMobile ? (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "6px 12px", position: "relative", zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "16px" }}>{title}</h2>
          <span style={{ fontSize: "13px" }}>HP: {runHP}/100</span>
          {showRerollMap && (
            <button
              onClick={() => rooms.game?.send(Transfer.REROLL_MAP)}
              style={{
                padding: "4px 12px",
                fontSize: "13px",
                borderRadius: "6px",
                border: "1px solid #666",
                background: "#333",
                color: "#ccc",
                cursor: "pointer"
              }}
            >
              Reroll Map
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button
            onClick={onHide}
            aria-label="Hide Map"
            style={{
              width: "40px",
              height: "40px",
              fontSize: "20px",
              lineHeight: 1,
              borderRadius: "8px",
              border: "1px solid #666",
              background: "#333",
              color: "#ccc",
              cursor: "pointer",
              flex: "0 0 auto"
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "24px" }}>{title}</h2>
          <div style={{ display: "flex", gap: "20px", marginBottom: "12px", fontSize: "16px" }}>
            <span>HP: {runHP}/100</span>
          </div>
        </>
      )}

      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={isMobile ? {
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          background: "transparent",
          userSelect: "none",
          position: "relative",
          WebkitOverflowScrolling: "touch"
        } : {
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
        {!isMobile && (
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
        )}
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          {...(isMobile ? {} : { width: "100%", height: svgHeight })}
          style={isMobile
            ? { position: "relative", display: "block", height: "100%", width: "auto", aspectRatio: `${svgWidth} / ${svgHeight}` }
            : { position: "relative" }}
        >
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
            <filter id="blue-outline" x="-10%" y="-10%" width="120%" height="120%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="expanded" />
              <feComposite in="expanded" in2="SourceAlpha" operator="out" result="ring" />
              <feFlood floodColor="#4488ff" floodOpacity="0.5" result="blue" />
              <feComposite in="blue" in2="ring" operator="in" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="blue-outline-hover" x="-15%" y="-15%" width="130%" height="130%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="expanded" />
              <feComposite in="expanded" in2="SourceAlpha" operator="out" result="ring" />
              <feFlood floodColor="#4488ff" floodOpacity="0.7" result="blue" />
              <feComposite in="blue" in2="ring" operator="in" result="outline" />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="blue-outline-dark" x="-15%" y="-15%" width="130%" height="130%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="expanded" />
              <feComposite in="expanded" in2="SourceAlpha" operator="out" result="ring" />
              <feFlood floodColor="#0044cc" floodOpacity="0.9" result="blue" />
              <feComposite in="blue" in2="ring" operator="in" result="outline" />
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
            const isAsyncFight = node.nodeType === MapNodeType.ASYNC_FIGHT
            const hasAvatar = (isElite || isUnlock || isE4 || isChampion || isAsyncFight) && !!node.eliteAvatar
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
                style={{ cursor: (isAvailable && !readOnly) || (isAdmin && !isVisited) ? "pointer" : "default" }}
              >
                <g filter={
                  isElite && isHovered ? "url(#red-outline-dark)" :
                  isElite && isAvailable ? "url(#red-outline-hover)" :
                  isElite ? "url(#red-outline)" :
                  isAsyncFight && isHovered ? "url(#blue-outline-dark)" :
                  isAsyncFight && isAvailable ? "url(#blue-outline-hover)" :
                  isAsyncFight ? "url(#blue-outline)" :
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
                  return (
                    <g opacity={nodeOpacity}>
                      {sprites.map((s, i) => {
                        const offset = (i - (sprites.length - 1) / 2) * spriteSize * 0.6
                        return (
                          <image
                            key={`boss-${node.id}-${i}`}
                            href={`/assets/ui/elite-sprites-v2/${s}.png`}
                            x={pos.cx + (isMobile ? 0 : offset) - spriteSize / 2}
                            y={pos.cy + (isMobile ? offset : 0) - spriteSize / 2}
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

      {isMobile ? (
        (warningText || !readOnly) && (
          <div style={{
            position: "absolute",
            bottom: "6px",
            left: 0,
            right: 0,
            textAlign: "center",
            pointerEvents: "none",
            zIndex: 1,
            textShadow: "0 1px 3px black"
          }}>
            {warningText ? (
              <span style={{ fontSize: "14px", color: "#e74c3c", fontWeight: "bold" }}>
                {warningText}
              </span>
            ) : (
              <span style={{ fontSize: "12px", color: "#bbb" }}>
                Tap an available node to proceed
              </span>
            )}
          </div>
        )
      ) : (
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
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
              Hide Map
            </button>
            {showRerollMap && (
              <button
                onClick={() => rooms.game?.send(Transfer.REROLL_MAP)}
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
                Reroll Map
              </button>
            )}
          </div>
          {warningText && (
            <span style={{ fontSize: "14px", color: "#e74c3c", fontWeight: "bold" }}>
              {warningText}
            </span>
          )}
          {!readOnly && !warningText && (
            <span style={{ fontSize: "12px", color: "#888" }}>
              Click an available node to proceed
            </span>
          )}
        </div>
      )}
      <Modal
        show={pendingForfeitNodeId !== null}
        header="Forfeit rewards?"
        body="If you proceed now you will forfeit current rewards"
        onClose={() => setPendingForfeitNodeId(null)}
        footer={
          <>
            <button
              className="bubbly red"
              onClick={() => {
                const nodeId = pendingForfeitNodeId
                if (!nodeId) return
                setPendingForfeitNodeId(null)
                rooms.game?.send(Transfer.SKIP_ALL_REWARDS, { nodeId })
              }}
            >
              Proceed
            </button>
            <button
              className="bubbly blue"
              onClick={() => setPendingForfeitNodeId(null)}
            >
              Cancel
            </button>
          </>
        }
      />
    </div>
  )
}
