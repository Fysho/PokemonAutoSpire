import React from "react"
import { GamePhaseState } from "../../../../../types/enum/Game"
import { useAppSelector } from "../../../hooks"
import "./game-balance-panel.css"

const MODE_LABELS: Record<number, string> = { 0: "Easy", 1: "Normal", 2: "Hard", 3: "Impossible" }
const MODE_COLORS: Record<number, string> = { 0: "#27ae60", 1: "#f39c12", 2: "#e74c3c", 3: "#6a0dad" }

function getStarBudgetRange(act: number, floor: number): [number, number] {
  const progress = (act - 1) * 20 + floor
  if (progress <= 1) return [1, 1]
  if (progress <= 3) return [2, 2]
  if (progress <= 5) return [2, 3]
  if (progress <= 8) return [4, 5]
  if (progress <= 12) return [4, 6]
  if (progress <= 16) return [6, 8]
  if (progress <= 20) return [7, 9]
  if (progress <= 25) return [8, 12]
  if (progress <= 30) return [10, 14]
  if (progress <= 35) return [12, 16]
  if (progress <= 40) return [14, 17]
  if (progress <= 45) return [15, 20]
  if (progress <= 50) return [17, 23]
  return [19, 25]
}

function getStarOffset(act: number, floor: number, mode: number): number {
  if (mode >= 1) return 0
  const progress = (act - 1) * 20 + floor
  if (progress <= 8) return 0
  if (act === 1) return -2
  if (act === 2) return -3
  return -4
}

export default function GameBalancePanel() {
  const phase = useAppSelector((state) => state.game.phase)
  const currentAct = useAppSelector((state) => state.game.currentAct)
  const currentFloor = useAppSelector((state) => state.game.currentFloor)
  const difficultyMode = useAppSelector((state) => state.game.difficultyMode)
  const isEndless = useAppSelector((state) => state.game.isEndless)
  const encounterDifficulty = useAppSelector((state) => state.game.encounterDifficulty)
  const encounterPokemonCount = useAppSelector((state) => state.game.encounterPokemonCount)
  const encounterTotalStars = useAppSelector((state) => state.game.encounterTotalStars)
  const encounterTotalItems = useAppSelector((state) => state.game.encounterTotalItems)

  const showPanel = phase === GamePhaseState.PICK || phase === GamePhaseState.FIGHT

  if (!showPanel) return null

  const progress = (currentAct - 1) * 20 + currentFloor
  const [baseMin, baseMax] = getStarBudgetRange(currentAct, currentFloor)
  const offset = getStarOffset(currentAct, currentFloor, difficultyMode)
  const starMin = Math.max(1, baseMin + offset)
  const starMax = Math.max(1, baseMax + offset)
  const modeLabel = isEndless ? "Endless" : (MODE_LABELS[difficultyMode] ?? "Normal")
  const modeColor = isEndless ? "#1abc9c" : (MODE_COLORS[difficultyMode] ?? "#f39c12")
  const offsetStr = offset === 0 ? "" : offset > 0 ? ` (+${offset}★)` : ` (${offset}★)`

  return (
    <div className="my-container game-balance-panel" style={{
      position: "absolute",
      bottom: "10px",
      right: "10px",
      padding: "8px 12px",
      fontSize: "12px",
      zIndex: 200,
      minWidth: "170px",
      lineHeight: "1.5",
      opacity: 0.9
    }}>
      <header style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "4px", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "4px" }}>
        Balance Info
      </header>
      <div>Mode: <strong style={{ color: modeColor }}>{modeLabel}</strong>{offsetStr}</div>
      <div>Act {currentAct} Floor {currentFloor}</div>
      <div>Progress: {progress}/60</div>
      <div style={{ marginTop: "4px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "4px" }}>
        <div>Difficulty: <strong>{encounterDifficulty}</strong></div>
        <div>Pokemon: {encounterPokemonCount}</div>
        <div>Star Range: {starMin}–{starMax}</div>
        <div>Total Stars: {encounterTotalStars}</div>
        <div>Total Items: {encounterTotalItems}</div>
      </div>
    </div>
  )
}
