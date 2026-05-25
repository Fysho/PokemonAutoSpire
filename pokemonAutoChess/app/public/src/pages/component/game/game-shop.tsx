import { ToastContainer } from "react-toastify"
import { Transfer } from "../../../../../types"
import { useAppSelector } from "../../../hooks"
import { rooms } from "../../../network"
import { LocalStoreKeys, localStore } from "../../utils/store"
import GameExperience from "./game-experience"
import { GameLifeInfo } from "./game-life-info"
import { GameMoneyInfo } from "./game-money-info"
// import GameRefresh from "./game-refresh"
import { GameRegionalPokemonsIcon } from "./game-regional-pokemons"
import { GameStreakInfo } from "./game-streak-info"
import { GameTeamInfo } from "./game-team-info"
import "./game-shop.css"

export default function GameShop({ onShowMap }: { onShowMap?: () => void }) {
  const gameSpeed = useAppSelector((state) => state.game.gameSpeed)

  function cycleSpeed() {
    const next = gameSpeed >= 3 ? 1 : gameSpeed + 1
    localStore.set(LocalStoreKeys.SPIRE_GAME_SPEED, next)
    rooms.game?.send(Transfer.GAME_SPEED, { speed: next })
  }

  return (
    <>
      <div className="game-shop my-container">
        <div className="game-shop-left-buttons">
          <button
            className="bubbly blue speed-button"
            onClick={cycleSpeed}
            title={`Game speed: ${gameSpeed}x`}
          >
            {gameSpeed}x
          </button>
          {onShowMap && (
            <button
              className="bubbly orange show-map-button"
              onClick={onShowMap}
            >
              Map
            </button>
          )}
        </div>
        <div id="game-shop-info">
          <GameLifeInfo />
          <GameMoneyInfo />
          <GameRegionalPokemonsIcon />
          <GameStreakInfo />
          <div className="spacer"></div>
          <GameTeamInfo />
        </div>
        <GameExperience />
      </div>
      <ToastContainer
        className="toast"
        toastClassName="toast-shop"
        containerId="toast-money"
        position="bottom-center"
        autoClose={2000}
        hideProgressBar
        newestOnTop
        closeOnClick
        limit={1}
        closeButton={false}
        style={{ left: `calc(var(--sidebar-width) + 17.5vw)`, bottom: `9vw` }}
      />
      <ToastContainer
        className="toast"
        toastClassName="toast-shop"
        containerId="toast-life"
        position="bottom-center"
        autoClose={2000}
        hideProgressBar
        newestOnTop
        closeOnClick
        limit={1}
        closeButton={false}
        style={{ left: `calc(var(--sidebar-width) + 11.5vw)`, bottom: `9vw` }}
      />
    </>
  )
}
