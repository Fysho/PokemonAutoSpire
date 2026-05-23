import React from "react"
import { Tooltip } from "react-tooltip"
import { RELIC_DEFINITIONS } from "../../../../../core/relic-effects"
import { Item } from "../../../../../types/enum/Item"

interface GameRelicBarProps {
  relics: string[]
}

export default function GameRelicBar({ relics }: GameRelicBarProps) {
  if (relics.length === 0) return null

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
      {relics.map((relicId, i) => {
        const def = RELIC_DEFINITIONS[relicId as Item]
        const name = def?.name ?? relicId
        const desc = def?.description ?? ""
        return (
          <div
            key={`${relicId}-${i}`}
            data-tooltip-id={`relic-${i}`}
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
            <Tooltip id={`relic-${i}`} className="custom-theme-tooltip" place="bottom">
              <strong>{name}</strong>
              <p style={{ margin: "4px 0 0" }}>{desc}</p>
            </Tooltip>
            <img
              src={`/assets/items/${relicId}.png`}
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
