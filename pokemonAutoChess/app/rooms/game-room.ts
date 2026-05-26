import { Dispatcher } from "@colyseus/command"
import { MapSchema } from "@colyseus/schema"
import admin from "firebase-admin"
import { Client, Room } from "colyseus"
import {
  MAX_LOADING_TIME,
  MAX_SIMULATION_DELTA_TIME
} from "../config"
import { CountEvolutionRule, ItemEvolutionRule } from "../core/evolution-rules"
import { MiniGame } from "../core/mini-game"
import { IGameUser } from "../models/colyseus-models/game-user"
import Player from "../models/colyseus-models/player"
import { Egg, Pokemon } from "../models/colyseus-models/pokemon"
import PokemonFactory from "../models/pokemon-factory"
import {
  getPokemonData,
  PRECOMPUTED_REGIONAL_MONS
} from "../models/precomputed/precomputed-pokemon-data"
import { PRECOMPUTED_POKEMONS_PER_RARITY } from "../models/precomputed/precomputed-rarity"
import { getAdditionalsTier1, getSellPrice } from "../models/shop"
import {
  IDragDropCombineMessage,
  IDragDropItemMessage,
  IDragDropMessage,
  IGameHistoryPokemonRecord,
  IGameHistorySimplePlayer,
  IGameMetadata,
  IPokemon,
  IPokemonEntity,
  Role,
  Title,
  Transfer
} from "../types"
import { EloRank } from "../types/enum/EloRank"
import { BattleResult, GameMode, GamePhaseState, PokemonActionState, Rarity } from "../types/enum/Game"
import { Item, SynergyGem, SynergyGivenByGem, Wands } from "../types/enum/Item"
import { Passive } from "../types/enum/Passive"
import {
  Pkm,
  PkmDuos,
  PkmIndex,
  PkmRegionalVariants
} from "../types/enum/Pokemon"
import { SpecialGameRule } from "../types/enum/SpecialGameRule"
import { Synergy } from "../types/enum/Synergy"
import type { IDetailledPokemon } from "../types/models/bot-v2"
import { isIn, removeInArray } from "../utils/array"
import { getAvatarString } from "../utils/avatar"
import {
  getFirstAvailablePositionInBench,
  getFreeSpaceOnBench
} from "../utils/board"
import { logger } from "../utils/logger"
import { shuffleArray } from "../utils/random"
import { schemaValues } from "../utils/schemas"
import {
  OnBuyPokemonCommand,
  OnDragDropCombineCommand,
  OnDragDropItemCommand,
  OnDragDropPokemonCommand,
  OnJoinCommand,
  OnLevelUpCommand,
  OnLockCommand,
  OnOverwriteBoardCommand,
  OnPickBerryCommand,
  OnPokemonCatchCommand,
  OnRemoveFromShopCommand,
  OnSellPokemonCommand,
  OnShopRerollCommand,
  OnSpectateCommand,
  OnSwitchBenchAndBoardCommand,
  OnUpdateCommand,
  OnUpdatePhaseCommand
} from "./commands/game-commands"
import GameState from "./states/game-state"

export default class GameRoom extends Room<{ state: GameState }> {
  dispatcher: Dispatcher<this>
  additionalUncommonPool: Array<Pkm>
  additionalRarePool: Array<Pkm>
  additionalEpicPool: Array<Pkm>
  miniGame: MiniGame
  isResume: boolean = false
  constructor() {
    super()
    this.dispatcher = new Dispatcher(this)
    this.additionalUncommonPool = new Array<Pkm>()
    this.additionalRarePool = new Array<Pkm>()
    this.additionalEpicPool = new Array<Pkm>()
    this.miniGame = new MiniGame(this)
  }

