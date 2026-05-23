import React from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"
import { Tooltip } from "react-tooltip"
import { GamePhaseState } from "../../../../../types/enum/Game"
import { Pkm } from "../../../../../types/enum/Pokemon"
import { SynergyAssociatedToWeather } from "../../../../../types/enum/Weather"
import { selectSpectatedPlayer, useAppSelector } from "../../../hooks"
import { addIconsToDescription } from "../../utils/descriptions"
import { cc } from "../../utils/jsx"
import SynergyIcon from "../icons/synergy-icon"
import PokemonPortrait from "../pokemon-portrait"
import TimerBar from "./game-timer-bar"
import "./game-stage-info.css"

export default function GameStageInfo() {
  const { t } = useTranslation()
  const phase = useAppSelector((state) => state.game.phase)
  const weather = useAppSelector((state) => state.game.weather)
  const spectatedPlayer = useAppSelector(selectSpectatedPlayer)
  const currentAct = useAppSelector((state) => state.game.currentAct)
  const currentFloor = useAppSelector((state) => state.game.currentFloor)
  const runHP = useAppSelector((state) => state.game.runHP)

  if (!spectatedPlayer) return null

  const name = spectatedPlayer.name
  const title = spectatedPlayer.title
  const avatar = spectatedPlayer.avatar
  const opponentName =
    phase === GamePhaseState.FIGHT ? spectatedPlayer.opponentName : ""
  const opponentAvatar =
    phase === GamePhaseState.FIGHT ? spectatedPlayer.opponentAvatar : ""
  const opponentTitle =
    phase === GamePhaseState.FIGHT ? spectatedPlayer.opponentTitle : ""

  return (
    <>
      <div id="game-stage-info" className="my-container">
        <div className="stage-information">
          <p>Act {currentAct} - Floor {currentFloor}</p>
          <p style={{ fontSize: "0.7em", opacity: 0.7 }}>HP: {runHP}/100</p>
        </div>

        <div
          className={cc("players-information", {
            "has-opponent": opponentName != ""
          })}
        >
          <div className="player-information">
            <PokemonPortrait avatar={avatar} />
            {title && <p className="player-title">{t(`title.${title}`)}</p>}
            <p className="player-name">{name}</p>
          </div>
          {opponentName && (
            <>
              <span>vs</span>
              <div className="player-information">
                <PokemonPortrait avatar={opponentAvatar} />
                {opponentTitle && (
                  <p className="player-title">{opponentTitle}</p>
                )}
                <p className="player-name">{opponentName}</p>
              </div>
            </>
          )}
        </div>

        {opponentName != "" && (
          <div className="weather-information" data-tooltip-id="detail-weather">
            {ReactDOM.createPortal(
              <Tooltip
                id="detail-weather"
                className="custom-theme-tooltip"
                place="bottom"
              >
                <span style={{ verticalAlign: "middle" }}>
                  <SynergyIcon
                    type={SynergyAssociatedToWeather.get(weather)!}
                  />
                  {t(`weather.${weather}`)}
                </span>
                <p>
                  {addIconsToDescription(t(`weather_description.${weather}`))}
                </p>
              </Tooltip>,
              document.body
            )}
            <img src={`/assets/icons/weather/${weather.toLowerCase()}.svg`} />
          </div>
        )}

        {phase === GamePhaseState.FIGHT && <TimerBar />}
      </div>
    </>
  )
}

