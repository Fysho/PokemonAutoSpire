import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { SynergyTriggers } from "../../../../../config"
import { getPokemonData } from "../../../../../models/precomputed/precomputed-pokemon-data"
import { GamePhaseState } from "../../../../../types/enum/Game"
import { Item, SynergyGem, SynergyGivenByGem, SynergyGivenByItem } from "../../../../../types/enum/Item"
import { Pkm, PkmFamily } from "../../../../../types/enum/Pokemon"
import { Synergy } from "../../../../../types/enum/Synergy"
import { useAppSelector } from "../../../hooks"
import { rooms } from "../../../network"
import { usePreference } from "../../../preferences"
import DraggableWindow from "../modal/draggable-window"
import Synergies from "../synergy/synergies"

function computeOpponentSynergies(): [string, number][] {
  const board = rooms.game?.state?.spireEncounterBoard
  if (!board || board.length === 0) return []

  const typesPerFamily = new Map<string, Set<Synergy>>()
  board.forEach((entry: string) => {
    const [mainPart] = entry.split("|")
    const parts = mainPart.split(",")
    const pkm = parts[0] as Pkm
    const items = parts.slice(3) as Item[]
    const data = getPokemonData(pkm)
    if (data && data.types) {
      const family = PkmFamily[pkm] ?? pkm
      if (!typesPerFamily.has(family)) typesPerFamily.set(family, new Set())
      const familyTypes = typesPerFamily.get(family)!
      data.types.forEach((t: Synergy) => familyTypes.add(t))
      items.forEach((item) => {
        const synergy = SynergyGivenByItem[item as keyof typeof SynergyGivenByItem]
        if (synergy) familyTypes.add(synergy)
      })
    }
  })

  const counts = new Map<string, number>()
  typesPerFamily.forEach((types) => {
    types.forEach((type) => {
      counts.set(type, (counts.get(type) ?? 0) + 1)
    })
  })

  const inv = rooms.game?.state?.encounterInventory
  if (inv && inv.length > 0) {
    Array.from(inv).forEach((item: string) => {
      const synType = SynergyGivenByGem[item as SynergyGem]
      if (synType) {
        counts.set(synType, (counts.get(synType) ?? 0) + 1)
      }
    })
  }

  return Array.from(counts.entries())
    .filter(([, val]) => val > 0)
    .sort(([s1, v1], [s2, v2]) => {
      if (v2 !== v1) return v2 - v1
      const tiers1 = SynergyTriggers[s1 as Synergy]?.filter((n) => n <= v1).length ?? 0
      const tiers2 = SynergyTriggers[s2 as Synergy]?.filter((n) => n <= v2).length ?? 0
      return tiers2 - tiers1
    })
}

export default function GameOpponentSynergies() {
  const phase = useAppSelector((state) => state.game.phase)
  const stageLevel = useAppSelector((state) => state.game.stageLevel)
  const { t } = useTranslation()
  const [position, setPosition] = usePreference("synergiesPosition")
  const [synergies, setSynergies] = useState<[string, number][]>([])

  useEffect(() => {
    if (phase === GamePhaseState.PICK || phase === GamePhaseState.FIGHT) {
      const timer = setTimeout(() => {
        setSynergies(computeOpponentSynergies())
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setSynergies([])
    }
  }, [phase, stageLevel])

  if (phase !== GamePhaseState.PICK && phase !== GamePhaseState.FIGHT) return null

  const offsetPosition = position
    ? { x: position.x + 220, y: position.y }
    : { x: 220, y: 60 }

  return (
    <DraggableWindow
      title="Enemy"
      className="my-container synergies-container"
      initialPosition={offsetPosition}
      onMove={() => {}}
    >
      <Synergies
        synergies={synergies}
        tooltipPortal={true}
      />
    </DraggableWindow>
  )
}
