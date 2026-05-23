import React from "react"
import { Transfer } from "../../../../../types"
import { rooms } from "../../../network"

interface GameRestProps {
  runHP: number
  healAmount: number
}

export default function GameRest({ runHP, healAmount }: GameRestProps) {
  const handleContinue = () => {
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
        border: "2px solid #2ecc71",
        borderRadius: "12px",
        padding: "30px 40px",
        textAlign: "center",
        maxWidth: "400px"
      }}>
        <div style={{ fontSize: "48px", marginBottom: "10px" }}>+</div>
        <h2 style={{ margin: "0 0 10px", color: "#2ecc71" }}>Pokemon Center</h2>
        <p style={{ fontSize: "18px", margin: "10px 0" }}>
          Your team has been healed!
        </p>
        <p style={{ fontSize: "24px", margin: "10px 0" }}>
          HP: {runHP}/100 (+{healAmount})
        </p>
        <button
          onClick={handleContinue}
          style={{
            marginTop: "15px",
            padding: "10px 30px",
            fontSize: "16px",
            borderRadius: "6px",
            border: "none",
            background: "#2ecc71",
            color: "white",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
