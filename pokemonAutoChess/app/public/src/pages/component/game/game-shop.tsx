import { ToastContainer } from "react-toastify"
import "./game-shop.css"

// The regional-pokemon icon + encounter-rate chips moved into the bottom
// bar (game-bottom-bar.tsx); this component now only hosts the money/life
// toast containers (targeted by containerId elsewhere — do not remove).
export default function GameShop() {
  return (
    <>
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
