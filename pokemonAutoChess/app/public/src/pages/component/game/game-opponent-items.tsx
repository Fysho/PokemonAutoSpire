import React from "react"
import { useTranslation } from "react-i18next"
import { Tooltip } from "react-tooltip"
import { useAppSelector } from "../../../hooks"
import { Money } from "../icons/money"

export default function GameOpponentItems() {
  const { t } = useTranslation()
  const items = useAppSelector((state) => state.game.encounterInventory)
  const money = useAppSelector((state) => state.game.encounterMoney)

  const hasItems = items && items.length > 0
  if (!hasItems && !money) return null

  return (
    <div style={{
      position: "absolute",
      top: "13%",
      right: "27%",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "3px",
      zIndex: 40
    }}>
      {money > 0 && (
        <div
          data-tooltip-id="opp-money"
          style={{ fontSize: "1.3em", cursor: "default", marginBottom: "2px" }}
        >
          <Tooltip id="opp-money" className="custom-theme-tooltip" place="left">
            Opponent's gold
          </Tooltip>
          <Money value={money} />
        </div>
      )}
      {hasItems && items.map((itemId, i) => {
        const name = t(`item.${itemId}` as any) as string
        const desc = t(`item_description.${itemId}` as any) as string
        return (
          <div
            key={`${itemId}-${i}`}
            data-tooltip-id={`opp-item-${i}`}
            style={{
              width: "48px",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "default"
            }}
          >
            <Tooltip id={`opp-item-${i}`} className="custom-theme-tooltip" place="left">
              <strong>{name}</strong>
              <p style={{ margin: "4px 0 0" }}>{desc}</p>
            </Tooltip>
            <img
              src={`assets/item/${itemId}.png`}
              alt={name}
              style={{ width: "48px", height: "48px", imageRendering: "pixelated" }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none"
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
