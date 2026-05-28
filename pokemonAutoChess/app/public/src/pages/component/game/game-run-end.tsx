import React from "react"
import DraggableWindow from "../modal/draggable-window"
import { usePreference } from "../../../preferences"

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
  isNewArceusRecord?: boolean
  previousArceusRecord?: number
  previousArceusHolder?: string
  onEnterEliteFour?: () => void
  onChallengeArceus?: () => void
  onBackToLobby?: () => void
}

const DIFFICULTY_LABELS: Record<number, string> = {
  0: "Easy",
  1: "Normal",
  2: "Hard",
  3: "Impossible"
}

const DIFFICULTY_COLORS: Record<number, string> = {
  0: "#27ae60",
  1: "#f39c12",
  2: "#e74c3c",
  3: "#6a0dad"
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
  isNewArceusRecord = false,
  previousArceusRecord = 0,
  previousArceusHolder = "",
  onEnterEliteFour,
  onChallengeArceus,
  onBackToLobby
}: GameRunEndProps) {
  const [savedPosition, setSavedPosition] = usePreference("runEndPosition")
  const diffLabel = DIFFICULTY_LABELS[difficultyMode] ?? "Normal"
  const diffColor = DIFFICULTY_COLORS[difficultyMode] ?? "#f39c12"
  const isArceusEnd = currentAct === 5 && arceusDamageDealt > 0

  const getTitle = () => {
    if (isArceusEnd && isNewArceusRecord) return "NEW RECORD!"
    if (isArceusEnd) return "Game Over"
    if (!victory) return "Defeated"
    if (currentAct === 4) return "Champion!"
    if (eliteFourAvailable) return "Victory!"
    return "Victory!"
  }

  const getSubtitle = () => {
    if (isArceusEnd && isNewArceusRecord && previousArceusHolder) {
      return `You took the record from ${previousArceusHolder}!`
    }
    if (isArceusEnd && isNewArceusRecord) {
      return "You set the first Arceus damage record!"
    }
    if (isArceusEnd) return "Your score is the damage dealt to Arceus."
    if (!victory) return null
    if (currentAct === 4) return "You are the new Champion!"
    if (eliteFourAvailable) return "The Elite Four awaits..."
    return null
  }

  const subtitle = getSubtitle()
  const showArceus = currentAct === 4
  const showEliteFour = eliteFourAvailable

  const defaultPosition = savedPosition?.x || savedPosition?.y
    ? savedPosition
    : { x: Math.floor((window.innerWidth - 320) / 2), y: 20 }

  return (
    <>
      <DraggableWindow
        title={getTitle()}
        className="my-container"
        style={{ zIndex: 200, width: "320px" }}
        initialPosition={defaultPosition}
        onMove={setSavedPosition}
      >
        <div style={{
          display: "flex",
          flexDirection: "column",
          padding: "4px 0"
        }}>
          {subtitle && (
            <span style={{
              fontSize: "16px",
              color: isNewArceusRecord ? "#f1c40f" : eliteFourAvailable ? "#f1c40f" : "#ccc",
              marginBottom: "4px",
              fontStyle: "italic",
              textAlign: "center"
            }}>
              {subtitle}
            </span>
          )}

          <span style={{
            fontSize: "15px",
            fontWeight: "bold",
            color: diffColor,
            marginBottom: "8px",
            textAlign: "center"
          }}>
            {diffLabel} Mode
          </span>

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "4px 16px",
            fontSize: "17px"
          }}>
            {isArceusEnd && <>
              <span style={{ opacity: 0.7 }}>Damage to Arceus</span>
              <span style={{ fontWeight: "bold", color: "#f1c40f", textAlign: "right" }}>
                {arceusDamageDealt.toLocaleString()}
              </span>
            </>}
            {isArceusEnd && previousArceusRecord > 0 && !isNewArceusRecord && <>
              <span style={{ opacity: 0.7 }}>Record</span>
              <span style={{ fontWeight: "bold", textAlign: "right" }}>
                {previousArceusRecord.toLocaleString()} ({previousArceusHolder})
              </span>
            </>}
            {isArceusEnd && isNewArceusRecord && previousArceusRecord > 0 && <>
              <span style={{ opacity: 0.7 }}>Previous Record</span>
              <span style={{ opacity: 0.7, textAlign: "right" }}>
                {previousArceusRecord.toLocaleString()} ({previousArceusHolder})
              </span>
            </>}
            <span style={{ opacity: 0.7 }}>HP Remaining</span>
            <span style={{ fontWeight: "bold", textAlign: "right" }}>{runHP}</span>
            <span style={{ opacity: 0.7 }}>Battles Won</span>
            <span style={{ fontWeight: "bold", color: "#2ecc71", textAlign: "right" }}>{battlesWon}</span>
            <span style={{ opacity: 0.7 }}>Battles Lost</span>
            <span style={{ fontWeight: "bold", color: "#e74c3c", textAlign: "right" }}>{battlesLost}</span>
            <span style={{ opacity: 0.7 }}>Gold Earned</span>
            <span style={{ fontWeight: "bold", color: "#f1c40f", textAlign: "right" }}>{totalGold}</span>
          </div>
        </div>
      </DraggableWindow>

      <div style={{
        position: "absolute",
        bottom: "200px",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        gap: "12px",
        zIndex: 200,
        pointerEvents: "none"
      }}>
        {showEliteFour && onEnterEliteFour && (
          <button
            className="bubbly"
            onClick={onEnterEliteFour}
            style={{ pointerEvents: "auto" }}
          >
            Enter the Elite Four
          </button>
        )}
        {showArceus && onChallengeArceus && (
          <button
            className="bubbly"
            onClick={onChallengeArceus}
            style={{ background: "#9b59b6", pointerEvents: "auto" }}
          >
            Challenge Arceus
          </button>
        )}
        {onBackToLobby && (
          <button
            className="bubbly"
            onClick={onBackToLobby}
            style={{
              background: victory ? "#2ecc71" : "#e74c3c",
              pointerEvents: "auto"
            }}
          >
            Back to Lobby
          </button>
        )}
      </div>
    </>
  )
}