  // When room is initialized
  async onCreate({
    users,
    preparationId,
    name,
    ownerName,
    noElo,
    gameMode,
    specialGameRule,
    minRank,
    maxRank,
    tournamentId,
    bracketId,
    difficultyMode,
    resume
  }: {
    users: Record<string, IGameUser>
    preparationId: string
    name: string
    ownerName: string
    noElo: boolean
    gameMode: GameMode
    specialGameRule: SpecialGameRule | null
    minRank: EloRank | null
    maxRank: EloRank | null
    tournamentId: string | null
    bracketId: string | null
    difficultyMode?: number
    resume?: boolean
  }) {
    const diffLabel = difficultyMode === 0 ? "Easy" : difficultyMode === 2 ? "Hard" : "Normal"
    const playerName = ownerName || Object.values(users || {})[0]?.name || "Unknown"
    logger.info(`Create Game ${this.roomId} | player: ${playerName} | difficulty: ${diffLabel}`)

    this.setMetadata(<IGameMetadata>{
      name,
      ownerName,
      gameMode,
      playerIds: Object.keys(users).filter((id) => users[id].isBot === false),
      playersInfo: Object.keys(users).map(
        (u) => `${users[u].name} [${users[u].elo}]`
      ),
      stageLevel: 0,
      type: "game",
      tournamentId,
      bracketId
    })
    // logger.debug(options);
    this.state = new GameState(
      preparationId,
      name,
      noElo,
      gameMode,
      minRank,
      maxRank,
      specialGameRule
    )
    if (difficultyMode === 0 || difficultyMode === 2) {
      this.state.difficultyMode = difficultyMode
    }
    this.isResume = !!resume
    this.miniGame.create(
      this.state.avatars,
      this.state.floatingItems,
      this.state.portals,
      this.state.symbols
    )

    this.additionalUncommonPool = getAdditionalsTier1(
      PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON
    )
    this.additionalRarePool = getAdditionalsTier1(
      PRECOMPUTED_POKEMONS_PER_RARITY.RARE
    )
    this.additionalEpicPool = getAdditionalsTier1(
      PRECOMPUTED_POKEMONS_PER_RARITY.EPIC
    )

    if (this.state.specialGameRule !== SpecialGameRule.EVERYONE_IS_HERE) {
      /* based on the season, we remove the Deerling seasonal forms to only keep the current season's form */
      // Determine season based on precise date, not just month
      const now = new Date()
      const year = now.getFullYear()
      const date = new Date(year, now.getMonth(), now.getDate())

      // seasons (Northern Hemisphere)
      // Spring: Mar 20 - June 21
      // Summer: Jun 22 - Sep 22
      // Autumn: Sep 23 - Dec 20
      // Winter: Dec 21 - Mar 19

      let season: "spring" | "summer" | "autumn" | "winter"
      const springStart = new Date(year, 2, 20) // Mar 20
      const summerStart = new Date(year, 5, 22) // Jun 22
      const autumnStart = new Date(year, 8, 23) // Sep 23
      const winterStart = new Date(year, 11, 21) // Dec 21

      if (date >= springStart && date < summerStart) {
        season = "spring"
      } else if (date >= summerStart && date < autumnStart) {
        season = "summer"
      } else if (date >= autumnStart && date < winterStart) {
        season = "autumn"
      } else {
        season = "winter"
      }

      // Remove all Deerling forms except the current season's
      this.additionalRarePool = this.additionalRarePool.filter((p) => {
        if (
          (p === Pkm.DEERLING_SPRING && season !== "spring") ||
          (p === Pkm.DEERLING_SUMMER && season !== "summer") ||
          (p === Pkm.DEERLING_AUTUMN && season !== "autumn") ||
          (p === Pkm.DEERLING_WINTER && season !== "winter")
        ) {
          return false
        }
        return true
      })
    }

    shuffleArray(this.additionalUncommonPool)
    shuffleArray(this.additionalRarePool)
    shuffleArray(this.additionalEpicPool)

    if (this.state.specialGameRule === SpecialGameRule.EVERYONE_IS_HERE) {
      this.additionalUncommonPool.forEach((p) =>
        this.state.shop.addAdditionalPokemon(p, this.state)
      )
      this.additionalRarePool.forEach((p) =>
        this.state.shop.addAdditionalPokemon(p, this.state)
      )
      this.additionalEpicPool.forEach((p) =>
        this.state.shop.addAdditionalPokemon(p, this.state)
      )
    }

    await Promise.all(
      Object.keys(users).map(async (id) => {
        const user = users[id]
        if (user.isBot) {
          const player = new Player(
            user.uid,
            user.name,
            user.elo,
            user.games + 1,
            user.avatar,
            true,
            this.state.players.size + 1,
            new Map(),
            "",
            Role.BOT,
            this.state
          )
          this.state.players.set(user.uid, player)
          this.state.botManager.addBot(player)
        } else {
          const player = new Player(
            user.uid,
            user.name,
            user.elo,
            1,
            user.avatar,
            false,
            this.state.players.size + 1,
            new Map(),
            "",
            Role.BASIC,
            this.state
          )
          this.state.players.set(user.uid, player)
          this.state.shop.assignShop(player, false, this.state)
        }
      })
    )

    this.clock.setTimeout(() => {
      if (this.state.gameLoaded) return
      this.broadcast(Transfer.LOADING_COMPLETE)
      if (this.isResume) {
        this.resumeGame()
      } else {
        this.startGame()
      }
    }, MAX_LOADING_TIME)

    this.onMessage(Transfer.SHOP, (client, message) => {
      if (!this.state.gameFinished && client.auth) {
        try {
          this.dispatcher.dispatch(new OnBuyPokemonCommand(), {
            playerId: client.auth.uid,
            index: message.id
          })
        } catch (error) {
          logger.error("shop error", message, error)
        }
      }
    })

    this.onMessage(Transfer.REMOVE_FROM_SHOP, (client, index) => {
      if (!this.state.gameFinished && client.auth) {
        try {
          this.dispatcher.dispatch(new OnRemoveFromShopCommand(), {
            playerId: client.auth.uid,
            index
          })
        } catch (error) {
          logger.error("remove from shop error", index, error)
        }
      }
    })

    this.onMessage(
      Transfer.CHOICE,
      (client, message: { choiceId: string; choiceIndex: number }) => {
        if (!this.state.gameFinished && client.auth) {
          try {
            if (message.choiceId === "event") {
              const cmd = new OnUpdatePhaseCommand()
              cmd.setPayload({})
              cmd.room = this
              cmd.state = this.state
              cmd.clock = this.clock
              cmd.handleEventChoice(client.auth.uid, message.choiceIndex)
            } else if (message.choiceId === "rest") {
              const cmd = new OnUpdatePhaseCommand()
              cmd.setPayload({})
              cmd.room = this
              cmd.state = this.state
              cmd.clock = this.clock
              cmd.handleRestChoice(client.auth.uid, message.choiceIndex)
              this.state.updatePhaseNeeded = true
              this.state.time = 0
            } else {
              this.pickChoice(
                client.auth.uid,
                message.choiceId,
                message.choiceIndex
              )
            }
          } catch (error) {
            logger.error(error)
          }
        }
      }
    )

    this.onMessage(Transfer.REROLL_REWARD, (client) => {
      if (!this.state.gameFinished && client.auth) {
        const player = this.state.players.get(client.auth.uid)
        if (!player || player.money < 1) return
        const choiceIdx = player.choices.findIndex((c) => c.type === "wildReward")
        if (choiceIdx < 0) return
        player.choices.splice(choiceIdx, 1)
        player.money -= 1
        const node = this.state.mapNodes.get(this.state.currentNodeId)
        if (node) {
          const won = player.history.at(-1)?.result === BattleResult.WIN
          const cmd = new OnUpdatePhaseCommand()
          cmd.setPayload({})
          cmd.room = this
          cmd.state = this.state
          cmd.clock = this.clock
          cmd.generateWildRewardChoice(player, node, won, true)
        }
      }
    })

    this.onMessage(Transfer.PASS_REWARD, (client) => {
      if (!this.state.gameFinished && client.auth) {
        const player = this.state.players.get(client.auth.uid)
        if (!player) return
        const choiceIdx = player.choices.findIndex((c) => c.type === "gymReward" || c.type === "eliteReward")
        if (choiceIdx < 0) return
        player.choices.splice(choiceIdx, 1)
        player.money += 5
        if (this.state.phase === GamePhaseState.REWARD && player.choices.length === 0) {
          this.state.updatePhaseNeeded = true
          this.state.time = 0
        }
      }
    })

    this.onMessage(Transfer.DRAG_DROP, (client, message: IDragDropMessage) => {
      if (!this.state.gameFinished) {
        try {
          this.dispatcher.dispatch(new OnDragDropPokemonCommand(), {
            client: client,
            detail: message
          })
        } catch (error) {
          const errorInformation = {
            updateBoard: true,
            updateItems: true
          }
          client.send(Transfer.DRAG_DROP_CANCEL, errorInformation)
          logger.error("drag drop error", error)
        }
      }
    })

    this.onMessage(
      Transfer.DRAG_DROP_ITEM,
      (client, message: IDragDropItemMessage) => {
        if (!this.state.gameFinished) {
          try {
            this.dispatcher.dispatch(new OnDragDropItemCommand(), {
              client: client,
              detail: message
            })
          } catch (error) {
            const errorInformation = {
              updateBoard: true,
              updateItems: true
            }
            client.send(Transfer.DRAG_DROP_CANCEL, errorInformation)
            logger.error("drag drop error", error)
          }
        }
      }
    )

    this.onMessage(
      Transfer.DRAG_DROP_COMBINE,
      (client, message: IDragDropCombineMessage) => {
        if (!this.state.gameFinished) {
          try {
            this.dispatcher.dispatch(new OnDragDropCombineCommand(), {
              client: client,
              detail: message
            })
          } catch (error) {
            const errorInformation = {
              updateBoard: true,
              updateItems: true
            }
            client.send(Transfer.DRAG_DROP_CANCEL, errorInformation)
            logger.error("drag drop error", error)
          }
        }
      }
    )

    this.onMessage(
      Transfer.VECTOR,
      (client, message: { x: number; y: number }) => {
        try {
          if (client.auth) {
            this.miniGame.applyVector(client.auth.uid, message.x, message.y)
          }
        } catch (error) {
          logger.error(error)
        }
      }
    )

    this.onMessage(Transfer.SELL_POKEMON, (client, pokemonId: string) => {
      if (!this.state.gameFinished && client.auth) {
        try {
          this.dispatcher.dispatch(new OnSellPokemonCommand(), {
            client,
            pokemonId
          })
        } catch (error) {
          logger.error("sell drop error", pokemonId)
        }
      }
    })

    this.onMessage(Transfer.REFRESH, (client, message) => {
      if (!this.state.gameFinished && client.auth) {
        try {
          this.dispatcher.dispatch(new OnShopRerollCommand(), client.auth.uid)
        } catch (error) {
          logger.error("refresh error", message)
        }
      }
    })

    this.onMessage(Transfer.LOCK, (client, message) => {
      if (!this.state.gameFinished && client.auth) {
        try {
          this.dispatcher.dispatch(new OnLockCommand(), client.auth.uid)
        } catch (error) {
          logger.error("lock error", message)
        }
      }
    })

    this.onMessage(
      Transfer.SWITCH_BENCH_AND_BOARD,
      (client, pokemonId: string) => {
        if (!this.state.gameFinished && client.auth) {
          try {
            this.dispatcher.dispatch(new OnSwitchBenchAndBoardCommand(), {
              client,
              pokemonId
            })
          } catch (error) {
            logger.error("sell drop error", pokemonId)
          }
        }
      }
    )

    this.onMessage(Transfer.SPECTATE, (client, spectatedPlayerId: string) => {
      if (client.auth) {
        try {
          if (!client.userData) client.userData = {}
          client.userData.spectatedPlayerId = spectatedPlayerId
          this.dispatcher.dispatch(new OnSpectateCommand(), {
            id: client.auth.uid,
            spectatedPlayerId
          })
        } catch (error) {
          logger.error("spectate error", client.auth.uid, spectatedPlayerId)
        }
      }
    })

    this.onMessage(Transfer.LEVEL_UP, (client, message) => {
      if (!this.state.gameFinished && client.auth) {
        try {
          this.dispatcher.dispatch(new OnLevelUpCommand(), client.auth.uid)
        } catch (error) {
          logger.error("level up error", message)
        }
      }
    })

    this.onMessage(Transfer.SHOW_EMOTE, (client: Client, message?: string) => {
      if (client.auth) {
        this.broadcast(Transfer.SHOW_EMOTE, {
          id: client.auth.uid,
          emote: message
        })
      }
    })

    this.onMessage(
      Transfer.WANDERER_CLICKED,
      async (client, msg: { id: string }) => {
        if (client.auth) {
          try {
            this.dispatcher.dispatch(new OnPokemonCatchCommand(), {
              client,
              playerId: client.auth.uid,
              id: msg.id
            })
          } catch (e) {
            logger.error("catch wandering error", e)
          }
        }
      }
    )

    this.onMessage(Transfer.PICK_BERRY, async (client, index) => {
      if (!this.state.gameFinished && client.auth) {
        try {
          this.dispatcher.dispatch(new OnPickBerryCommand(), {
            playerId: client.auth.uid,
            berryIndex: index
          })
        } catch (error) {
          logger.error("error picking berry", error)
        }
      }
    })

    this.onMessage(Transfer.LOADING_PROGRESS, (client, progress: number) => {
      if (client.auth) {
        const player = this.state.players.get(client.auth.uid)
        if (player) {
          player.loadingProgress = progress
        }
      }
    })

    this.onMessage(Transfer.LOADING_COMPLETE, (client) => {
      if (client.auth) {
        const player = this.state.players.get(client.auth.uid)
        if (player) {
          player.loadingProgress = 100
        }
        if (this.state.gameLoaded) {
          client.send(Transfer.LOADING_COMPLETE)
        } else if (
          schemaValues(this.state.players).every(
            (p) => p.loadingProgress === 100
          )
        ) {
          this.broadcast(Transfer.LOADING_COMPLETE)
          if (this.isResume) {
            this.resumeGame()
          } else {
            this.startGame()
          }
        }
      }
    })

    this.onMessage(
      Transfer.OVERWRITE_BOARD,
      (client, board: IDetailledPokemon[]) => {
        if (client.auth) {
          const player = this.state.players.get(client.auth.uid)
          if (player?.role !== Role.ADMIN) return

          try {
            this.dispatcher.dispatch(new OnOverwriteBoardCommand(), {
              playerId: client.auth.uid,
              board
            })
          } catch (error) {
            logger.error("overwrite board error", error)
          }
        }
      }
    )

    this.onMessage(Transfer.SELECT_MAP_NODE, (client, nodeId: string) => {
      if (!this.state.gameFinished && client.auth) {
        try {
          const cmd = new OnUpdatePhaseCommand()
          cmd.setPayload({})
          cmd.room = this
          cmd.state = this.state
          cmd.clock = this.clock
          cmd.onSelectMapNode(nodeId)
        } catch (error) {
          logger.error("select map node error", error)
        }
      }
    })

    this.onMessage(Transfer.SKIP_REWARD, (client) => {
      if (!this.state.gameFinished && client.auth &&
        this.state.phase !== GamePhaseState.FIGHT &&
        this.state.phase !== GamePhaseState.MAP) {
        this.state.updatePhaseNeeded = true
        this.state.time = 0
      }
    })

    this.onMessage(Transfer.GAME_SPEED, (client, { speed }: { speed: number }) => {
      if (client.auth && (speed === 0.5 || speed === 1 || speed === 2 || speed === 3)) {
        this.state.gameSpeed = speed
      }
    })

    this.onMessage(Transfer.ENTER_ELITE_FOUR, (client) => {
      if (client.auth && !this.state.gameFinished) {
        const { generateActMap } = require("../core/map-generator")
        this.state.runComplete = false
        this.state.runFailed = false
        this.state.eliteFourAvailable = false
        this.state.gameFinished = false
        this.state.currentAct = 4
        this.state.currentFloor = 0
        this.state.mapNodes.clear()
        this.state.mapEdges.clear()
        generateActMap(4, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as 0 | 1 | 2)
        this.state.players.forEach((p: Player) => {
          p.dojoFamilies.clear()
          if (!p.isBot) { p.alive = true }
        })
        this.state.phase = GamePhaseState.MAP
        this.state.time = 999 * 1000
        this.state.roundTime = 999
      }
    })

    this.onMessage(Transfer.ENTER_ACT_5, (client) => {
      if (client.auth && (!this.state.gameFinished || this.state.runComplete)) {
        const { generateActMap } = require("../core/map-generator")
        this.state.runComplete = false
        this.state.runFailed = false
        this.state.eliteFourAvailable = false
        this.state.gameFinished = false
        this.state.arceusDamageDealt = 0
        this.state.currentAct = 5
        this.state.currentFloor = 0
        this.state.mapNodes.clear()
        this.state.mapEdges.clear()
        generateActMap(5, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as 0 | 1 | 2)
        this.state.players.forEach((p: Player) => {
          p.dojoFamilies.clear()
          if (!p.isBot) { p.alive = true }
        })
        this.state.phase = GamePhaseState.MAP
        this.state.time = 999 * 1000
        this.state.roundTime = 999
      }
    })

    this.onMessage(Transfer.RESET_CHAMPION, (client) => {
      if (!client.auth) return
      const { resetChampionData } = require("../services/champion-data")
      resetChampionData()
    })

    this.onMessage(Transfer.SKIP_TO_ACT, (client, { act }: { act: number }) => {
      if (!client.auth || this.state.gameFinished) return
      const playerName = Array.from(this.state.players.values()).find(
        (p: Player) => !p.isBot && p.id === client.auth.uid
      )?.name
      if (playerName !== "Fisho" && playerName !== "Fisho2") return
      if (act < 1 || act > 3) return
      const { generateActMap } = require("../core/map-generator")
      this.state.runComplete = false
      this.state.runFailed = false
      this.state.eliteFourAvailable = false
      this.state.gameFinished = false
      this.state.currentAct = act
      this.state.currentFloor = 0
      this.state.mapNodes.clear()
      this.state.mapEdges.clear()
      generateActMap(act, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as 0 | 1 | 2)
      this.state.players.forEach((p: Player) => {
        p.dojoFamilies.clear()
        if (!p.isBot) { p.alive = true }
      })
      this.state.phase = GamePhaseState.MAP
      this.state.time = 999 * 1000
      this.state.roundTime = 999
    })
  }

