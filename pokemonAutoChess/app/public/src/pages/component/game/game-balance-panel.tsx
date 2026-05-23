import React from "react"
import { GamePhaseState } from "../../../../../types/enum/Game"
import { useAppSelector } from "../../../hooks"

export default function GameBalancePanel() {
  const phase = useAppSelector((state) => state.game.phase)
  const currentAct = useAppSelector((state) => state.game.currentAct)
  const currentFloor = useAppSelector((state) => state.game.currentFloor)
  const encounterDifficulty = useAppSelector((state) => state.game.encounterDifficulty)
  const encounterPokemonCount = useAppSelector((state) => state.game.encounterPokemonCount)
  const encounterTotalStars = useAppSelector((state) => state.game.encounterTotalStars)
  const encounterTotalItems = useAppSelector((state) => state.game.encounterTotalItems)

  const showPanel = phase === GamePhaseState.PICK || phase === GamePhaseState.FIGHT

  if (!showPanel) return null

  const progress = (currentAct - 1) * 20 + currentFloor

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
      <div>Act <span style={{ color: "#3498db" }}>{currentAct}</span> Floor <span style={{ color: "#3498db" }}>{currentFloor}</span></div>
      <div>Progress: <span style={{ color: "#3498db" }}>{progress}</span>/60</div>
      <div style={{ marginTop: "4px", borderTop: "1px solid #333", paddingTop: "4px" }}>
        <div>Difficulty: <span style={{ color: "#e74c3c", fontWeight: "bold", fontSize: "16px" }}>{encounterDifficulty}</span></div>
        <div>Pokemon: <span style={{ color: "#2ecc71" }}>{encounterPokemonCount}</span></div>
        <div>Total Stars: <span style={{ color: "#f1c40f" }}>{encounterTotalStars}</span></div>
        <div>Total Items: <span style={{ color: "#9b59b6" }}>{encounterTotalItems}</span></div>
      </div>
    </div>
  )
}
