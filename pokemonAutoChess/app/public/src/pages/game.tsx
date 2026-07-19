import { getStateCallbacks, type Room } from "@colyseus/sdk"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { toast } from "react-toastify"
import { RegionDetails } from "../../../config"
import { ALL_RELICS, RELICS, type Relic } from "../../../core/relics"
import type { Wanderer } from "../../../models/colyseus-models/wanderer"
import type GameState from "../../../rooms/states/game-state"
import {
  type IBoardEvent,
  type IDps,
  type IDragDropCombineMessage,
  type IDragDropItemMessage,
  type IDragDropMessage,
  type IExperienceManager,
  type IPlayer,
  Role,
  Transfer
} from "../../../types"
import { ConnectionStatus } from "../../../types/enum/ConnectionStatus"
import { GamePhaseState, Team } from "../../../types/enum/Game"
import { Item } from "../../../types/enum/Item"
import { Pkm } from "../../../types/enum/Pokemon"
import type { NonFunctionPropNames } from "../../../types/HelperTypes"
import type { DisplayText } from "../../../types/strings/DisplayText"
import { logger } from "../../../utils/logger"
import { schemaValues } from "../../../utils/schemas"
import { BoardMode } from "../game/components/board-manager"
import GameContainer from "../game/game-container"
import type GameScene from "../game/scenes/game-scene"
import {
  selectConnectedPlayer,
  selectSpectatedPlayer,
  useAppDispatch,
  useAppSelector
} from "../hooks"
import {
  authenticateUser,
  beginEliteTest,
  clearGameReconnection,
  client,
  hasLastEliteTest,
  isEliteTestActive,
  resendLastEliteTest,
  rooms
} from "../network"
import store from "../stores"
import {
  addDpsMeter,
  addPlayer,
  changeDpsMeter,
  changePlayer,
  changeShop,
  leaveGame,
  removeDpsMeter,
  removePlayer,
  setAdditionalPokemons,
  setArceusDamageDealt,
  setCurrentAct,
  setCurrentFloor,
  setDifficultyMode,
  setEmotesUnlocked,
  setEncounterAvatar,
  setEncounterDifficulty,
  setEncounterGroundHoles,
  setEncounterInventory,
  setEncounterMoney,
  setEncounterName,
  setEncounterPokemonCount,
  setEncounterTotalItems,
  setEncounterTotalStars,
  setGameMode,
  setGameSpeed,
  setInterest,
  setIsEndless,
  setIsNewArceusRecord,
  setIsSpire,
  setIsTutorial,
  setLife,
  setLoadingProgress,
  setMaxInterest,
  setMoney,
  setNoELO,
  setPhase,
  setPreviousArceusHolder,
  setPreviousArceusRecord,
  setRoundTime,
  setRunHP,
  setShopFreeRolls,
  setShopLocked,
  setSpecialGameRule,
  setSpireClass,
  setStageLevel,
  setStreak,
  setSynergies,
  setWeather,
  updateExperienceManager
} from "../stores/GameStore"
import { setConnectionStatus, setRole } from "../stores/NetworkStore"
import GameBalancePanel from "./component/game/game-balance-panel"
import GameBottomBar from "./component/game/game-bottom-bar"
import GameChoice from "./component/game/game-choice"
import GameDpsMeter from "./component/game/game-dps-meter"
import GameEventOverlay from "./component/game/game-event"
import GameFinalRank from "./component/game/game-final-rank"
import GameLoadingScreen from "./component/game/game-loading-screen"
import GameMap from "./component/game/game-map"
import GameOpponentItems from "./component/game/game-opponent-items"
import GameOpponentSynergies from "./component/game/game-opponent-synergies"
import GameRelicContainer from "./component/game/game-relic-container"
import GameRest from "./component/game/game-rest"
import GameRewardsScreen from "./component/game/game-rewards-screen"
import GameRunEnd from "./component/game/game-run-end"
import GameShop from "./component/game/game-shop"
import GameStageInfo from "./component/game/game-stage-info"
import GameSynergies from "./component/game/game-synergies"
import GameToasts from "./component/game/game-toasts"
import TutorialDialog from "./component/game/tutorial-dialog"
import { MainSidebar } from "./component/main-sidebar/main-sidebar"
import { ConnectionStatusNotification } from "./component/system/connection-status-notification"
import { getMusicMode, playMusic, preloadMusic } from "./utils/audio"
import { LocalStoreKeys, localStore } from "./utils/store"
import { transformEntityCoordinates } from "./utils/utils"

let gameContainer: GameContainer

export function getGameScene(): GameScene | undefined {
  return gameContainer?.game?.scene?.getScene<GameScene>("gameScene") as
    | GameScene
    | undefined
}

export function getGameContainer(): GameContainer {
  return gameContainer
}

export function cyclePlayers(amt: number) {
  const players = schemaValues(gameContainer.room?.state.players)
  playerClick(
    players[
      (players.findIndex((p) => p === gameContainer.player) +
        amt +
        players.length) %
        players.length
    ].id
  )
}

export function playerClick(id: string) {
  const scene = getGameScene()
  gameContainer?.room?.send(Transfer.SPECTATE, id)
  if (scene?.spectate) {
    if (gameContainer?.room?.state?.players) {
      const spectatedPlayer = gameContainer?.room?.state?.players.get(id)
      if (spectatedPlayer) {
        gameContainer.setPlayer(spectatedPlayer)

        const simulation = gameContainer?.room?.state.simulations.get(
          spectatedPlayer.simulationId
        )
        if (simulation) {
          gameContainer.setSimulation(simulation)
        }
      }

      gameContainer?.gameScene?.board?.updateScoutingAvatars()
    }
  }
}

function showMoneyToast(value: number) {
  toast(
    <div className="toast-player-income">
      <span style={{ verticalAlign: "middle" }}>+{value}</span>
      <img className="icon-money" src="/assets/icons/money.svg" alt="$" />
    </div>,
    { containerId: "toast-money" }
  )
}

