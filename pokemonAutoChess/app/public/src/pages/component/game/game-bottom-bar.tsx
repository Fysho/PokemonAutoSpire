import { Transfer } from "../../../../../types"
import { useAppSelector } from "../../../hooks"
import { rooms } from "../../../network"
import { LocalStoreKeys, localStore } from "../../utils/store"
import GameExperience from "./game-experience"
import GameRarityPercentage from "./game-rarity-percentage"
import { GameRegionalPokemonsIcon } from "./game-regional-pokemons"
import "./game-stage-info.css"

// Full-width bottom bar, mirroring the top bar (#game-stage-info).
// Left: regional pokemon + encounter rates (formerly the bottom-left floats).
// Center: the level/XP widget. Right: speed cycle + the map button.
export default function GameBottomBar({
  onShowMap
}: {
  onShowMap?: () => void
}) {
  const currentAct = useAppSelector((state) => state.game.currentAct)
  const currentFloor = useAppSelector((state) => state.game.currentFloor)
  const gameSpeed = useAppSelector((state) => state.game.gameSpeed)

  function cycleSpeed() {
    const speeds = [0.5, 1, 2, 3]
    const idx = speeds.indexOf(gameSpeed)
    const next = speeds[(idx + 1) % speeds.length]
    localStore.set(LocalStoreKeys.SPIRE_GAME_SPEED, next)
    rooms.game?.send(Transfer.GAME_SPEED, { speed: next })
  }

  return (
    <div id="game-bottom-bar" className="my-container">
      <div className="bottombar-left">
        <GameRegionalPokemonsIcon />
        <GameRarityPercentage />
      </div>

      <div className="bottombar-center">
        <GameExperience />
      </div>

      <div className="topbar-right">
        <button
          className="bubbly blue topbar-speed-button"
          onClick={cycleSpeed}
          title={`Game speed: ${gameSpeed}x`}
        >
          {gameSpeed}x
        </button>

        <button
          className="bubbly orange topbar-floor"
          onClick={onShowMap}
          disabled={!onShowMap}
          title={onShowMap ? "Show map" : undefined}
        >
          <span className="topbar-floor-act">Act {currentAct}</span>
          <span className="topbar-floor-num">Floor {currentFloor}</span>
        </button>
      </div>
    </div>
  )
}
