import React from "react"

interface GameRunEndProps {
  victory: boolean
  runHP: number
  battlesWon: number
  battlesLost: number
  totalGold: number
  difficultyMode: number
  eliteFourAvailable?: boolean
  currentAct?: number
}

const DIFFICULTY_LABELS: Record<number, string> = {
  0: "Easy",
  1: "Normal",
  2: "Hard"
}

const DIFFICULTY_COLORS: Record<number, string> = {
  0: "#27ae60",
  1: "#f39c12",
  2: "#e74c3c"
}

export default function GameRunEnd({
  victory,
  runHP,
  battlesWon,
  battlesLost,
  totalGold,
  difficultyMode,
  eliteFourAvailable = false,
  currentAct = 3
}: GameRunEndProps) {
  const diffLabel = DIFFICULTY_LABELS[difficultyMode] ?? "Normal"
  const diffColor = DIFFICULTY_COLORS[difficultyMode] ?? "#f39c12"

  const getTitle = () => {
    if (!victory) return "Defeated"
    if (currentAct === 4) return "Champion!"
    if (eliteFourAvailable) return "Victory!"
    return "Victory!"
  }

  const getSubtitle = () => {
    if (!victory) return null
    if (currentAct === 4) return "You conquered the Elite Four and became Champion!"
    if (eliteFourAvailable) return "The Elite Four awaits..."
    return null
  }

  const subtitle = getSubtitle()

  return (
    <div
      style={{
        position: "absolute",
        top: "60px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 200,
        color: "white",
        pointerEvents: "none"
      }}
    >
      <h1 style={{
        fontSize: "48px",
        margin: "0 0 4px",
        color: victory ? (currentAct === 4 ? "#f1c40f" : "#2ecc71") : "#e74c3c",
        textShadow: "0 2px 8px rgba(0,0,0,0.8)"
      }}>
        {getTitle()}
      </h1>
      {subtitle && (
        <span style={{
          fontSize: "18px",
          color: eliteFourAvailable ? "#f1c40f" : "#ccc",
          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          marginBottom: "4px",
          fontStyle: "italic"
        }}>
          {subtitle}
        </span>
      )}

      <span style={{
        fontSize: "16px",
        fontWeight: "bold",
        color: diffColor,
        textShadow: "0 1px 4px rgba(0,0,0,0.8)",
        marginBottom: "16px"
      }}>
        {diffLabel} Mode
      </span>

      <div style={{
        display: "grid",
        gridTemplateColumns: "auto auto",
        gap: "4px 16px",
        fontSize: "18px",
        textShadow: "0 1px 4px rgba(0,0,0,0.8)",
        background: "rgba(0,0,0,0.5)",
        borderRadius: "8px",
        padding: "12px 20px",
        marginBottom: "16px"
      }}>
        <span style={{ textAlign: "right", opacity: 0.7 }}>HP Remaining</span>
        <span style={{ fontWeight: "bold" }}>{runHP}</span>
        <span style={{ textAlign: "right", opacity: 0.7 }}>Battles Won</span>
        <span style={{ fontWeight: "bold", color: "#2ecc71" }}>{battlesWon}</span>
        <span style={{ textAlign: "right", opacity: 0.7 }}>Battles Lost</span>
        <span style={{ fontWeight: "bold", color: "#e74c3c" }}>{battlesLost}</span>
        <span style={{ textAlign: "right", opacity: 0.7 }}>Total Gold Earned</span>
        <span style={{ fontWeight: "bold", color: "#f1c40f" }}>{totalGold}</span>
      </div>
    </div>
  )
}
