import { useTranslation } from "react-i18next"
import { Tooltip } from "react-tooltip"
import { MAX_LEVEL } from "../../../../../config"
import { selectSpectatedPlayer, useAppSelector } from "../../../hooks"
import { levelClick } from "../../../network"
import { addIconsToDescription } from "../../utils/descriptions"
import { Money } from "../icons/money"

export default function GameExperience() {
  const { t } = useTranslation()

  const experienceManager = useAppSelector(
    (state) => state.game.experienceManager
  )
  const isLevelMax = experienceManager.level >= MAX_LEVEL
  const xpNeeded = isLevelMax
    ? 0
    : experienceManager.expNeeded - experienceManager.experience
  const spectatedPlayer = useAppSelector(selectSpectatedPlayer)
  const canLevelup =
    !isLevelMax && spectatedPlayer && spectatedPlayer.money >= xpNeeded

  return (
    <div className="game-experience">
      <span>
        {t("lvl")} {experienceManager.level}
      </span>
      <button
        className="bubbly orange buy-xp-button"
        title={t("buy_xp_tooltip", { cost: xpNeeded })}
        onClick={() => {
          levelClick()
        }}
      >
        <Money value={t("buy_xp", { cost: xpNeeded })} />
      </button>
<div className="progress-bar" data-tooltip-id="gold-to-levelup-tooltip">
        <progress
          className="my-progress"
          value={isLevelMax ? 0 : experienceManager.experience}
          max={experienceManager.expNeeded}
        ></progress>
        <span>
          {isLevelMax
            ? "Max Level"
            : experienceManager.experience + "/" + experienceManager.expNeeded}
        </span>
      </div>
      <Tooltip
        id="gold-to-levelup-tooltip"
        className="custom-theme-tooltip"
        place="top"
      >
        <p className="help">
          {isLevelMax ? (
            t("max_level_reached")
          ) : (
            <>
              {t("gold_needed_to_level_up")}
              <b
                style={{
                  color: canLevelup
                    ? "var(--color-fg-green, green)"
                    : "var(--color-fg-red, red)"
                }}
              >
                {addIconsToDescription(`${xpNeeded} GOLD`)}
              </b>
            </>
          )}
        </p>
      </Tooltip>
    </div>
  )
}
