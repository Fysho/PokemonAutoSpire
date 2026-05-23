import React, { Suspense, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { Provider } from "react-redux"
import { BrowserRouter, Route, Routes, useNavigate } from "react-router"
import i18n from "./i18n"
import { authenticateUser, client, joinGame } from "./network"
import Game from "./pages/game"
import store from "./stores/index"
import "./style/index.css"
import "./theme"

if (window.top && window !== window.top) {
  window.top.location.replace(window.location.href)
}

if (window.opener) {
  window.opener.location.replace(window.location.href)
}

function SpireEntry() {
  const navigate = useNavigate()

  useEffect(() => {
    async function startGame() {
      await authenticateUser()

      const room = await client.create("game", {
        odToken: "local-player",
        displayName: "Player",
        users: {
          "local-player": {
            uid: "local-player",
            name: "Player",
            elo: 1000,
            games: 0,
            avatar: "0019/Normal",
            isBot: false
          }
        },
        preparationId: "spire-local",
        name: "PokemonAutoSpire",
        ownerName: "Player",
        noElo: true,
        gameMode: "CUSTOM_LOBBY",
        specialGameRule: null,
        minRank: null,
        maxRank: null,
        tournamentId: null,
        bracketId: null
      })

      joinGame(room)
      navigate("/game")
    }

    startGame().catch((err) => {
      console.error("Failed to start game:", err)
    })
  }, [navigate])

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        color: "white",
        fontSize: "24px",
        background: "#1a1a2e"
      }}
    >
      Loading PokemonAutoSpire...
    </div>
  )
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
              <Route path="/" element={<SpireEntry />} />
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