  startGame() {
    if (this.state.gameLoaded) return // already started
    this.state.gameLoaded = true
    this.setSimulationInterval((deltaTime: number) => {
      deltaTime = Math.min(MAX_SIMULATION_DELTA_TIME, deltaTime)
      if (!this.state.gameFinished && !this.state.simulationPaused) {
        try {
          this.dispatcher.dispatch(new OnUpdateCommand(), { deltaTime })
        } catch (error) {
          logger.error("update error", error)
        }
      }
    })

    // Initialize the spire map and starter selection
    const { generateActMap } = require("../core/map-generator")
    const { PlayerChoice } = require("../models/colyseus-models/player-choice")
    const { Starters } = require("../types/enum/Starters")
    const { pickNRandomIn } = require("../utils/random")
    const { PRECOMPUTED_POKEMONS_PER_RARITY } = require("../models/precomputed/precomputed-rarity")

    this.state.phase = GamePhaseState.MAP
    this.state.time = 999 * 1000
    this.state.roundTime = 999
    generateActMap(this.state.currentAct, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as 0 | 1 | 2)
    logger.info(`Map generated: ${this.state.mapNodes.size} nodes, ${this.state.mapEdges.length} edges`)

    const isFisho2 = Array.from(this.state.players.values()).some(
      (p: Player) => !p.isBot && p.name === "Fisho2"
    )
    if (isFisho2 && this.state.currentAct <= 3) {
      const { MapNodeType } = require("../models/colyseus-models/map-node")
      const { getEliteEncounterCount, getEliteEncounterName } = require("../models/spire-encounters")
      const eliteTotal = getEliteEncounterCount(this.state.currentAct)
      let converted = 0
      let eliteIdx = 0
      this.state.mapNodes.forEach((node: any) => {
        if (converted >= 10) return
        if (node.nodeType === MapNodeType.WILD_BATTLE || node.nodeType === MapNodeType.GYM_LEADER || node.nodeType === MapNodeType.MYSTERY_ENCOUNTER || node.nodeType === MapNodeType.POKEMART) {
          node.nodeType = MapNodeType.ELITE
          node.eliteEncounterIndex = eliteIdx % eliteTotal
          node.displayName = getEliteEncounterName(eliteIdx % eliteTotal, this.state.currentAct)
          eliteIdx++
          converted++
        }
      })
      logger.info(`Fisho2 mode: converted ${converted} nodes to ELITE encounters`)
    }

    this.state.players.forEach((player: Player) => {
      if (!player.isBot) {
        const { incrementRunStarted } = require("../services/run-save")
        incrementRunStarted(player.id, this.state.difficultyMode)
        const { pickRandomIn: pickRandom } = require("../utils/random")
        const { ItemComponentsNoFossilOrScarf } = require("../types/enum/Item")
        const { getPokemonData } = require("../models/precomputed/precomputed-pokemon-data")
        const allOneStars = [
          ...PRECOMPUTED_POKEMONS_PER_RARITY.COMMON,
          ...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON,
          ...PRECOMPUTED_POKEMONS_PER_RARITY.RARE,
          ...PRECOMPUTED_POKEMONS_PER_RARITY.EPIC
        ].filter((p: Pkm) => getPokemonData(p).stars === 1)
        const starterOptions = pickNRandomIn(allOneStars, 3)
        const starterItems = starterOptions.map(() => pickRandom(ItemComponentsNoFossilOrScarf))
        player.choices.push(
          new PlayerChoice({
            type: "starter",
            pokemons: starterOptions,
            items: starterItems
          })
        )

        if (player.name === "Fisho" || player.name === "Fisho2") {
          player.addMoney(995, true, null)
          this.spawnOnBench(player, Pkm.MEWTWO)
          this.spawnOnBench(player, Pkm.MEWTWO)
          this.spawnOnBench(player, Pkm.MEW)
          this.spawnOnBench(player, Pkm.MEW)
          this.spawnOnBench(player, Pkm.GIBLE)
          this.spawnOnBench(player, Pkm.ONIX)
          this.spawnOnBench(player, Pkm.DRATINI)
          this.spawnOnBench(player, Pkm.CHARMANDER)
          player.board.forEach((pokemon) => {
            if (pokemon.name === Pkm.MEWTWO || pokemon.name === Pkm.MEW) {
              pokemon.addMaxHP(500)
              pokemon.addAttack(200)
              pokemon.addAbilityPower(200)
              pokemon.addDefense(100)
              pokemon.addSpecialDefense(100)
            }
          })
        }
      }
    })
  }

