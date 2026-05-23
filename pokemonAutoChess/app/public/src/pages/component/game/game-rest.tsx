import React, { useState } from "react"
import { Transfer } from "../../../../../types"
import { DEPTH } from "../../../game/depths"
import { rooms } from "../../../network"
import { playSound, SOUNDS } from "../../utils/audio"
import "./game-choice.css"

interface RestChoice {
  label: string
  description: string
}

interface GameRestProps {
  runHP: number
  choices: RestChoice[]
}

export default function GameRest({ runHP, choices }: GameRestProps) {
  const [visible, setVisible] = useState(true)

  const handleChoice = (index: number) => {
    playSound(SOUNDS.BUTTON_CLICK)
    rooms.game?.send(Transfer.CHOICE, { choiceId: "rest", choiceIndex: index })
  }

  if (choices.length === 0) return null

  return (
    <div className="game-choice" style={{ zIndex: DEPTH.MODAL }}>
      <div
        className="my-container"
        style={{ visibility: visible ? "visible" : "hidden" }}
      >
        <h2>Pokemon Center (HP: {runHP}/100)</h2>

        <div className="game-choice-items-list">
          {choices.map((choice, i) => (
            <div
              key={i}
              className="my-box active clickable"
              onClick={(e) => {
                e.stopPropagation()
                handleChoice(i)
              }}
            >
              <h3 style={{ margin: "0.25em 0" }}>{choice.label}</h3>
              <p style={{ marginBottom: "0.5em" }}>{choice.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="show-hide-action">
        <button
          className="bubbly orange active"
          onClick={() => setVisible(!visible)}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  )
}
