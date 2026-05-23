import { ToastContainer } from "react-toastify"
import GameExperience from "./game-experience"
import { GameLifeInfo } from "./game-life-info"
import { GameMoneyInfo } from "./game-money-info"
// import GameRefresh from "./game-refresh"
import { GameStreakInfo } from "./game-streak-info"
import { GameTeamInfo } from "./game-team-info"
import "./game-shop.css"

export default function GameShop() {
  return (
    <>
      <div className="game-shop my-container">
        <div id="game-shop-info">
          <GameLifeInfo />
          <GameMoneyInfo />
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
