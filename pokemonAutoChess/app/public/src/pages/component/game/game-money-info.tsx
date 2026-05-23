import { selectSpectatedPlayer, useAppSelector } from "../../../hooks"
import { Money } from "../icons/money"

export function GameMoneyInfo() {
  const spectatedPlayer = useAppSelector(selectSpectatedPlayer)
  if (!spectatedPlayer) return null

  return (
    <div id="game-money-info" className="my-container money information">
      <Money value={spectatedPlayer.money} />
    </div>
  )
}

export function GameMoneyDetail() {
  return null
}
