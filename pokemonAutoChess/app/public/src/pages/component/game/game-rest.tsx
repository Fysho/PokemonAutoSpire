import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { Transfer } from "../../../../../types"
import { Item } from "../../../../../types/enum/Item"
import { Pkm } from "../../../../../types/enum/Pokemon"
import { DEPTH } from "../../../game/depths"
import { rooms } from "../../../network"
import { playSound, SOUNDS } from "../../utils/audio"
import { addIconsToDescription } from "../../utils/descriptions"
import GamePokemonPortrait from "./game-pokemon-portrait"
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
  const { t } = useTranslation()
  const [visible, setVisible] = useState(true)

  const handleChoice = (index: number) => {
    playSound(SOUNDS.BUTTON_CLICK)
    rooms.game?.send(Transfer.CHOICE, { choiceId: "rest", choiceIndex: index })
  }

  if (choices.length === 0) return null

  const componentItem = choices[1]?.description as Item
  const dojoTicket = choices[2]?.description as Item

  return (
    <div className="game-choice" style={{ zIndex: DEPTH.MODAL }}>
      <div
        className="my-container"
        style={{ visibility: visible ? "visible" : "hidden" }}
      >
        <h2>Pokemon Center (HP: {runHP}/100)</h2>

        <div className="game-choice-pokemons-list">
          {/* Heal 30 HP */}
          <div
            className="my-box active clickable"
            onClick={(e) => {
              e.stopPropagation()
              handleChoice(0)
            }}
          >
            <img
              style={{ width: "4rem", height: "4rem" }}
              src="assets/item/ORAN_BERRY.png"
            />
            <h3 style={{ margin: "0.25em 0" }}>{choices[0].label}</h3>
            <p style={{ marginBottom: "0.5em", fontSize: "80%" }}>
              {choices[0].description}
            </p>
          </div>

          {/* Ditto + item component */}
          <div
            className="my-box active clickable"
            onClick={(e) => {
              e.stopPropagation()
              handleChoice(1)
            }}
          >
            <GamePokemonPortrait
              origin="proposition"
              index={1}
              pokemon={Pkm.DITTO}
            />
            <div className="choice-additional-item">
              <span
                style={{
                  fontSize: "2rem",
                  verticalAlign: "middle"
                }}
              >
                +
              </span>
              <img
                style={{
                  width: "2rem",
                  height: "2rem",
                  verticalAlign: "middle"
                }}
                src={"assets/item/" + componentItem + ".png"}
              />
              <p>
                {addIconsToDescription(t(`item_description.${componentItem}`))}
              </p>
            </div>
          </div>

          {/* Dojo ticket */}
          <div
            className="my-box active clickable"
            onClick={(e) => {
              e.stopPropagation()
              handleChoice(2)
            }}
          >
            <img
              style={{ width: "4rem", height: "4rem" }}
              src={"assets/item/" + dojoTicket + ".png"}
            />
            <h3 style={{ margin: "0.25em 0" }}>{t(`item.${dojoTicket}`)}</h3>
            <p style={{ marginBottom: "0.5em", fontSize: "80%" }}>
              {addIconsToDescription(t(`item_description.${dojoTicket}`))}
            </p>
          </div>
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
