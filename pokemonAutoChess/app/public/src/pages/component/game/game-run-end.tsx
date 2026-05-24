import React from "react"

interface GameRunEndProps {
  victory: boolean
  currentAct: number
  currentFloor: number
  items: string[]
  onNewRun: () => void
}

export default function GameRunEnd({
  victory,
  onNewRun
}: GameRunEndProps) {
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
        background: victory
          ? "radial-gradient(circle, rgba(46,204,113,0.3) 0%, rgba(0,0,0,0.9) 70%)"
          : "radial-gradient(circle, rgba(231,76,60,0.3) 0%, rgba(0,0,0,0.9) 70%)",
        zIndex: 200,
        color: "white"
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{
          fontSize: "48px",
          margin: "0 0 30px",
          color: victory ? "#2ecc71" : "#e74c3c"
        }}>
          {victory ? "Victory!" : "Defeated"}
        </h1>

        <button
          onClick={onNewRun}
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
          Play Again
        </button>
      </div>
    </div>
  )
}
