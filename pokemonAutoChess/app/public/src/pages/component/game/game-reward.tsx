import React from "react"
import { Transfer } from "../../../../../types"
import { rooms } from "../../../network"

interface GameRewardProps {
  runHP: number
  gold: number
}

export default function GameReward({ runHP, gold }: GameRewardProps) {
  const handleContinue = () => {
    rooms.game?.send(Transfer.SKIP_REWARD)
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        zIndex: 50
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.7)",
          borderRadius: "8px",
          padding: "10px 20px",
          color: "white",
          fontSize: "16px",
          display: "flex",
          gap: "20px"
        }}
      >
        <span>HP: {runHP}/100</span>
        <span>Gold: {gold}</span>
      </div>
      <button
        onClick={handleContinue}
        style={{
          padding: "8px 24px",
          fontSize: "16px",
          borderRadius: "6px",
          border: "2px solid #fff",
          background: "#2ecc71",
          color: "white",
          cursor: "pointer",
          fontWeight: "bold"
        }}
      >
        Continue to Map
      </button>
    </div>
  )
}
