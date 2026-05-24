import React from "react"
import { useTranslation } from "react-i18next"
import { Tooltip } from "react-tooltip"
import { PASSIVE_ITEMS } from "../../../../../core/relic-effects"
import { Item } from "../../../../../types/enum/Item"

interface GameRelicBarProps {
  items: string[]
}

export default function GameRelicBar({ items }: GameRelicBarProps) {
  const { t } = useTranslation()
  const passiveItems = items.filter(i => (PASSIVE_ITEMS as readonly string[]).includes(i))
  if (passiveItems.length === 0) return null

  return (
    <div style={{
      position: "absolute",
      top: "8px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: "4px",
      background: "rgba(0,0,0,0.6)",
      borderRadius: "8px",
      padding: "4px 8px",
      zIndex: 40
    }}>
      {passiveItems.map((itemId, i) => {
        const name = t(`item.${itemId}` as any) as string
        const desc = t(`item_description.${itemId}` as any) as string
        return (
          <div
            key={`${itemId}-${i}`}
            data-tooltip-id={`passive-item-${i}`}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "4px",
              border: "1px solid #f39c12",
              background: "#2d1b4e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "default",
              overflow: "hidden"
            }}
          >
            <Tooltip id={`passive-item-${i}`} className="custom-theme-tooltip" place="bottom">
              <strong>{name}</strong>
              <p style={{ margin: "4px 0 0" }}>{desc}</p>
            </Tooltip>
            <img
              src={`/assets/items/${itemId}.png`}
              alt={name}
              style={{ width: "28px", height: "28px" }}
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
