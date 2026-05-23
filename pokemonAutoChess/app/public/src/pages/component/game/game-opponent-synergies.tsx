import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { SynergyTriggers } from "../../../../../config"
import { getPokemonData } from "../../../../../models/precomputed/precomputed-pokemon-data"
import { GamePhaseState } from "../../../../../types/enum/Game"
import { Pkm } from "../../../../../types/enum/Pokemon"
import { Synergy } from "../../../../../types/enum/Synergy"
import { useAppSelector } from "../../../hooks"
import { rooms } from "../../../network"
import { usePreference } from "../../../preferences"
import DraggableWindow from "../modal/draggable-window"
import Synergies from "../synergy/synergies"

export default function GameOpponentSynergies() {
  const phase = useAppSelector((state) => state.game.phase)
  const { t } = useTranslation()
  const [position, setPosition] = usePreference("synergiesPosition")

  const opponentSynergies = useMemo(() => {
    if (phase !== GamePhaseState.PICK && phase !== GamePhaseState.FIGHT) return []

    const board = rooms.game?.state?.spireEncounterBoard
    if (!board || board.length === 0) return []

    const counts = new Map<Synergy, number>()
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
      .filter(([syn, count]) => {
        const triggers = SynergyTriggers[syn]
        return triggers && count >= (triggers[0] ?? 1)
      })
      .sort((a, b) => b[1] - a[1])
  }, [phase, rooms.game?.state?.spireEncounterBoard?.length])

  if (opponentSynergies.length === 0) return null

  const offsetPosition = position
    ? { x: position.x + 220, y: position.y }
    : { x: 220, y: 60 }

  return (
    <DraggableWindow
      title={t("opponent_synergies", "Enemy Synergies")}
      className="my-container synergies-container"
      initialPosition={offsetPosition}
      onMove={() => {}}
    >
      <Synergies
        synergies={opponentSynergies}
        tooltipPortal={true}
      />
    </DraggableWindow>
  )
}