  async resumeGame() {
    if (this.state.gameLoaded) return
    this.state.gameLoaded = true

    const { loadRun, restoreRunToState } = require("../services/run-save")

    const player = schemaValues(this.state.players).find((p: Player) => !p.isBot)
    if (!player) {
      logger.error("resumeGame: no human player found, falling back to new game")
      this.startGame()
      return
    }

    const savedRun = await loadRun(player.id)
    if (!savedRun?.data) {
      logger.error("resumeGame: no saved run found for " + player.id + ", falling back to new game")
      this.startGame()
      return
    }

    this.setSimulationInterval((deltaTime: number) => {
      deltaTime = Math.min(MAX_SIMULATION_DELTA_TIME, deltaTime)
      if (!this.state.gameFinished && !this.state.simulationPaused) {
        try {
          this.dispatcher.dispatch(new OnUpdateCommand(), { deltaTime })
        } catch (error) {
          logger.error("update error", error)
        }
      }
    })

    restoreRunToState(this.state, player, savedRun.data)

    this.state.phase = GamePhaseState.MAP
    this.state.time = 999 * 1000
    this.state.roundTime = 999
    player.alive = true
    player.loadingProgress = 100

    logger.info(`Run resumed for ${player.name} (Act ${this.state.currentAct}, Floor ${this.state.currentFloor})`)
  }

