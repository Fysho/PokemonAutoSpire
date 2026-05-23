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
  currentAct,
  currentFloor,
  items,
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
      <div style={{
        textAlign: "center",
        maxWidth: "500px"
      }}>
        <div style={{ fontSize: "64px", marginBottom: "10px" }}>
          {victory ? "🏆" : "💀"}
        </div>
        <h1 style={{
          fontSize: "36px",
          margin: "0 0 10px",
          color: victory ? "#2ecc71" : "#e74c3c"
        }}>
          {victory ? "Victory!" : "Defeated"}
        </h1>
        <p style={{ fontSize: "18px", color: "#aaa", margin: "0 0 20px" }}>
          {victory
            ? "You conquered all three acts and defeated the Weather Trio!"
            : `You fell in Act ${currentAct}, Floor ${currentFloor}`
          }
        </p>

        <div style={{
          background: "rgba(255,255,255,0.1)",
          borderRadius: "8px",
          padding: "15px 20px",
          marginBottom: "20px",
          textAlign: "left"
        }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "16px" }}>Run Summary</h3>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span>Acts Completed:</span>
            <span>{victory ? 3 : currentAct - 1}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span>Floors Cleared:</span>
            <span>{victory ? 45 : (currentAct - 1) * 15 + currentFloor}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span>Relics Collected:</span>
            <span>{items.length}</span>
          </div>
        </div>

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
          New Run
        </button>
      </div>
    </div>
  )
}
