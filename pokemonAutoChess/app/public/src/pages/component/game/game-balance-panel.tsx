import React from "react"
import { GamePhaseState } from "../../../../../types/enum/Game"
import { useAppSelector } from "../../../hooks"

const MODE_LABELS: Record<number, string> = { 0: "Easy", 1: "Normal", 2: "Hard" }
const MODE_COLORS: Record<number, string> = { 0: "#27ae60", 1: "#f39c12", 2: "#e74c3c" }

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
  if (mode === 1 || mode === 2) return 0
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
  const modeLabel = MODE_LABELS[difficultyMode] ?? "Normal"
  const modeColor = MODE_COLORS[difficultyMode] ?? "#f39c12"
  const offsetStr = offset === 0 ? "" : offset > 0 ? ` (+${offset}★)` : ` (${offset}★)`

  return (
    <div style={{
      position: "absolute",
      bottom: "10px",
      right: "10px",
      background: "rgba(0, 0, 0, 0.85)",
      border: "2px solid #f39c12",
      borderRadius: "8px",
      padding: "10px 14px",
      color: "white",
      fontFamily: "monospace",
      fontSize: "13px",
      zIndex: 200,
      minWidth: "180px",
      lineHeight: "1.6"
    }}>
      <div style={{ color: "#f39c12", fontWeight: "bold", fontSize: "14px", marginBottom: "6px", borderBottom: "1px solid #555", paddingBottom: "4px" }}>
        Balance Info
      </div>
      <div>Mode: <span style={{ color: modeColor, fontWeight: "bold" }}>{modeLabel}{offsetStr}</span></div>
      <div>Act <span style={{ color: "#3498db" }}>{currentAct}</span> Floor <span style={{ color: "#3498db" }}>{currentFloor}</span></div>
      <div>Progress: <span style={{ color: "#3498db" }}>{progress}</span>/60</div>
      <div style={{ marginTop: "4px", borderTop: "1px solid #333", paddingTop: "4px" }}>
        <div>Difficulty: <span style={{ color: "#e74c3c", fontWeight: "bold", fontSize: "16px" }}>{encounterDifficulty}</span></div>
        <div>Pokemon: <span style={{ color: "#2ecc71" }}>{encounterPokemonCount}</span></div>
        <div>Star Range: <span style={{ color: "#f1c40f" }}>{starMin}–{starMax}</span></div>
        <div>Total Stars: <span style={{ color: "#f1c40f" }}>{encounterTotalStars}</span></div>
        <div>Total Items: <span style={{ color: "#9b59b6" }}>{encounterTotalItems}</span></div>
      </div>
    </div>
  )
}