  async onAuth(client: Client, options, context) {
    if (options.idToken) {
      const token = await admin.auth().verifyIdToken(options.idToken)
      const user = await admin.auth().getUser(token.uid)
      const UserMetadata = require("../models/mongo-models/user-metadata").default
      await UserMetadata.updateOne(
        { uid: user.uid },
        { $setOnInsert: { uid: user.uid, displayName: user.displayName || options.displayName || "Player" } },
        { upsert: true }
      )
      return {
        uid: user.uid,
        displayName: user.displayName || options.displayName || "Player"
      }
    }
    return {
      uid: options.odToken || "local-player",
      displayName: options.displayName || "Player"
    }
  }

  async onJoin(client: Client) {
    this.dispatcher.dispatch(new OnJoinCommand(), { client })
  }

  async onLeave(client: Client, code: number) {
    const player = this.state.players.get(client.auth?.uid)
    const name = player?.name || client.auth?.uid || "Unknown"
    let reason = "disconnected"
    if (this.state.runComplete) reason = "won"
    else if (this.state.runFailed) reason = "dead"
    else if (this.state.gameFinished) reason = "game finished"
    else reason = "abandoned"
    logger.info(`${name} left game | reason: ${reason} | act: ${this.state.currentAct} floor: ${this.state.currentFloor}`)
  }

