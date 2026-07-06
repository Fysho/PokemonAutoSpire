import { useTranslation } from "react-i18next"
import { Tooltip } from "react-tooltip"
import {
  RarityColor,
  RarityProbabilityPerLevel
} from "../../../../../config"
import { Rarity } from "../../../../../types/enum/Game"
import { useAppSelector } from "../../../hooks"

export default function GameRarityPercentage() {
  const { t } = useTranslation()
  const level = useAppSelector((state) => state.game.experienceManager.level)
  // Never index the table with a raw level: endless levels used to overrun it
  // (rows stopped at 9 while ENDLESS_MAX_LEVEL is 13), crashing the whole
  // game page on resume. Clamp to the rows that actually exist.
  const knownLevels = Object.keys(RarityProbabilityPerLevel).map(Number)
  const maxKnownLevel = Math.max(...knownLevels)
  const levelKey = Math.min(Math.max(level, 1), maxKnownLevel)
  const current = RarityProbabilityPerLevel[levelKey]
  const next = RarityProbabilityPerLevel[levelKey + 1]
  const RarityTiers = [
    Rarity.COMMON,
    Rarity.UNCOMMON,
    Rarity.RARE,
    Rarity.EPIC,
    Rarity.ULTRA
  ]
  return (
    <>
      <Tooltip
        id="detail-game-rarity-percentage"
        className="custom-theme-tooltip"
        place="top"
      >
        <p>{t("encounter_rates")}</p>
        <table style={{ width: "100%", textAlign: "center" }}>
          <thead>
            <tr>
              <th>{t("rarity_label")}</th>
              <th>{t("rate")}</th>
              {next && <th>{t("next_level")}</th>}
            </tr>
          </thead>
          <tbody>
            {RarityTiers.map((rarity, index) => (
              <tr key={"detail-" + rarity}>
                <td style={{ color: RarityColor[rarity] }}>
                  {t(`rarity.${rarity}`)}
                </td>
                <td>{Math.round(current[index] * 100)}%</td>
                {next && (
                  <td
                    style={{
                      color: next[index] < current[index]
                        ? "#e76e55"
                        : "#92cc41"
                    }}
                  >
                    {Math.round(next[index] * 100)}%
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="help">{t("increase_level_hint")}</p>
      </Tooltip>
      <div
        className="my-box game-rarity-percentage"
        data-tooltip-id="detail-game-rarity-percentage"
      >
        {RarityTiers.map((rarity, index) => {
          return (
            <div key={rarity} style={{ backgroundColor: RarityColor[rarity] }}>
              {Math.ceil(current[index] * 100)}%
            </div>
          )
        })}
      </div>
    </>
  )
}
