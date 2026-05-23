import React from "react"
import { Transfer } from "../../../../../types"
import { rooms } from "../../../network"

interface EventChoice {
  label: string
  description: string
}

interface GameEventProps {
  eventName: string
  eventDescription: string
  choices: EventChoice[]
  runHP: number
  gold: number
}

export default function GameEvent({
  eventName,
  eventDescription,
  choices,
  runHP,
  gold
}: GameEventProps) {
  const handleChoice = (index: number) => {
    rooms.game?.send(Transfer.CHOICE, { choiceId: "event", choiceIndex: index })
    rooms.game?.send(Transfer.SKIP_REWARD)
  }

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
      <div style={{
        background: "#1a1a2e",
        border: "2px solid #9b59b6",
        borderRadius: "12px",
        padding: "30px 40px",
        textAlign: "center",
        maxWidth: "500px"
      }}>
        <div style={{ fontSize: "36px", marginBottom: "8px" }}>?</div>
        <h2 style={{ margin: "0 0 8px", color: "#9b59b6" }}>{eventName}</h2>
        <p style={{ fontSize: "14px", color: "#aaa", margin: "0 0 20px" }}>
          {eventDescription}
        </p>
        <div style={{ display: "flex", gap: "8px", marginBottom: "15px", justifyContent: "center", fontSize: "14px" }}>
          <span>HP: {runHP}/100</span>
          <span>Gold: {gold}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => handleChoice(i)}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                borderRadius: "6px",
                border: "1px solid #9b59b6",
                background: "#2d1b4e",
                color: "white",
                cursor: "pointer",
                textAlign: "left"
              }}
            >
              <strong>{choice.label}</strong>
              <div style={{ fontSize: "12px", color: "#aaa", marginTop: "4px" }}>
                {choice.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