  async onDispose() {
    const humanPlayer = Array.from(this.state.players.values()).find(p => !p.isBot)
    const name = humanPlayer?.name || "Unknown"
    logger.info(`Dispose Game ${this.roomId} | player: ${name}`)
    this.dispatcher.stop()
  }

  transformToSimplePlayer(player: Player): IGameHistorySimplePlayer {
    const simplePlayer: IGameHistorySimplePlayer = {
      name: player.name,
      id: player.id,
      rank: player.rank,
      avatar: player.avatar,
      pokemons: new Array<{
        name: Pkm
        avatar: string
        items: Item[]
        inventory: Item[]
      }>(),
      elo: player.elo,
      games: player.games,
      synergies: [],
      title: player.title,
      role: player.role
    }

    player.synergies.forEach((v, k) => {
      simplePlayer.synergies.push({ name: k as Synergy, value: v })
    })

    player.board.forEach((pokemon: IPokemon) => {
      if (pokemon.positionY != 0 && pokemon.passive !== Passive.INANIMATE) {
        const avatar = getAvatarString(
          pokemon.index,
          pokemon.shiny,
          pokemon.emotion
        )
        const s: IGameHistoryPokemonRecord = {
          name: pokemon.name,
          avatar: avatar,
          items: new Array<Item>(),
          inventory: new Array<Item>()
        }
        pokemon.items.forEach((i) => {
          s.items.push(i)
          s.inventory.push(i)
        })
        simplePlayer.pokemons.push(s)
      }
    })
    return simplePlayer
  }

