import React from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"
import { Tooltip } from "react-tooltip"
import { SPIRE_CLASSES, SpireClass } from "../../../../../core/spire-classes"
import { GamePhaseState } from "../../../../../types/enum/Game"
import { SynergyAssociatedToWeather } from "../../../../../types/enum/Weather"
import { getMaxTeamSize } from "../../../../../utils/board"
import { selectSpectatedPlayer, useAppSelector } from "../../../hooks"
import { addIconsToDescription } from "../../utils/descriptions"
import SynergyIcon from "../icons/synergy-icon"
import PokemonPortrait from "../pokemon-portrait"
import TimerBar from "./game-timer-bar"
import "./game-stage-info.css"

const DIFFICULTY_LABELS: Record<number, string> = {
  0: "Easy",
  1: "Normal",
  2: "Hard",
  3: "Impossible"
}

export default function GameStageInfo({
  onLeave
}: {
  onLeave?: () => void
}) {
  const { t } = useTranslation()
  const phase = useAppSelector((state) => state.game.phase)
  const weather = useAppSelector((state) => state.game.weather)
  const spectatedPlayer = useAppSelector(selectSpectatedPlayer)
  const runHP = useAppSelector((state) => state.game.runHP)
  const isSpire = useAppSelector((state) => state.game.isSpire)
  const spireClass = useAppSelector((state) => state.game.spireClass)
  const difficultyMode = useAppSelector((state) => state.game.difficultyMode)
  const specialGameRule = useAppSelector((state) => state.game.specialGameRule)
  const encounterName = useAppSelector((state) => state.game.encounterName)
  const encounterAvatar = useAppSelector((state) => state.game.encounterAvatar)
  const experienceManager = useAppSelector(
    (state) => state.game.experienceManager
  )

  if (!spectatedPlayer) return null

  const name = spectatedPlayer.name
  const title = spectatedPlayer.title
  const avatar = spectatedPlayer.avatar
  const isFight = phase === GamePhaseState.FIGHT
  // Show the opponent's "vs" block before (PICK), during (FIGHT) and after (REWARD)
  // the fight. The player's opponent* fields are only set at fight start, so before/
  // after we fall back to the synced encounterName/encounterAvatar (set at node select).
  const showOpponent =
    phase === GamePhaseState.PICK ||
    isFight ||
    phase === GamePhaseState.REWARD
  const opponentName = showOpponent
    ? spectatedPlayer.opponentName || encounterName
    : ""
  const opponentAvatar = showOpponent
    ? spectatedPlayer.opponentAvatar || encounterAvatar
    : ""

  const classData = SPIRE_CLASSES[spireClass as SpireClass]
  const subtitle = isSpire
    ? classData?.name ?? ""
    : DIFFICULTY_LABELS[difficultyMode] ?? ""

  const level = experienceManager.level
  const maxTeamSize = getMaxTeamSize(level, specialGameRule, spectatedPlayer.relics)
  const hpColor =
    runHP > 50 ? "var(--color-fg-green, #2ecc71)" : runHP > 20 ? "#f1c40f" : "#e74c3c"

  return (
    <div id="game-stage-info" className="my-container">
      {/* Identity + opponent */}
      <div className="topbar-identity">
        <PokemonPortrait avatar={avatar} />
        <div className="topbar-identity-text">
          <p className="topbar-name">{name}</p>
          <p className="topbar-subtitle">
            {title ? `${t(`title.${title}`)} · ` : ""}
            {subtitle}
          </p>
        </div>
        {opponentName && (
          <div className="topbar-opponent">
            <span className="topbar-vs">vs</span>
            {opponentAvatar && <PokemonPortrait avatar={opponentAvatar} />}
            <span className="topbar-opponent-name">{opponentName}</span>
          </div>
        )}
      </div>

      {/* Resources */}
      <div className="topbar-stats">
        <div
          className="topbar-stat hp"
          data-tooltip-id="topbar-hp"
          style={{ color: hpColor }}
        >
          <Tooltip id="topbar-hp" className="custom-theme-tooltip" place="bottom">
            <p className="help">{t("lose_game_hint")}</p>
          </Tooltip>
          <img src="/assets/ui/heart.png" alt="HP" />
          <span>
            {runHP}
            <span className="topbar-stat-max">/100</span>
          </span>
        </div>

        <div className="topbar-stat gold">
          <img src="/assets/icons/money.svg" alt="$" />
          <span>{spectatedPlayer.money}</span>
        </div>

        <div className="topbar-stat team" data-tooltip-id="topbar-team">
          <Tooltip
            id="topbar-team"
            className="custom-theme-tooltip"
            place="bottom"
          >
            <p className="help">
              {t("place_up_to")} {maxTeamSize} {t("pokemons_on_your_board")}
            </p>
            <p className="help">{t("team_size_hint")}</p>
          </Tooltip>
          <span>
            {spectatedPlayer.boardSize}/{maxTeamSize}
          </span>
          <img src="/assets/ui/pokeball.svg" alt="team" />
        </div>
      </div>

      {/* Right: weather (speed + map button moved to the bottom bar) */}
      <div className="topbar-right">
        {isFight && (
          <div className="topbar-weather" data-tooltip-id="topbar-weather">
            {ReactDOM.createPortal(
              <Tooltip
                id="topbar-weather"
                className="custom-theme-tooltip"
                place="bottom"
              >
                <span style={{ verticalAlign: "middle" }}>
                  <SynergyIcon type={SynergyAssociatedToWeather.get(weather)!} />
                  {t(`weather.${weather}`)}
                </span>
                <p>{addIconsToDescription(t(`weather_description.${weather}`))}</p>
              </Tooltip>,
              document.body
            )}
            <img src={`/assets/icons/weather/${weather.toLowerCase()}.svg`} />
          </div>
        )}

        {onLeave && (
          <button className="bubbly red topbar-leave-button" onClick={onLeave}>
            {t("leave_game")}
          </button>
        )}
      </div>

      {isFight && <TimerBar />}
    </div>
  )
}
