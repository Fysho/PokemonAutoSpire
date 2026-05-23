import React from "react"
import { Transfer } from "../../../../../types"
import { selectConnectedPlayer, useAppSelector } from "../../../hooks"
import { rooms } from "../../../network"

interface GameRewardProps {
  runHP: number
  gold: number
}

export default function GameReward({ runHP, gold }: GameRewardProps) {
  const connectedPlayer = useAppSelector(selectConnectedPlayer)
  const hasChoices = (connectedPlayer?.choices?.length ?? 0) > 0

  if (hasChoices) return null

  const handleContinue = () => {
    rooms.game?.send(Transfer.SKIP_REWARD)
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: "170px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        zIndex: 50
      }}
    >
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
