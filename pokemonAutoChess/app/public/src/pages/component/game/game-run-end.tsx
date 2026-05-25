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
  arceusDamageDealt?: number
  onEnterEliteFour?: () => void
  onChallengeArceus?: () => void
  onBackToLobby?: () => void
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
  currentAct = 3,
  arceusDamageDealt = 0,
  onEnterEliteFour,
  onChallengeArceus,
  onBackToLobby
}: GameRunEndProps) {
  const diffLabel = DIFFICULTY_LABELS[difficultyMode] ?? "Normal"
  const diffColor = DIFFICULTY_COLORS[difficultyMode] ?? "#f39c12"
  const isArceusEnd = currentAct === 5 && arceusDamageDealt > 0

  const getTitle = () => {
    if (isArceusEnd) return "You Tried"
    if (!victory) return "Defeated"
    if (currentAct === 4) return "Champion!"
    if (eliteFourAvailable) return "Victory!"
    return "Victory!"
  }

  const getSubtitle = () => {
    if (!victory) return null
    if (currentAct === 4) return "You are the new Champion!"
    if (eliteFourAvailable) return "The Elite Four awaits..."
    return null
  }

  const subtitle = getSubtitle()
  const showArceus = currentAct === 4
  const showEliteFour = eliteFourAvailable

  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 200,
        color: "white",
        pointerEvents: "none"
      }}
    >
      <h1 style={{
        fontSize: "42px",
        margin: "0 0 2px",
        color: victory ? (currentAct === 4 ? "#f1c40f" : "#2ecc71") : "#e74c3c",
        textShadow: "0 2px 8px rgba(0,0,0,0.8)"
      }}>
        {getTitle()}
      </h1>
      {subtitle && (
        <span style={{
          fontSize: "16px",
          color: eliteFourAvailable ? "#f1c40f" : "#ccc",
          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          marginBottom: "4px",
          fontStyle: "italic"
        }}>
          {subtitle}
        </span>
      )}

      <span style={{
        fontSize: "14px",
        fontWeight: "bold",
        color: diffColor,
        textShadow: "0 1px 4px rgba(0,0,0,0.8)",
        marginBottom: "8px"
      }}>
        {diffLabel} Mode
      </span>

      <div style={{
        display: "grid",
        gridTemplateColumns: "auto auto",
        gap: "3px 12px",
        fontSize: "15px",
        textShadow: "0 1px 4px rgba(0,0,0,0.8)",
        background: "rgba(0,0,0,0.6)",
        borderRadius: "8px",
        padding: "10px 16px"
      }}>
        {isArceusEnd && <>
          <span style={{ textAlign: "right", opacity: 0.7 }}>Damage to Arceus</span>
          <span style={{ fontWeight: "bold", color: "#f1c40f" }}>{arceusDamageDealt.toLocaleString()}</span>
        </>}
        <span style={{ textAlign: "right", opacity: 0.7 }}>HP Remaining</span>
        <span style={{ fontWeight: "bold" }}>{runHP}</span>
        <span style={{ textAlign: "right", opacity: 0.7 }}>Battles Won</span>
        <span style={{ fontWeight: "bold", color: "#2ecc71" }}>{battlesWon}</span>
        <span style={{ textAlign: "right", opacity: 0.7 }}>Battles Lost</span>
        <span style={{ fontWeight: "bold", color: "#e74c3c" }}>{battlesLost}</span>
        <span style={{ textAlign: "right", opacity: 0.7 }}>Gold Earned</span>
        <span style={{ fontWeight: "bold", color: "#f1c40f" }}>{totalGold}</span>
      </div>

      <div style={{
        display: "flex",
        gap: "12px",
        marginTop: "12px",
        pointerEvents: "auto"
      }}>
        {showEliteFour && onEnterEliteFour && (
          <button
            className="bubbly"
            onClick={onEnterEliteFour}
          >
            Enter the Elite Four
          </button>
        )}
        {showArceus && onChallengeArceus && (
          <button
            className="bubbly"
            onClick={onChallengeArceus}
            style={{ background: "#9b59b6" }}
          >
            Challenge Arceus
          </button>
        )}
        {onBackToLobby && (
          <button
            onClick={onBackToLobby}
            style={{
              padding: "12px 36px",
              fontSize: "18px",
              borderRadius: "8px",
              border: "none",
              background: victory ? "#2ecc71" : "#e74c3c",
              color: "white",
              cursor: "pointer",
              fontWeight: "bold",
              boxShadow: `0 4px 12px ${victory ? "rgba(46,204,113,0.4)" : "rgba(231,76,60,0.4)"}`
            }}
          >
            Back to Lobby
          </button>
        )}
      </div>
    </div>
  )
}
