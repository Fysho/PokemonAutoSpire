import React from "react"
import { useTranslation } from "react-i18next"
import { Tooltip } from "react-tooltip"
import { useAppSelector } from "../../../hooks"

export default function GameOpponentItems() {
  const { t } = useTranslation()
  const items = useAppSelector((state) => state.game.encounterInventory)

  if (!items || items.length === 0) return null

  return (
    <div style={{
      position: "absolute",
      top: "13%",
      right: "27%",
      display: "flex",
      flexDirection: "column",
      gap: "3px",
      zIndex: 40
    }}>
      {items.map((itemId, i) => {
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
