import React from "react"
import { Tooltip } from "react-tooltip"
import {
  Relic,
  RELICS,
  RELIC_RARITY_COLOR,
  RELIC_RARITY_LABEL
} from "../../../../../core/relics"
import { addIconsToDescription } from "../../utils/descriptions"

interface GameRelicContainerProps {
  relics: string[]
}

/**
 * Top-left HUD container for the player's run-wide relics.
 * Fills horizontally first, then wraps onto additional rows.
 * Tiles are bordered/glowed with their rarity color. Icons load from
 * /assets/relics/<RELIC_ID>.png.
 */
export default function GameRelicContainer({ relics }: GameRelicContainerProps) {
  if (relics.length === 0) return null

  return (
    <div
      style={{
        position: "absolute",
        top: "3.5em",
        left: "8px",
        display: "flex",
        flexWrap: "wrap",
        gap: "4px",
        maxWidth: "45%",
        zIndex: 40
      }}
    >
      {relics.map((relicId, i) => {
        const data = RELICS[relicId as Relic]
        const name = data?.name ?? relicId
        const desc = data?.description ?? ""
        const rarityColor = data ? RELIC_RARITY_COLOR[data.rarity] : "#f39c12"
        const rarityLabel = data ? RELIC_RARITY_LABEL[data.rarity] : ""
        // Unimplemented relics get a black outline (override the rarity color).
        const outlineColor = data && data.implemented ? rarityColor : "#000000"
        return (
          <div
            key={`${relicId}-${i}`}
            data-tooltip-id={`relic-${i}`}
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "6px",
              border: `2px solid ${outlineColor}`,
              boxShadow: `0 0 5px ${outlineColor}`,
              background: "rgba(45,27,78,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              cursor: "default"
            }}
          >
            <Tooltip
              id={`relic-${i}`}
              className="custom-theme-tooltip"
              place="bottom"
            >
              <strong>{name}</strong>
              {rarityLabel && (
                <p style={{ margin: "2px 0 0", color: rarityColor, fontSize: "90%" }}>
                  {rarityLabel}
                </p>
              )}
              {desc && (
                <p className="relic-effect-desc" style={{ margin: "4px 0 0", maxWidth: "220px" }}>
                  {addIconsToDescription(desc)}
                </p>
              )}
            </Tooltip>
            <img
              src={`/assets/relics/${relicId}.png`}
              alt={name}
              style={{ width: "40px", height: "40px", objectFit: "contain" }}
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
