import React from "react"
import { Tooltip } from "react-tooltip"
import {
  ALL_RELICS,
  Relic,
  RelicRarity,
  RELIC_RARITIES,
  RELIC_RARITY_COLOR,
  RELIC_RARITY_LABEL,
  RELICS
} from "../../../../../core/relics"
import { addIconsToDescription } from "../../utils/descriptions"
import "./wiki-relics.css"

export default function WikiRelics() {
  // group relics by rarity (CLASS first, then common -> epic), sorted by name
  const relicsByRarity = new Map<RelicRarity, Relic[]>()
  RELIC_RARITIES.forEach((r) => relicsByRarity.set(r, []))
  ALL_RELICS.forEach((id) => {
    const rarity = RELICS[id].rarity
    relicsByRarity.get(rarity)?.push(id)
  })
  relicsByRarity.forEach((list) =>
    list.sort((a, b) => RELICS[a].name.localeCompare(RELICS[b].name))
  )

  return (
    <div id="wiki-relics">
      <p className="wiki-relics-intro">
        {ALL_RELICS.length} relics — run-wide passives shown in the top-left of
        the screen. Class relics have effects; others are black-outlined until
        implemented.
      </p>
      {RELIC_RARITIES.map((rarity) => {
        const list = relicsByRarity.get(rarity) ?? []
        return (
          <section key={rarity} style={{ color: RELIC_RARITY_COLOR[rarity] }}>
            <h2>
              {RELIC_RARITY_LABEL[rarity]} <span className="count">({list.length})</span>
            </h2>
            <ul>
              {list.map((id) => (
                <li
                  key={id}
                  data-tooltip-id="wiki-relic-tooltip"
                  data-relic-id={id}
                  // unimplemented relics get a black outline (override rarity color)
                  style={RELICS[id].implemented ? undefined : { color: "#000" }}
                >
                  <img
                    src={`/assets/relics/${id}.png`}
                    alt={RELICS[id].name}
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.visibility = "hidden"
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <Tooltip
        id="wiki-relic-tooltip"
        className="custom-theme-tooltip"
        render={({ activeAnchor }) => {
          const id = activeAnchor?.getAttribute("data-relic-id")
          const relic = id ? RELICS[id as Relic] : undefined
          if (!relic) return null
          return (
            <div>
              <strong>{relic.name}</strong>
              <p className="relic-effect-desc" style={{ margin: "4px 0 0", maxWidth: "240px" }}>
                {addIconsToDescription(relic.description)}
              </p>
            </div>
          )
        }}
      />
    </div>
  )
}
