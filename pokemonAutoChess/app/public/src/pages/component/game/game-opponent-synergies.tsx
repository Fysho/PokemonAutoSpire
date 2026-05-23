import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { getPokemonData } from "../../../../../models/precomputed/precomputed-pokemon-data"
import { GamePhaseState } from "../../../../../types/enum/Game"
import { Pkm } from "../../../../../types/enum/Pokemon"
import { Synergy } from "../../../../../types/enum/Synergy"
import { useAppSelector } from "../../../hooks"
import { rooms } from "../../../network"
import { usePreference } from "../../../preferences"
import DraggableWindow from "../modal/draggable-window"
import Synergies from "../synergy/synergies"

function computeOpponentSynergies(): [string, number][] {
  const board = rooms.game?.state?.spireEncounterBoard
  if (!board || board.length === 0) return []

  const counts = new Map<string, number>()
  board.forEach((entry: string) => {
    const pkm = entry.split(",")[0] as Pkm
    const data = getPokemonData(pkm)
    if (data && data.types) {
      data.types.forEach((t: Synergy) => {
        counts.set(t, (counts.get(t) ?? 0) + 1)
      })
    }
  })

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
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
      title="Enemy Synergies"
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