  spawnOnBench(player: Player, pkm: Pkm, anim: "fishing" | "spawn" = "spawn") {
    const pokemon = PokemonFactory.createPokemonFromName(pkm, player)
    const x = getFirstAvailablePositionInBench(player.board)
    if (x !== null) {
      pokemon.positionX = x
      pokemon.positionY = 0
      if (anim === "fishing") {
        pokemon.action = PokemonActionState.FISH
      }

      player.board.set(pokemon.id, pokemon)
      this.clock.setTimeout(() => {
        pokemon.action = PokemonActionState.IDLE
        this.checkEvolutionsAfterPokemonAcquired(player.id)
      }, 1000)
    }
  }

  checkEvolutionsAfterPokemonAcquired(playerId: string): boolean {
    const player = this.state.players.get(playerId)
    if (!player) return false
    let hasEvolved = false

    player.board.forEach((pokemon) => {
      if (
        pokemon.hasEvolution &&
        pokemon.evolutionRule instanceof CountEvolutionRule
      ) {
        const pokemonEvolved = pokemon.evolutionRule.tryEvolve(
          pokemon,
          player,
          this.state.stageLevel
        )
        if (pokemonEvolved) {
          hasEvolved = true
        }
      }
    })

    player.boardSize = this.getTeamSize(player.board)
    return hasEvolved
  }

  checkEvolutionsAfterItemAcquired(
    playerId: string,
    pokemon: Pokemon
  ): Pokemon | void {
    const player = this.state.players.get(playerId)
    if (!player) return

    if (
      pokemon.evolutionRule &&
      pokemon.evolutionRule instanceof ItemEvolutionRule
    ) {
      const pokemonEvolved = pokemon.evolutionRule.tryEvolve(
        pokemon,
        player,
        this.state.stageLevel
      )
      return pokemonEvolved
    }
  }

  getNumberOfPlayersAlive(players: MapSchema<Player>) {
    let numberOfPlayersAlive = 0
    players.forEach((player, key) => {
      if (player.alive) {
        numberOfPlayersAlive++
      }
    })
    return numberOfPlayersAlive
  }

  getTeamSize(board: MapSchema<Pokemon>) {
    let size = 0

    board.forEach((pokemon, key) => {
      if (pokemon.positionY != 0 && pokemon.doesCountForTeamSize) {
        size++
      }
    })

    return size
  }