function AdminGivePokemon() {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const allPokemon = Object.values(Pkm)
  const trimmed = query.trim().toLowerCase()
  const filtered =
    trimmed.length === 0
      ? allPokemon
      : allPokemon.filter((p) => p.toLowerCase().includes(trimmed))

  function give(pkm: Pkm) {
    rooms.game?.send(Transfer.GIVE_POKEMON, { pkm })
    setQuery("")
    setOpen(false)
  }

  return (
    <div style={{ position: "relative", width: "160px" }}>
      <input
        type="text"
        value={query}
        placeholder="Give Pokemon…"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtered.length > 0) give(filtered[0])
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: "4px",
          border: "none",
          fontSize: "12px",
          boxSizing: "border-box"
        }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: "240px",
            overflowY: "auto",
            background: "#2c3e50",
            border: "1px solid #1a252f",
            borderRadius: "4px",
            zIndex: 400,
            marginTop: "2px"
          }}
        >
          {filtered.slice(0, 100).map((p) => (
            <div
              key={p}
              onMouseDown={() => give(p)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#34495e")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
              style={{
                padding: "4px 8px",
                color: "white",
                cursor: "pointer",
                fontSize: "12px",
                whiteSpace: "nowrap"
              }}
            >
              {p}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Search synonyms so admins can find items by a friendly name even when the
// enum id differs (e.g. "compost" → the mulch items used to grow flower pots).
const ITEM_SEARCH_ALIASES: Partial<Record<Item, string>> = {
  [Item.RICH_MULCH]: "compost",
  [Item.AMAZE_MULCH]: "compost"
}

function AdminGiveItem() {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const allItems = Object.values(Item)
  const trimmed = query.trim().toLowerCase()
  const filtered =
    trimmed.length === 0
      ? allItems
      : allItems.filter(
          (i) =>
            i.toLowerCase().includes(trimmed) ||
            (ITEM_SEARCH_ALIASES[i]?.includes(trimmed) ?? false)
        )

  function give(item: Item) {
    rooms.game?.send(Transfer.GIVE_ITEM, { item })
    setQuery("")
    setOpen(false)
  }

  return (
    <div style={{ position: "relative", width: "160px" }}>
      <input
        type="text"
        value={query}
        placeholder="Give Item…"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtered.length > 0) give(filtered[0])
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: "4px",
          border: "none",
          fontSize: "12px",
          boxSizing: "border-box"
        }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: "240px",
            overflowY: "auto",
            background: "#2c3e50",
            border: "1px solid #1a252f",
            borderRadius: "4px",
            zIndex: 400,
            marginTop: "2px"
          }}
        >
          {filtered.slice(0, 100).map((i) => (
            <div
              key={i}
              onMouseDown={() => give(i)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#34495e")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
                color: "white",
                cursor: "pointer",
                fontSize: "12px",
                whiteSpace: "nowrap"
              }}
            >
              <img
                src={`assets/item/${i}.png`}
                style={{
                  width: "20px",
                  height: "20px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              {i}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdminGiveRelic() {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const trimmed = query.trim().toLowerCase()
  const filtered =
    trimmed.length === 0
      ? ALL_RELICS
      : ALL_RELICS.filter(
          (r) =>
            r.toLowerCase().includes(trimmed) ||
            RELICS[r].name.toLowerCase().includes(trimmed)
        )

  function give(relic: Relic) {
    rooms.game?.send(Transfer.GIVE_RELIC, { relic })
    setQuery("")
    setOpen(false)
  }

  return (
    <div style={{ position: "relative", width: "160px" }}>
      <input
        type="text"
        value={query}
        placeholder="Give Relic…"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtered.length > 0) give(filtered[0])
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{
          width: "100%",
          padding: "6px 8px",
          borderRadius: "4px",
          border: "none",
          fontSize: "12px",
          boxSizing: "border-box"
        }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: "240px",
            overflowY: "auto",
            background: "#2c3e50",
            border: "1px solid #1a252f",
            borderRadius: "4px",
            zIndex: 400,
            marginTop: "2px"
          }}
        >
          {filtered.slice(0, 100).map((r) => (
            <div
              key={r}
              onMouseDown={() => give(r)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#34495e")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
                color: "white",
                cursor: "pointer",
                fontSize: "12px",
                whiteSpace: "nowrap"
              }}
            >
              <img
                src={`/assets/relics/${r}.png`}
                style={{
                  width: "20px",
                  height: "20px",
                  objectFit: "contain",
                  flexShrink: 0
                }}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.visibility = "hidden"
                }}
              />
              {RELICS[r].name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Payload of Transfer.ELITE_TEST_RESULT (see stopEliteTestFight in game-commands.ts).
// Either an error (invalid request / missing or malformed opponent / no saved
// teams) or a fight summary.
interface EliteTestResult {
  error?:
    | "no_data"
    | "empty_design"
    | "invalid_target"
    | "opponent_not_found"
    | "invalid_opponent"
  stage?: string
  winner?: "elite" | "opponent" | "draw"
  eliteAlive?: number
  opponentAlive?: number
  hpPercent?: number
  durationSec?: number
  opponentName?: string
}

export default function Game() {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const connectionStatus = useAppSelector(
    (state) => state.network.connectionStatus
  )
  const room: Room<GameState> | undefined = rooms.game
  const uid: string = useAppSelector((state) => state.network.uid)
  const isAdmin = useAppSelector(
    (state) => state.network.profile?.role === Role.ADMIN
  )
  const spectatedPlayerId: string = useAppSelector(
    (state) => state.game.playerIdSpectated
  )
  const connectedPlayer = useAppSelector(selectConnectedPlayer)
  const spectatedPlayer = useAppSelector(selectSpectatedPlayer)
  const isSpectator = room?.state?.spectators?.has(uid) ?? false
  const spectate =
    isSpectator || spectatedPlayerId !== uid || !spectatedPlayer?.alive

  const initialized = useRef<boolean>(false)
  const connecting = useRef<boolean>(false)
  const connected = useRef<boolean>(false)
  const [mapVersion, setMapVersion] = useState<number>(0)
  const [mapHidden, setMapHidden] = useState<boolean>(true)
  const [runComplete, setRunComplete] = useState<boolean>(false)
  const [runFailed, setRunFailed] = useState<boolean>(false)
  const [eliteFourAvailable, setEliteFourAvailable] = useState<boolean>(false)
  const [loaded, setLoaded] = useState<boolean>(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<boolean>(false)
  const [connectError, setConnectError] = useState<string>("")
  const [spectatorCount, setSpectatorCount] = useState<number>(0)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [eliteTestResult, setEliteTestResult] =
    useState<EliteTestResult | null>(null)
  const [eliteTestAwaitingBegin, setEliteTestAwaitingBegin] =
    useState<boolean>(false)
  // One-time prompt when first arriving in the elite-test sandbox: the room
  // starts as an empty board, so tell the user to re-open the Elite Designer
  // to load their design and run tests. The test room is created BEFORE
  // navigating here, so isEliteTestActive() is already true on first render.
  const [eliteTestWelcome, setEliteTestWelcome] = useState<boolean>(() =>
    isEliteTestActive()
  )
  const [finalRank, setFinalRank] = useState<number>(0)
  enum FinalRankVisibility {
    HIDDEN,
    VISIBLE,
    CLOSED
  }
  const [finalRankVisibility, setFinalRankVisibility] =
    useState<FinalRankVisibility>(FinalRankVisibility.HIDDEN)
  const container = useRef<HTMLDivElement>(null)

  const connectToGame = useCallback(async () => {
    if (rooms.game?.connection.isOpen) {
      connected.current = true
      connecting.current = false
      dispatch(setConnectionStatus(ConnectionStatus.CONNECTED))
      return
    }

    navigate("/lobby")
  }, [dispatch])

  const leave = useCallback(async () => {
    clearGameReconnection()
    if (gameContainer && gameContainer.game) {
      gameContainer.game.destroy(true)
    }
    dispatch(leaveGame(0))
    if (room?.connection.isOpen) {
      room.leave()
    }
    navigate("/lobby")
  }, [client, dispatch, room])

  const spectateTillTheEnd = () => {
    setFinalRankVisibility(FinalRankVisibility.CLOSED)
    gameContainer.spectate = true
    if (gameContainer.gameScene) {
      gameContainer.gameScene.spectate = true
      // rerender to make items and units not dragable anymore
      gameContainer.gameScene?.board?.renderBoard(false)
      gameContainer.gameScene?.itemsContainer?.render(
        gameContainer.player!.items
      )
    }
  }

  useEffect(() => {
    // create a history entry to prevent back button switching page immediately, and leave game properly instead
    window.history.pushState(null, "", window.location.href)
    const confirmLeave = () => {
      if (confirm("Do you want to leave game ?")) {
        leave()
      } else {
        // push again another entry to prevent back button from switching page, effectively canceling the back action
        window.history.pushState(null, "", window.location.href)
      }
    }
    // when pressing back button, properly leave game
    window.addEventListener("popstate", confirmLeave)

    // pause video background for performance
    const videoBg = document.getElementById(
      "videobg"
    ) as HTMLVideoElement | null
    if (videoBg) {
      videoBg.pause()
      videoBg.style.display = "none"
    }

    return () => {
      if (videoBg) {
        videoBg.play()
        videoBg.style.display = "block"
      }
      window.removeEventListener("popstate", confirmLeave)
    }
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        getGameScene()?.board?.clearBoard()
      } else {
        getGameScene()?.board?.renderBoard(false)
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    // leaderboards removed for single-player
  }, [])

  useEffect(() => {
    if (uid && uid !== "local-player") {
      fetch(`/api/user-role/${uid}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.role) dispatch(setRole(data.role as Role))
        })
        .catch(() => {})
    }
  }, [uid])

  useEffect(() => {
    const connect = () => {
      logger.debug("connecting to game")
      authenticateUser().then(async (user) => {
        if (user && !connecting.current) {
          connecting.current = true
          await connectToGame()
        }
      })
    }

    if (rooms.game?.connection.isOpen) {
      connected.current = true
      dispatch(setConnectionStatus(ConnectionStatus.CONNECTED))
    }

    if (!connected.current) {
      connect()
    } else if (
      !initialized.current &&
      room != undefined &&
      container?.current
    ) {
      logger.debug("initializing game")
      initialized.current = true

      gameContainer = new GameContainer(container.current, uid, room)

      const gameElm = document.getElementById("game")
      gameElm?.addEventListener(Transfer.DRAG_DROP, ((
        event: CustomEvent<IDragDropMessage>
      ) => {
        gameContainer.onDragDrop(event)
      }) as EventListener)
      gameElm?.addEventListener(Transfer.DRAG_DROP_ITEM, ((
        event: CustomEvent<IDragDropItemMessage>
      ) => {
        gameContainer.onDragDropItem(event)
      }) as EventListener)
      gameElm?.addEventListener(Transfer.DRAG_DROP_COMBINE, ((
        event: CustomEvent<IDragDropCombineMessage>
      ) => {
        gameContainer.onDragDropCombine(event)
      }) as EventListener)

      room.onMessage(Transfer.LOADING_COMPLETE, () => {
        setLoaded(true)
        const savedSpeed = localStore.get(LocalStoreKeys.SPIRE_GAME_SPEED)
        if (savedSpeed && (savedSpeed === 2 || savedSpeed === 3)) {
          room.send(Transfer.GAME_SPEED, { speed: savedSpeed })
        }
      })
      room.onMessage(Transfer.FINAL_RANK, (finalRank) => {
        setFinalRank(finalRank)
        setFinalRankVisibility(FinalRankVisibility.VISIBLE)
      })
      room.onMessage(Transfer.PRELOAD_MAPS, async (maps) => {
        logger.info("preloading maps", maps)
        const gameScene = getGameScene()
        if (gameScene) {
          await gameScene.preloadMaps(maps)
          gameScene.load
            .once("complete", () => {
              if (room.state.phase !== GamePhaseState.TOWN) {
                // map loaded after the end of the portal carousel stage, we swap it now. better later than never
                gameContainer &&
                  gameContainer.player &&
                  gameScene.setMap(gameContainer.player.map)
              }
            })
            .start()
        }
      })
      room.onMessage(Transfer.SHOW_EMOTE, (message) => {
        const g = getGameScene()
        if (
          g?.minigameManager?.pokemons?.size &&
          g.minigameManager.pokemons.size > 0
        ) {
          // early return here to prevent showing animation twice
          return g.minigameManager?.showEmote(message.id, message?.emote)
        }

        if (g && g.board) {
          g.board.showEmote(message.id, message?.emote)
        }
      })
      room.onMessage(
        Transfer.COOK,
        async (message: { pokemonId: string; dishes: Item[] }) => {
          const g = getGameScene()
          if (g && g.board) {
            const pokemon = g.board.pokemons.get(message.pokemonId)
            if (pokemon) {
              pokemon.cookAnimation(message.dishes)
            }
          }
        }
      )

      room.onMessage(
        Transfer.DIG,
        async (message: { pokemonId: string; buriedItem: Item | null }) => {
          setTimeout(() => {
            const g = getGameScene()
            if (g && g.board) {
              const pokemon = g.board.pokemons.get(message.pokemonId)
              if (pokemon) {
                pokemon.digAnimation(message.buriedItem)
              }
            }
          }, 500)
        }
      )

      room.onMessage(Transfer.POKEMON_DAMAGE, (message) => {
        gameContainer.handleDisplayDamage(message)
      })

      room.onMessage(Transfer.ABILITY, (message) => {
        gameContainer.handleDisplayAbility(message)
      })

      room.onMessage(Transfer.POKEMON_HEAL, (message) => {
        gameContainer.handleDisplayHeal(message)
      })

      room.onMessage(Transfer.PLAYER_DAMAGE, (value) => {
        toast(
          <div className="toast-player-damage">
            <span style={{ verticalAlign: "middle" }}>-{value}</span>
            <img className="icon-life" src="/assets/ui/heart.png" alt="❤" />
          </div>,
          { containerId: "toast-life" }
        )
      })

      room.onMessage(Transfer.PLAYER_INCOME, showMoneyToast)

      room.onMessage(Transfer.BOARD_EVENT, (event: IBoardEvent) => {
        if (gameContainer.game) {
          const g = getGameScene()
          if (g?.battle?.simulation?.id === event.simulationId) {
            g.battle.displayBoardEvent(event)
          }
        }
      })

      room.onMessage(Transfer.CLEAR_BOARD_EVENT, (event: IBoardEvent) => {
        //logger.debug("Received CLEAR_BOARD_EVENT", event)
        if (gameContainer.game) {
          const g = getGameScene()
          if (g?.battle?.simulation?.id === event.simulationId) {
            g.battle.removeBoardEvent(event)
          }
        }
      })

      room.onMessage(
        Transfer.CLEAR_BOARD,
        (event: { simulationId: string }) => {
          if (gameContainer.game) {
            const g = getGameScene()
            if (g?.battle?.simulation?.id === event.simulationId) {
              g.battle.clearBoardEvents()
            }
          }
        }
      )

      room.onMessage(Transfer.SIMULATION_STOP, () => {
        if (gameContainer.game) {
          const g = getGameScene()
          if (g && g.battle) {
            g.battle.clear()
          }
        }
      })

      room.onMessage(Transfer.SERVER_ANNOUNCEMENT, (message: string) => {
        setAnnouncement(message)
      })

      // Tutorial: scripted dialog steps. Relayed as a window event so the
      // TutorialDialog overlay manages its own queue outside this big component.
      room.onMessage(
        Transfer.TUTORIAL_DIALOG,
        (msg: { trigger: string; steps: string[] }) => {
          window.dispatchEvent(
            new CustomEvent("tutorial-dialog", { detail: msg })
          )
        }
      )

      room.onMessage(Transfer.ELITE_TEST_RESULT, (result: EliteTestResult) => {
        setEliteTestResult(result)
      })

      // Success-rate measurement progress/result from the elite test sandbox.
      // Relayed as a window event so the Elite Designer library (which lives in
      // the sidebar modal, outside this component tree) can show live progress.
      room.onMessage(Transfer.ELITE_MEASURE_UPDATE, (update: unknown) => {
        window.dispatchEvent(
          new CustomEvent("elite-measure-update", { detail: update })
        )
      })

      room.onMessage(Transfer.GAME_END, leave)

      room.onMessage(Transfer.DRAG_DROP_CANCEL, (message) =>
        gameContainer.handleDragDropCancel(message)
      )

      room.onMessage(
        Transfer.DISPLAY_TEXT,
        (message: { text: DisplayText; id: string; x: number; y: number }) => {
          const g = getGameScene()
          if (g?.battle?.simulation?.id === message.id && message.text) {
            const coordinates = transformEntityCoordinates(
              message.x,
              message.y,
              g?.battle?.flip
            )
            gameContainer.gameScene?.board?.displayText(
              coordinates[0],
              coordinates[1],
              t(message.text).toUpperCase(),
              true
            )
          }
        }
      )

      room.onLeave(() => {
        dispatch(setConnectionStatus(ConnectionStatus.CONNECTION_FAILED))
      })

      const $ = getStateCallbacks(room)
      const $state = $(room.state)

      $state.listen("gameMode", (mode) => {
        dispatch(setGameMode(mode))
      })

      $state.listen("roundTime", (value) => {
        dispatch(setRoundTime(value))
      })

      $state.listen("phase", (newPhase, previousPhase) => {
        if (gameContainer.game) {
          const g = getGameScene()
          if (g) {
            g.updatePhase(newPhase, previousPhase)
          }
        }
        dispatch(setPhase(newPhase))
        if (previousPhase !== undefined) {
          setMapHidden(newPhase !== GamePhaseState.MAP)
        }
      })

      $state.listen("eliteTestAwaitingBegin", (value) => {
        setEliteTestAwaitingBegin(value)
        if (value) {
          setEliteTestResult(null) // a new preview staged; clear old result
          // Staging is a PICK→PICK change (no phase transition), so re-render the
          // board to draw both teams. Deferred so the rest of the state patch
          // (spireEncounterBoard, the design board) is fully applied first.
          setTimeout(() => getGameScene()?.board?.pickMode(true), 0)
        }
      })

      $state.listen("stageLevel", (value) => {
        dispatch(setStageLevel(value))
      })

      $state.listen("runHP", (value) => {
        dispatch(setRunHP(value))
      })

      $state.listen("difficultyMode", (value) => {
        dispatch(setDifficultyMode(value))
      })

      $state.listen("isEndless", (value) => {
        dispatch(setIsEndless(value))
      })

      $state.listen("isSpire", (value) => {
        dispatch(setIsSpire(value))
      })

      $state.listen("isTutorial", (value) => {
        dispatch(setIsTutorial(value))
      })

      $state.listen("spireClass", (value) => {
        dispatch(setSpireClass(value))
      })

      $state.listen("currentAct", (value) => {
        dispatch(setCurrentAct(value))
      })

      $state.listen("currentFloor", (value) => {
        dispatch(setCurrentFloor(value))
      })

      $state.listen("encounterDifficulty", (value) => {
        dispatch(setEncounterDifficulty(value))
      })
      $state.listen("encounterMoney", (value) => {
        dispatch(setEncounterMoney(value))
      })
      $state.listen("encounterPokemonCount", (value) => {
        dispatch(setEncounterPokemonCount(value))
      })
      $state.listen("encounterTotalStars", (value) => {
        dispatch(setEncounterTotalStars(value))
      })
      $state.listen("encounterTotalItems", (value) => {
        dispatch(setEncounterTotalItems(value))
      })
      $state.listen("encounterName", (value) => {
        dispatch(setEncounterName(value))
      })
      $state.listen("encounterAvatar", (value) => {
        dispatch(setEncounterAvatar(value))
      })

      const syncEncounterInventory = () => {
        dispatch(
          setEncounterInventory(Array.from(room.state.encounterInventory))
        )
      }
      $state.encounterInventory.onChange(syncEncounterInventory)
      $state.encounterInventory.onAdd(syncEncounterInventory)
      $state.encounterInventory.onRemove(syncEncounterInventory)

      const syncEncounterGroundHoles = () => {
        dispatch(
          setEncounterGroundHoles(Array.from(room.state.encounterGroundHoles))
        )
      }
      $state.encounterGroundHoles.onChange(syncEncounterGroundHoles)
      $state.encounterGroundHoles.onAdd(syncEncounterGroundHoles)
      $state.encounterGroundHoles.onRemove(syncEncounterGroundHoles)

      // Re-render the board when the opponent's preview team (spireEncounterBoard)
      // syncs. The opponent board is set and the PICK phase entered in the same
      // server tick, so the synchronous renderBoard() in the phase listener can run
      // before the board array is decoded (the data arrives empty) — this redraws
      // it once the array lands. Coalesced + deferred so a multi-element patch
      // triggers a single render after the whole patch is applied. Gated to PICK
      // mode so it never disturbs the live battle (BATTLE) or the map (MAP).
      let encounterBoardRenderQueued = false
      const rerenderEncounterBoard = () => {
        if (encounterBoardRenderQueued) return
        encounterBoardRenderQueued = true
        setTimeout(() => {
          encounterBoardRenderQueued = false
          const g = getGameScene()
          if (g?.board && g.board.mode === BoardMode.PICK) {
            g.board.renderBoard(false)
          }
        }, 0)
      }
      $state.spireEncounterBoard.onAdd(rerenderEncounterBoard)
      $state.spireEncounterBoard.onChange(rerenderEncounterBoard)
      $state.spireEncounterBoard.onRemove(rerenderEncounterBoard)

      $state.listen("runComplete", (value) => {
        setRunComplete(value)
        if (value) {
          clearGameReconnection()
          const g = getGameScene()
          if (g?.board) g.board.pickMode(false)
        }
      })

      $state.listen("runFailed", (value) => {
        if (value) {
          setRunFailed(true)
          clearGameReconnection()
          const g = getGameScene()
          if (g?.board) g.board.pickMode(false)
        }
      })

      $state.listen("eliteFourAvailable", (value) => {
        setEliteFourAvailable(value)
      })

      $state.listen("gameSpeed", (value) => {
        dispatch(setGameSpeed(value))
      })

      $state.listen("arceusDamageDealt", (value) => {
        dispatch(setArceusDamageDealt(value))
      })

      $state.listen("isNewArceusRecord", (value) => {
        dispatch(setIsNewArceusRecord(value))
      })

      $state.listen("previousArceusRecord", (value) => {
        dispatch(setPreviousArceusRecord(value))
      })

      $state.listen("previousArceusHolder", (value) => {
        dispatch(setPreviousArceusHolder(value))
      })

      $state.listen("noElo", (value) => {
        dispatch(setNoELO(value))
      })

      $state.listen("specialGameRule", (value) => {
        dispatch(setSpecialGameRule(value))
      })

      $state.additionalPokemons.onChange(() => {
        dispatch(
          setAdditionalPokemons(schemaValues(room.state.additionalPokemons))
        )
      })

      $state.simulations.onRemove(() => {
        gameContainer.resetSimulation()
      })

      $state.simulations.onAdd((simulation) => {
        gameContainer.initializeSimulation(simulation)
        const $simulation = $(simulation)

        $simulation.listen("weather", (value) => {
          dispatch(setWeather({ id: simulation.id, value: value }))
        })

        const teams = [Team.BLUE_TEAM, Team.RED_TEAM]
        teams.forEach((team) => {
          const $dpsMeter =
            team === Team.BLUE_TEAM
              ? $simulation.blueDpsMeter
              : $simulation.redDpsMeter
          $dpsMeter.onAdd((dps) => {
            dispatch(addDpsMeter({ value: dps, id: simulation.id, team }))
            const $dps = $(dps)
            const fields = [
              "id",
              "name",
              "physicalDamage",
              "specialDamage",
              "trueDamage",
              "heal",
              "shield",
              "physicalDamageReduced",
              "specialDamageReduced",
              "shieldDamageTaken"
            ] satisfies NonFunctionPropNames<IDps>[]
            fields.forEach((field) => {
              $dps.listen(field, (value) => {
                dispatch(
                  changeDpsMeter({
                    id: dps.id,
                    team,
                    field: field,
                    value: value,
                    simulationId: simulation.id
                  })
                )
              })
            })
          })

          $dpsMeter.onRemove((dps) => {
            dispatch(
              removeDpsMeter({ id: dps.id, team, simulationId: simulation.id })
            )
          })
        })
      })

      $state.players.onAdd((player) => {
        dispatch(addPlayer(player))
        gameContainer.initializePlayer(player)
        const $player = $(player)

        const isViewedPlayer = () =>
          player.id === uid || (room?.state?.spectators?.has(uid) ?? false)
        if (isViewedPlayer()) {
          dispatch(setInterest(player.interest))
          dispatch(setMaxInterest(player.maxInterest))
          dispatch(setStreak(player.streak))
          dispatch(setShopLocked(player.shopLocked))
          dispatch(setShopFreeRolls(player.shopFreeRolls))
          dispatch(setEmotesUnlocked(player.emotesUnlocked))

          $player.listen("interest", (value) => {
            dispatch(setInterest(value))
          })
          $player.listen("maxInterest", (value) => {
            dispatch(setMaxInterest(value))
          })
          $player.shop.onChange((pkm: Pkm, index: number) => {
            dispatch(changeShop({ value: pkm, index }))
          })
          $player.listen("shopLocked", (value) => {
            dispatch(setShopLocked(value))
          })
          $player.listen("shopFreeRolls", (value) => {
            dispatch(setShopFreeRolls(value))
          })
          $player.listen("money", (value, previousValue) => {
            dispatch(setMoney(value))
            if (value - previousValue >= 30) {
              showMoneyToast(value - previousValue)
            }
          })
          $player.listen("streak", (value) => {
            dispatch(setStreak(value))
          })
          $player.choices.onChange(() => {
            dispatch(
              changePlayer({
                id: player.id,
                field: "choices",
                value: schemaValues(player.choices)
              })
            )
          })
          // Mirror the player's items into Redux so UI that reads connectedPlayer.items
          // (e.g. Spire reward-reroll ticket buttons) stays current. The
          // game-container item listeners only re-render the Phaser inventory.
          const syncItems = () =>
            dispatch(
              changePlayer({
                id: player.id,
                field: "items",
                value: Array.from(player.items)
              })
            )
          $player.items.onAdd(syncItems)
          $player.items.onRemove(syncItems)
          $player.items.onChange(syncItems)
        }
        $player.listen("life", (value, previousValue) => {
          dispatch(setLife({ id: player.id, value: value }))
          if (
            value <= 0 &&
            value !== previousValue &&
            player.id === uid &&
            !spectate &&
            finalRankVisibility === FinalRankVisibility.HIDDEN
          ) {
            setFinalRankVisibility(FinalRankVisibility.VISIBLE)
            getGameScene()?.input.keyboard?.removeAllListeners()
          }
        })
        $player.listen("experienceManager", (experienceManager) => {
          const $experienceManager = $(experienceManager)
          if (isViewedPlayer()) {
            dispatch(updateExperienceManager(experienceManager))
            const fields = [
              "experience",
              "expNeeded",
              "level"
            ] satisfies NonFunctionPropNames<IExperienceManager>[]
            fields.forEach((field) => {
              $experienceManager.listen(field, (value) => {
                dispatch(
                  updateExperienceManager({
                    ...experienceManager,
                    [field]: value
                  } as IExperienceManager)
                )
              })
            })
          }
          $experienceManager.listen("level", (value) => {
            if (value > 1) {
              toast(
                <p>
                  {t("level")} {value}
                </p>,
                {
                  containerId: player.rank.toString(),
                  className: "toast-level-up"
                }
              )
            }
          })
        })
        $player.listen("loadingProgress", (value) => {
          dispatch(setLoadingProgress({ id: player.id, value: value }))
        })
        $player.listen("map", (newMap) => {
          if (player.id === store.getState().game.playerIdSpectated) {
            const gameScene = getGameScene()
            // Only auto-switch music while in "auto" mode — a jukebox pick
            // (manual/shuffle) must survive map changes (Spire resets the map
            // to "town" after every node, which used to clobber it back to
            // Treasure Town).
            if (gameScene && getMusicMode() === "auto") {
              const alreadyLoading = gameScene.load.isLoading()
              if (!alreadyLoading) {
                gameScene.load.reset()
              }
              preloadMusic(gameScene, RegionDetails[newMap].music)
              gameScene.load.once("complete", () =>
                playMusic(gameScene, RegionDetails[newMap].music)
              )
              if (!alreadyLoading) {
                gameScene.load.start()
              }
            }
          }
          dispatch(changePlayer({ id: player.id, field: "map", value: newMap }))
        })

        $player.listen("spectatedPlayerId", (spectatedPlayerId) => {
          if (room?.state?.players) {
            const spectatedPlayer = room?.state?.players.get(spectatedPlayerId)
            if (spectatedPlayer && player.id === uid) {
              gameContainer.setPlayer(spectatedPlayer)

              const simulation = room.state.simulations.get(
                spectatedPlayer.simulationId
              )
              if (simulation) {
                gameContainer.setSimulation(simulation)
              }
            }

            gameContainer.gameScene?.board?.updateScoutingAvatars()
          }
        })

        const fields = [
          "name",
          "avatar",
          "boardSize",
          "experienceManager",
          "money",
          "history",
          "life",
          "opponentId",
          "opponentName",
          "opponentAvatar",
          "opponentTitle",
          "rank",
          "regionalPokemons",
          "streak",
          "title",
          "eggChance",
          "goldenEggChance",
          "cellBattery",
          "gameStats",
          "scarvesItems",
          "fairyWands"
        ] satisfies NonFunctionPropNames<IPlayer>[]

        fields.forEach((field) => {
          $player.listen(field, (value) => {
            dispatch(
              changePlayer({ id: player.id, field: field, value: value })
            )
          })
        })

        $player.synergies.onChange(() => {
          dispatch(setSynergies({ id: player.id, value: player.synergies }))
        })

        $player.groundHoles.onChange((value) => {
          if (player.id === store.getState().game.playerIdSpectated) {
            const gameScene = getGameScene()
            if (gameScene?.board && room.state.phase === GamePhaseState.PICK) {
              gameScene.board.renderGroundHoles()
            }
          }
        })

        $player.listen("mulch", (value) => {
          dispatch(changePlayer({ id: player.id, field: "mulch", value }))
          getGameScene()?.board?.updateMulchCount()
        })
        $player.listen("mulchCap", (value) => {
          dispatch(changePlayer({ id: player.id, field: "mulchCap", value }))
          getGameScene()?.board?.updateMulchCount()
        })

        $player.wanderers.onAdd((wanderer: Wanderer) => {
          if (
            gameContainer.game &&
            player.id === store.getState().network.uid
          ) {
            const g = getGameScene()
            if (g && g.wandererManager) {
              g.wandererManager.addWanderer(wanderer)
            }
          }
        })

        $player.wanderers.onRemove((wanderer: Wanderer) => {
          if (player.id === store.getState().network.uid) {
            const g = getGameScene()
            if (g && g.wandererManager) {
              g.wandererManager.removeWanderer(wanderer.id)
            }
          }
        })
      })

      $state.players.onRemove((player) => {
        dispatch(removePlayer(player))
      })

      $state.mapNodes.onAdd(() => {
        setMapVersion((v) => v + 1)
      })
      $state.mapNodes.onRemove(() => {
        setMapVersion((v) => v + 1)
      })
      $state.mapEdges.onAdd(() => {
        setMapVersion((v) => v + 1)
      })
      $state.mapEdges.onRemove(() => {
        setMapVersion((v) => v + 1)
      })

      $state.spectators.onAdd((spectatorUid) => {
        gameContainer.initializeSpectactor(spectatorUid)
        setSpectatorCount(room?.state?.spectators?.size ?? 0)
        if (spectatorUid === uid) {
          if (room?.state?.phase === GamePhaseState.MAP) {
            setMapHidden(false)
          }
          const hostPlayer = room?.state?.players?.values().next().value
          if (hostPlayer) {
            dispatch(setMoney(hostPlayer.money))
            dispatch(setInterest(hostPlayer.interest))
            dispatch(setMaxInterest(hostPlayer.maxInterest))
            dispatch(setStreak(hostPlayer.streak))
            dispatch(updateExperienceManager(hostPlayer.experienceManager))
          }
        }
      })
      $state.spectators.onRemove(() => {
        setSpectatorCount(room?.state?.spectators?.size ?? 0)
      })
      setSpectatorCount(room?.state?.spectators?.size ?? 0)
    }
  }, [
    connected,
    connecting,
    initialized,
    room,
    dispatch,
    client,
    uid,
    spectatedPlayerId,
    connectToGame,
    leave
  ])

  const phase = useAppSelector((state) => state.game.phase)
  const runHP = useAppSelector((state) => state.game.runHP)
  const currentAct = useAppSelector((state) => state.game.currentAct)
  const currentFloor = useAppSelector((state) => state.game.currentFloor)
  const money = useAppSelector((state) => state.game.money)
  const difficultyMode = useAppSelector((state) => state.game.difficultyMode)
  const isEndless = useAppSelector((state) => state.game.isEndless)
  const isSpire = useAppSelector((state) => state.game.isSpire)
  const isTutorial = useAppSelector((state) => state.game.isTutorial)
  // Tutorial: the "this is your run map" prompt should appear only once the map
  // is actually opened (via "Continue to Map"), not while the starter picker is up.
  const tutorialMapIntroShown = useRef<boolean>(false)
  const openMap = useCallback(() => {
    setMapHidden(false)
    if (isTutorial && !tutorialMapIntroShown.current) {
      tutorialMapIntroShown.current = true
      window.dispatchEvent(
        new CustomEvent("tutorial-dialog", {
          detail: {
            trigger: "map_intro",
            steps: ["tutorial.wild_intro", "tutorial.region_synergies"]
          }
        })
      )
    }
  }, [isTutorial])

  // Tutorial: show the welcome prompt the moment the starter picker appears, so
  // the (blocking) prompt is up before the player can choose a starter.
  const tutorialWelcomeShown = useRef<boolean>(false)
  useEffect(() => {
    if (
      isTutorial &&
      !tutorialWelcomeShown.current &&
      connectedPlayer?.choices?.some((c: any) => c.type === "starter")
    ) {
      tutorialWelcomeShown.current = true
      window.dispatchEvent(
        new CustomEvent("tutorial-dialog", {
          detail: {
            trigger: "start",
            steps: ["tutorial.welcome", "tutorial.pick_starter"]
          }
        })
      )
    }
  }, [isTutorial, connectedPlayer])
  const arceusDamageDealt = useAppSelector(
    (state) => state.game.arceusDamageDealt
  )
  const isNewArceusRecord = useAppSelector(
    (state) => state.game.isNewArceusRecord
  )
  const previousArceusRecord = useAppSelector(
    (state) => state.game.previousArceusRecord
  )
  const previousArceusHolder = useAppSelector(
    (state) => state.game.previousArceusHolder
  )
  const isMapPhase = phase === GamePhaseState.MAP
  const isRestPhase = phase === GamePhaseState.REST
  const isEventPhase = phase === GamePhaseState.EVENT
  const isShopPhase = phase === GamePhaseState.SHOP
  const isRewardPhase = phase === GamePhaseState.REWARD
  const pendingChoices = connectedPlayer?.choices ?? []
  const hasChoicesPending = pendingChoices.length > 0
  const hasPendingRewards = pendingChoices.some(
    (choice) => choice.type !== "starter"
  )
  const canForfeitPendingChoices =
    (isRewardPhase || isMapPhase) &&
    hasPendingRewards &&
    !pendingChoices.some((choice) => choice.type === "starter")
  const shouldShowRewards = isRewardPhase || (isMapPhase && hasPendingRewards)
  const isMapShowing = !mapHidden && mapVersion > 0
  const isBoardHidden = isMapShowing || isEventPhase

  return (
    <main id="game-wrapper" onContextMenu={(e) => e.preventDefault()}>
      <div id="game" ref={container}></div>
      <div id="rotate-device-overlay">
        <div className="rotate-device-icon">📱</div>
        <p>Rotate your device</p>
        <span>Pokemon Auto Spire plays in landscape</span>
      </div>
      {loaded ? (
        <>
          <MainSidebar page="game" leave={leave} leaveLabel={t("leave_game")} />
          {spectatorCount > 0 && (
            <div
              style={{
                position: "absolute",
                top: "8px",
                left: "60px",
                padding: "4px 10px",
                borderRadius: "8px",
                background: "rgba(0,0,0,0.5)",
                color: "white",
                fontSize: "12px",
                zIndex: 200
              }}
            >
              {spectatorCount} watching
            </div>
          )}
          {isSpectator && (
            <div
              style={{
                position: "absolute",
                top: "8px",
                left: spectatorCount > 0 ? "170px" : "60px",
                padding: "4px 10px",
                borderRadius: "8px",
                background: "rgba(52,152,219,0.7)",
                color: "white",
                fontSize: "12px",
                zIndex: 200,
                fontWeight: "bold"
              }}
            >
              Spectating
            </div>
          )}
          <GameRelicContainer
            relics={Array.from(
              (isSpectator ? spectatedPlayer : connectedPlayer)?.relics ?? []
            )}
          />
          <GameOpponentItems />
          {(runComplete || runFailed) &&
            (() => {
              const history = Array.from(connectedPlayer?.history ?? [])
              const battlesWon = history.filter(
                (h) => h.result === "WIN"
              ).length
              const battlesLost = history.filter(
                (h) => h.result === "DEFEAT"
              ).length
              const totalGold =
                connectedPlayer?.gameStats?.totalMoneyEarned ?? 0
              return (
                <GameRunEnd
                  victory={runComplete}
                  runHP={runHP}
                  battlesWon={battlesWon}
                  battlesLost={battlesLost}
                  totalGold={totalGold}
                  difficultyMode={difficultyMode}
                  eliteFourAvailable={eliteFourAvailable}
                  currentAct={currentAct}
                  arceusDamageDealt={arceusDamageDealt}
                  isNewArceusRecord={isNewArceusRecord}
                  previousArceusRecord={previousArceusRecord}
                  previousArceusHolder={previousArceusHolder}
                  onEnterEliteFour={
                    eliteFourAvailable
                      ? () => {
                          rooms.game?.send(Transfer.ENTER_ELITE_FOUR)
                          setRunComplete(false)
                          setRunFailed(false)
                          setEliteFourAvailable(false)
                          setMapHidden(false)
                        }
                      : undefined
                  }
                  onChallengeArceus={
                    currentAct === 4
                      ? () => {
                          rooms.game?.send(Transfer.ENTER_ACT_5)
                          setRunComplete(false)
                          setRunFailed(false)
                          setMapHidden(false)
                        }
                      : undefined
                  }
                />
              )
            })()}
          <GameFinalRank
            rank={finalRank}
            hide={spectateTillTheEnd}
            leave={leave}
            visible={finalRankVisibility === FinalRankVisibility.VISIBLE}
          />
          {isMapShowing && room?.state && (
            <GameMap
              key={mapVersion}
              mapNodes={room.state.mapNodes as any}
              mapEdges={Array.from(room.state.mapEdges ?? [])}
              currentAct={currentAct}
              currentFloor={currentFloor}
              runHP={runHP}
              difficultyMode={difficultyMode}
              isEndless={isEndless}
              onHide={() => setMapHidden(true)}
              readOnly={
                spectate ||
                (!isMapPhase && (connectedPlayer?.choices?.length ?? 0) > 0)
              }
              showRerollMap={
                !spectate &&
                !isSpire &&
                (connectedPlayer?.choices?.some(
                  (c: any) => c.type === "starter"
                ) ??
                  false)
              }
              hasChoicesPending={hasChoicesPending}
              canForfeitPendingChoices={canForfeitPendingChoices}
              isMapPhase={isMapPhase}
              isAdmin={isAdmin}
            />
          )}
          {isRestPhase && room?.state && (
            <GameRest
              runHP={runHP}
              choices={Array.from(room.state.spireEventChoiceLabels ?? []).map(
                (label, i) => ({
                  label,
                  description: room.state.spireEventChoiceDescs?.[i] ?? ""
                })
              )}
              readOnly={spectate}
            />
          )}
          {isEventPhase && room?.state && (
            <GameEventOverlay
              eventName={room.state.spireEventName}
              eventDescription={room.state.spireEventDescription}
              portrait={room.state.spireEventPortrait}
              choices={Array.from(room.state.spireEventChoiceLabels ?? []).map(
                (label, i) => ({
                  label,
                  description: room.state.spireEventChoiceDescs?.[i] ?? ""
                })
              )}
              runHP={runHP}
              gold={money}
              readOnly={spectate}
            />
          )}
          {shouldShowRewards && <GameRewardsScreen />}
          {!spectate &&
            !runComplete &&
            !runFailed &&
            isMapPhase &&
            mapHidden &&
            mapVersion > 0 &&
            (connectedPlayer?.choices?.length ?? 1) === 0 && (
              <div
                className="game-action-float"
                style={{
                  position: "absolute",
                  bottom: "170px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 50
                }}
              >
                <button
                  onClick={openMap}
                  style={{
                    padding: "8px 24px",
                    fontSize: "16px",
                    borderRadius: "6px",
                    border: "2px solid #fff",
                    background: "#2ecc71",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  Continue to Map
                </button>
              </div>
            )}
          {!spectate &&
            phase === GamePhaseState.PICK &&
            !isEliteTestActive() && (
              <div
                className="game-action-float"
                style={{
                  position: "absolute",
                  bottom: "170px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 50
                }}
              >
                <button
                  onClick={() => rooms.game?.send(Transfer.SKIP_REWARD)}
                  style={{
                    padding: "8px 24px",
                    fontSize: "16px",
                    borderRadius: "6px",
                    border: "2px solid #fff",
                    background: "#e74c3c",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  Start Fight
                </button>
              </div>
            )}
          {!spectate &&
            phase === GamePhaseState.PICK &&
            isEliteTestActive() &&
            !eliteTestAwaitingBegin && (
              <div
                className="game-action-float"
                style={{
                  position: "absolute",
                  bottom: "170px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 50
                }}
              >
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("open-elite-designer"))
                  }
                  style={{
                    padding: "8px 24px",
                    fontSize: "16px",
                    borderRadius: "6px",
                    border: "2px solid #fff",
                    background: "#2ecc71",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  Open Elite Designer
                </button>
              </div>
            )}
          {!spectate &&
            phase === GamePhaseState.PICK &&
            isEliteTestActive() &&
            eliteTestAwaitingBegin && (
              <div
                className="game-action-float"
                style={{
                  position: "absolute",
                  bottom: "170px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 50,
                  display: "flex",
                  gap: "8px"
                }}
              >
                <button
                  onClick={() => beginEliteTest()}
                  style={{
                    padding: "8px 24px",
                    fontSize: "16px",
                    borderRadius: "6px",
                    border: "2px solid #fff",
                    background: "#27ae60",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}
                >
                  ▶ Begin
                </button>
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("open-elite-designer"))
                  }
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    borderRadius: "6px",
                    border: "2px solid #fff",
                    background: "#555",
                    color: "white",
                    cursor: "pointer"
                  }}
                >
                  Edit Design
                </button>
              </div>
            )}
          {!spectate && isShopPhase && (
            <div
              className="game-action-float"
              style={{
                position: "absolute",
                bottom: "200px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 50
              }}
            >
              <button
                onClick={() => rooms.game?.send(Transfer.SKIP_REWARD)}
                style={{
                  padding: "10px 28px",
                  fontSize: "16px",
                  borderRadius: "8px",
                  border: "2px solid #fff",
                  background: "#3498db",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                Leave Shop
              </button>
            </div>
          )}
          {!isBoardHidden && (
            <GameStageInfo onLeave={() => setShowLeaveConfirm(true)} />
          )}
          {!isBoardHidden && (
            <GameBottomBar
              onShowMap={mapVersion > 0 ? () => setMapHidden(false) : undefined}
            />
          )}
          {!isBoardHidden && <GameSynergies />}
          {!isBoardHidden && <GameOpponentSynergies />}
          {!isBoardHidden && <GameShop />}
          {!shouldShowRewards && <GameChoice />}
          <GameBalancePanel />
          <GameDpsMeter />
          <GameToasts />
          <TutorialDialog onExit={leave} />
          {isAdmin && !spectate && (
            <div
              className="game-admin-cheats"
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                zIndex: 300
              }}
            >
              <>
                <button
                  onClick={() => {
                    setRunComplete(true)
                    setEliteFourAvailable(true)
                  }}
                  style={{
                    padding: "6px 12px",
                    background: "#2ecc71",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Test Victory
                </button>
                {[1, 2, 3].map((act) => (
                  <button
                    key={act}
                    onClick={() => {
                      rooms.game?.send(Transfer.SKIP_TO_ACT, { act })
                      setRunComplete(false)
                      setRunFailed(false)
                      setMapHidden(false)
                    }}
                    style={{
                      padding: "6px 12px",
                      background: "#2c3e50",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    Skip to Act {act}
                  </button>
                ))}
                <button
                  onClick={() => rooms.game?.send(Transfer.GIVE_GOLD)}
                  style={{
                    padding: "6px 12px",
                    background: "#f39c12",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Give 999 Gold
                </button>
                <button
                  onClick={() => rooms.game?.send(Transfer.GIVE_MEWTWO)}
                  style={{
                    padding: "6px 12px",
                    background: "#3498db",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Give Mewtwo
                </button>
                <button
                  onClick={() => rooms.game?.send(Transfer.GIVE_DITTO)}
                  style={{
                    padding: "6px 12px",
                    background: "#a259c4",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Give Ditto
                </button>
                <AdminGivePokemon />
                <AdminGiveItem />
                <AdminGiveRelic />
                <button
                  onClick={() => rooms.game?.send(Transfer.ADMIN_HEAL)}
                  style={{
                    padding: "6px 12px",
                    background: "#2ecc71",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Heal
                </button>
                <button
                  onClick={() => {
                    rooms.game?.send(Transfer.ENTER_ELITE_FOUR)
                    setRunComplete(false)
                    setRunFailed(false)
                    setEliteFourAvailable(false)
                    setMapHidden(false)
                  }}
                  style={{
                    padding: "6px 12px",
                    background: "#8e44ad",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Skip to Elite 4
                </button>
                <button
                  onClick={() => {
                    rooms.game?.send(Transfer.ENTER_ACT_5)
                    setRunComplete(false)
                    setRunFailed(false)
                    setMapHidden(false)
                  }}
                  style={{
                    padding: "6px 12px",
                    background: "#9b59b6",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Skip to Act 5
                </button>
                <button
                  onClick={() => rooms.game?.send(Transfer.RESET_CHAMPION)}
                  style={{
                    padding: "6px 12px",
                    background: "#e74c3c",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Reset E4/Champion
                </button>
              </>
            </div>
          )}
        </>
      ) : (
        <GameLoadingScreen connectError={connectError} />
      )}
      <ConnectionStatusNotification />
      {announcement && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
        >
          <div
            className="my-container"
            style={{
              padding: "24px",
              maxWidth: "450px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
          >
            <h3 style={{ color: "#f1c40f", margin: 0 }}>Server Announcement</h3>
            <p
              style={{
                fontSize: "14px",
                opacity: 0.9,
                margin: 0,
                whiteSpace: "pre-wrap"
              }}
            >
              {announcement}
            </p>
            <button
              className="bubbly"
              onClick={() => setAnnouncement(null)}
              style={{ backgroundColor: "#555" }}
            >
              OK
            </button>
          </div>
        </div>
      )}
      {eliteTestWelcome && !eliteTestResult && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
        >
          <div
            className="my-container"
            style={{
              padding: "24px",
              maxWidth: "440px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <h3 style={{ color: "#f1c40f", margin: 0 }}>Test Mode</h3>
            <p style={{ margin: 0, fontSize: "14px", opacity: 0.9 }}>
              Welcome to the test sandbox — it starts as an empty board. Open
              the Elite Designer again to load your design, run test fights, and
              measure success rates.
            </p>
            <div
              style={{ display: "flex", gap: "8px", justifyContent: "center" }}
            >
              <button
                className="bubbly green"
                onClick={() => {
                  setEliteTestWelcome(false)
                  window.dispatchEvent(new CustomEvent("open-elite-designer"))
                }}
              >
                Open Elite Designer
              </button>
              <button
                className="bubbly"
                onClick={() => setEliteTestWelcome(false)}
                style={{ backgroundColor: "#555" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {eliteTestResult && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
        >
          <div
            className="my-container"
            style={{
              padding: "24px",
              maxWidth: "420px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}
          >
            <h3 style={{ color: "#f1c40f", margin: 0 }}>Elite Test Result</h3>
            {eliteTestResult.error === "no_data" ? (
              <p style={{ margin: 0 }}>
                No saved player teams for that stage yet — pick another stage.
              </p>
            ) : eliteTestResult.error === "empty_design" ? (
              <p style={{ margin: 0 }}>
                Place some Pokémon on the board first.
              </p>
            ) : eliteTestResult.error === "invalid_target" ? (
              <p style={{ margin: 0 }}>
                That test stage or difficulty is invalid. Reopen the designer
                and choose another option.
              </p>
            ) : eliteTestResult.error === "opponent_not_found" ? (
              <p style={{ margin: 0 }}>
                That library design no longer exists. Reopen the designer and
                choose another opponent.
              </p>
            ) : eliteTestResult.error === "invalid_opponent" ? (
              <p style={{ margin: 0 }}>
                That library design is empty or malformed and cannot be tested.
              </p>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <p style={{ margin: 0, fontSize: "20px", fontWeight: "bold" }}>
                  {eliteTestResult.winner === "elite"
                    ? "✅ Elite wins"
                    : eliteTestResult.winner === "opponent"
                      ? "❌ Elite loses"
                      : "🤝 Draw"}
                </p>
                <p style={{ margin: 0, fontSize: "13px", opacity: 0.9 }}>
                  vs {eliteTestResult.opponentName || "?"}
                </p>
                <p style={{ margin: 0, fontSize: "13px", opacity: 0.9 }}>
                  Elite {eliteTestResult.eliteAlive} left · Opponent{" "}
                  {eliteTestResult.opponentAlive} left
                  {eliteTestResult.winner !== "draw" &&
                    ` · winner ${eliteTestResult.hpPercent}% HP`}
                </p>
                <p style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>
                  {eliteTestResult.durationSec}s
                </p>
              </div>
            )}
            <div
              style={{ display: "flex", gap: "8px", justifyContent: "center" }}
            >
              {!eliteTestResult.error && hasLastEliteTest() && (
                <button
                  className="bubbly blue"
                  onClick={() => {
                    setEliteTestResult(null)
                    resendLastEliteTest()
                  }}
                >
                  Test again
                </button>
              )}
              <button
                className="bubbly green"
                onClick={() => {
                  setEliteTestResult(null)
                  window.dispatchEvent(new CustomEvent("open-elite-designer"))
                }}
              >
                Edit Design
              </button>
              <button
                className="bubbly"
                onClick={() => setEliteTestResult(null)}
                style={{ backgroundColor: "#555" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {connectionStatus === ConnectionStatus.CONNECTION_FAILED &&
        !runComplete &&
        !runFailed && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9998,
              color: "white"
            }}
          >
            <h2
              style={{
                margin: "0 0 8px",
                textShadow: "0 2px 8px rgba(0,0,0,0.8)"
              }}
            >
              Disconnected
            </h2>
            <p style={{ margin: "0 0 16px", opacity: 0.8, fontSize: "14px" }}>
              Your run has been saved. You can resume from the lobby.
            </p>
            <button
              onClick={leave}
              style={{
                padding: "12px 36px",
                fontSize: "18px",
                borderRadius: "8px",
                border: "none",
                background: "#e74c3c",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
                boxShadow: "0 4px 12px rgba(231,76,60,0.4)"
              }}
            >
              Return to Lobby
            </button>
          </div>
        )}
      {showLeaveConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9998,
            color: "white"
          }}
        >
          <h2
            style={{
              margin: "0 0 8px",
              textShadow: "0 2px 8px rgba(0,0,0,0.8)"
            }}
          >
            Leave Game
          </h2>
          <p style={{ margin: "0 0 20px", opacity: 0.8, fontSize: "14px" }}>
            Are you sure? You can resume later.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={leave}
              style={{
                padding: "12px 36px",
                fontSize: "18px",
                borderRadius: "8px",
                border: "none",
                background: "#e74c3c",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold",
                boxShadow: "0 4px 12px rgba(231,76,60,0.4)"
              }}
            >
              Leave
            </button>
            <button
              onClick={() => setShowLeaveConfirm(false)}
              style={{
                padding: "12px 36px",
                fontSize: "18px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.3)",
                background: "transparent",
                color: "white",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
