import React from "react"
import { Transfer } from "../../../../../types"
import { rooms } from "../../../network"

interface RestChoice {
  label: string
  description: string
}

interface GameRestProps {
  runHP: number
  choices: RestChoice[]
}

export default function GameRest({ runHP, choices }: GameRestProps) {
  const handleChoice = (index: number) => {
    rooms.game?.send(Transfer.CHOICE, { choiceId: "rest", choiceIndex: index })
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
        border: "2px solid #2ecc71",
        borderRadius: "12px",
        padding: "30px 40px",
        textAlign: "center",
        maxWidth: "500px"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "10px" }}>+</div>
        <h2 style={{ margin: "0 0 10px", color: "#2ecc71" }}>Pokemon Center</h2>
        <p style={{ fontSize: "16px", color: "#aaa", margin: "0 0 8px" }}>
          HP: {runHP}/100
        </p>
        <p style={{ fontSize: "14px", color: "#888", margin: "0 0 20px" }}>
          Choose one:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => handleChoice(i)}
              style={{
                padding: "12px 20px",
                fontSize: "14px",
                borderRadius: "6px",
                border: "1px solid #2ecc71",
                background: "#1a3a2e",
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
