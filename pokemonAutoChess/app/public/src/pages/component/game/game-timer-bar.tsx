import { FIGHTING_PHASE_DURATION } from "../../../../../config"
import { useAppSelector } from "../../../hooks"
import "./game-timer-bar.css"

export default function TimerBar() {
  // The bar only renders during the FIGHT phase, whose duration is a fixed
  // constant. Don't infer the denominator from roundTime jumps (the old
  // phaseDuration heuristic) — Spire's untimed phases sync the 999s
  // "infinite" sentinel, which poisoned it and made the bar start ~5% full.
  const totalTime = FIGHTING_PHASE_DURATION / 1000
  const time = useAppSelector((state) => state.game.roundTime)
  const pc = Math.min(Math.max((100 * time) / totalTime, 0), 100)

  return (
    <div className="timer-bar">
      <div className="timer-bar-inner" style={{ width: `${pc}%` }}></div>
    </div>
  )
}
