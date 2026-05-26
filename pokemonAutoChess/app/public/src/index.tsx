import React, { Suspense } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import { BrowserRouter, Route, Routes } from "react-router"
import i18n from "./i18n"
import Auth from "./pages/auth"
import Game from "./pages/game"
import SpireLobby from "./pages/spire-lobby"
import store from "./stores/index"
import "./style/index.css"
import "./theme"

if (window.top && window !== window.top) {
  window.top.location.replace(window.location.href)
}

if (window.opener) {
  window.opener.location.replace(window.location.href)
}

const container = document.getElementById("root")
const root = createRoot(container!)

i18n.on("initialized", () => {
  root.render(
    <Provider store={store}>
      <React.StrictMode>
        <Suspense fallback="loading">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Auth />} />
              <Route path="/lobby" element={<SpireLobby />} />
              <Route path="/game" element={<Game />} />
            </Routes>
          </BrowserRouter>
        </Suspense>
      </React.StrictMode>
    </Provider>
  )
})

if (navigator.serviceWorker) {
  navigator.serviceWorker.register("sw.js")
}