  pickChoice(
    playerId: string,
    choiceId: string,
    choiceIndex: number,
    bypassLackOfSpace = false
  ) {
    const player = this.state.players.get(playerId)
    if (!player) return
    const choice = player.choices.find((c) => c.id === choiceId)
    if (
      !choice ||
      choiceIndex < 0 ||
      choiceIndex >= (choice.pokemons?.length || choice.items?.length)
    )
      return

    if (choice.type === "wildReward" || choice.type === "gymReward" || choice.type === "eliteReward") {
      const pkm = choice.pokemons[choiceIndex]
      if (pkm && pkm !== Pkm.DEFAULT) {
        const freeSpace = getFreeSpaceOnBench(player.board)
        if (freeSpace < 1 && !bypassLackOfSpace) return false
        if (pkm === Pkm.SCATTERBUG || pkm === Pkm.GRUBBIN) {
          const egg = PokemonFactory.createPokemonFromName(Pkm.EGG, player) as Egg
          egg.action = PokemonActionState.SLEEP
          egg.evolution = pkm as Pkm
          egg.stacksRequired = egg.evolutionRule.getHatchTime(egg, player)
          const x = getFirstAvailablePositionInBench(player.board)
          if (x !== null) {
            egg.positionX = x
            egg.positionY = 0
            player.board.set(egg.id, egg)
          }
        } else {
          this.spawnOnBench(player, pkm as Pkm)
        }
      } else {
        const item = choice.items[choiceIndex]
        if (item) {
          player.items.push(item)
          const synType = SynergyGivenByGem[item as SynergyGem]
          if (synType) {
            player.bonusSynergies.set(synType, (player.bonusSynergies.get(synType) ?? 0) + 1)
            player.updateSynergies()
          }
        }
      }
      const idx = player.choices.indexOf(choice)
      if (idx >= 0) player.choices.splice(idx, 1)
      return
    }

    if (choice.pokemons.length > 0) {
      const pkm = choice.pokemons[choiceIndex]
      let pokemonsObtained: Pokemon[] = (
        pkm in PkmDuos ? PkmDuos[pkm] : [pkm]
      ).map((p) => PokemonFactory.createPokemonFromName(p, player))

      const pokemon = pokemonsObtained[0]
      const isEvolution =
        pokemon.evolutionRule &&
        pokemon.evolutionRule instanceof CountEvolutionRule &&
        pokemon.evolutionRule.canEvolveIfGettingOne(pokemon, player)

      const freeSpace = getFreeSpaceOnBench(player.board)

      if (
        freeSpace < pokemonsObtained.length &&
        !bypassLackOfSpace &&
        !isEvolution
      )
        return false // prevent picking if not enough space on bench

      if (choice.type === "addPick") {
        if (pokemonsObtained[0]?.regional) {
          // If player picked their regional variant, we need to add the base pokemon to the shop pool
          const basePkm = (Object.keys(PkmRegionalVariants).find((p) =>
            PkmRegionalVariants[p].includes(pokemonsObtained[0].name)
          ) ?? pokemonsObtained[0].name) as Pkm
          this.state.shop.addAdditionalPokemon(basePkm, this.state)
          player.regionalPokemons.push(pkm as Pkm)
        } else {
          this.state.shop.addAdditionalPokemon(pkm, this.state)
        }

        if (this.state.specialGameRule === SpecialGameRule.CHOSEN_ONES) {
          pokemonsObtained = pokemonsObtained.map((pkm) => {
            const evolution = pkm.hasEvolution
              ? pkm.evolutionRule.getEvolution(
                  pkm,
                  player,
                  this.state.stageLevel
                )
              : pkm.name
            const rank = [Rarity.UNCOMMON, Rarity.RARE, Rarity.EPIC].indexOf(
              pkm.rarity
            )
            const replacement = PokemonFactory.createPokemonFromName(
              evolution,
              player
            )
            replacement.addMaxHP([50, 100, 150][rank] ?? 50)
            replacement.addAttack([5, 10, 15][rank] ?? 5)
            replacement.addAbilityPower([15, 30, 45][rank] ?? 15)
            return replacement
          })
        }

        // update regional pokemons in case some regional variants of add picks are now available
        this.state.players.forEach((p) =>
          p.updateRegionalPool(this.state, false)
        )
      }

      if (choice.type === "starter") {
        player.firstPartner = pokemonsObtained[0].name
      }

      pokemonsObtained.forEach((pokemon) => {
        const freeCellX = getFirstAvailablePositionInBench(player.board)
        if (isEvolution) {
          pokemon.positionX = freeCellX ?? -1 // temporary position off the board just to handle evolution
          pokemon.positionY = 0
          player.board.set(pokemon.id, pokemon)
          pokemon.onAcquired(player)
          this.checkEvolutionsAfterPokemonAcquired(playerId)
        } else if (freeCellX !== null) {
          pokemon.positionX = freeCellX
          pokemon.positionY = 0
          player.board.set(pokemon.id, pokemon)
          pokemon.onAcquired(player)
        } else {
          // sell picked pokemon if no more space on bench and bypassLackOfSpace is true
          const sellPrice = getSellPrice(pokemon, this.state.specialGameRule)
          player.addMoney(sellPrice, true, null)
        }
      })
    }

    if (choice.items.length > 0) {
      const item = choice.items[choiceIndex]
      const pickedDitto = choice.pokemons.length > 0 && choice.pokemons[choiceIndex] === Pkm.DITTO
      if (!pickedDitto) {
        player.items.push(item)
        if (isIn(Wands, item)) {
          player.fairyWands.push(item)
        }
      }
    }

    removeInArray(player.choices, choice)

    if (this.state.phase === GamePhaseState.REWARD && player.choices.length === 0) {
      this.state.updatePhaseNeeded = true
      this.state.time = 0
    }
  }

  computeRoundDamage(
    opponentTeam: MapSchema<IPokemonEntity>,
    stageLevel: number
  ) {
    // Spire mode: damage is handled by stopSpireFightingPhase() using remainingEnemyStars * 2
    return 0
  }

  rankPlayers() {
    const rankArray = new Array<{ id: string; life: number; level: number }>()
    this.state.players.forEach((player) => {
      if (!player.alive) {
        return
      }

      rankArray.push({
        id: player.id,
        life: player.life,
        level: player.experienceManager.level
      })
    })

    const sortPlayers = (
      a: { id: string; life: number; level: number },
      b: { id: string; life: number; level: number }
    ) => {
      let diff = b.life - a.life
      if (diff == 0) {
        diff = b.level - a.level
      }
      return diff
    }

    rankArray.sort(sortPlayers)

    rankArray.forEach((rankPlayer, index) => {
      const player = this.state.players.get(rankPlayer.id)
      if (player) {
        player.rank = index + 1
      }
    })
  }

}
