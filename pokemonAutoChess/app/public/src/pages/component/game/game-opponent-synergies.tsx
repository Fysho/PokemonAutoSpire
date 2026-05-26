import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
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
  // Use server-computed synergies if available (includes Dragon double-types etc.)
  const serverSynergies = rooms.game?.state?.encounterSynergies
  if (serverSynergies && serverSynergies.length > 0) {
    const serverMap = new Map<string, number>()
    Array.from(serverSynergies).forEach((entry: string) => {
      const [key, val] = entry.split(":")
      serverMap.set(key, parseInt(val))
    })
    return Object.keys(Synergy).map((key) => [key, serverMap.get(key) ?? 0] as [string, number])
  }

  // Fallback: compute client-side from encoded board (non-snapshot encounters)
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

  const synergies: [string, number][] = Object.keys(Synergy).map((key) => [key, 0])
  typesPerFamily.forEach((types) => {
    types.forEach((type) => {
      const entry = synergies.find(([k]) => k === type)
      if (entry) entry[1] += 1
    })
  })

  const inv = rooms.game?.state?.encounterInventory
  if (inv && inv.length > 0) {
    Array.from(inv).forEach((item: string) => {
      const synType = SynergyGivenByGem[item as SynergyGem]
      if (synType) {
        const entry = synergies.find(([k]) => k === synType)
        if (entry) entry[1] += 1
      }
    })
  }

  return synergies
}

export default function GameOpponentSynergies() {
  const phase = useAppSelector((state) => state.game.phase)
  const stageLevel = useAppSelector((state) => state.game.stageLevel)
  const { t } = useTranslation()
  const [playerPosition] = usePreference("synergiesPosition")
  const [savedPosition, setSavedPosition] = usePreference("opponentSynergiesPosition")
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

  const initialPosition = savedPosition
    ?? { x: (playerPosition?.x ?? 0) + 220, y: playerPosition?.y ?? 60 }

  return (
    <DraggableWindow
      title="Enemy"
      className="my-container synergies-container"
      initialPosition={initialPosition}
      onMove={setSavedPosition}
    >
      <Synergies
        synergies={synergies}
        tooltipPortal={true}
        isEnemy={true}
      />
    </DraggableWindow>
  )
}
