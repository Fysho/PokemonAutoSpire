import { Dispatcher } from "@colyseus/command"
import { MapSchema } from "@colyseus/schema"
import admin from "firebase-admin"
import { Client, Room, matchMaker } from "colyseus"
import {
  MAX_LOADING_TIME,
  MAX_SIMULATION_DELTA_TIME,
  getItemSellValue
} from "../config"
import { EvolutionManager } from "../core/evolution-logic/evolution-manager"
import { getHatchTime } from "../core/evolution-logic/hatch-time"
import { MiniGame } from "../core/mini-game"
import { IGameUser } from "../models/colyseus-models/game-user"
import Player from "../models/colyseus-models/player"
import { Egg, Pokemon } from "../models/colyseus-models/pokemon"
import PokemonFactory from "../models/pokemon-factory"
import {
  getAdditionalsTier1,
  getPokemonData,
  PRECOMPUTED_REGIONAL_MONS
} from "../models/precomputed/precomputed-pokemon-data"
import { PRECOMPUTED_POKEMONS_PER_RARITY } from "../models/precomputed/precomputed-rarity"
import { getSellPrice } from "../models/shop"
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
import { EvolutionRuleType } from "../types/EvolutionRules"
import { EloRank } from "../types/enum/EloRank"
import { BattleResult, GameMode, GamePhaseState, PokemonActionState, Rarity } from "../types/enum/Game"
import { Item, isItemSellable, SynergyGem, SynergyGivenByGem, Wands } from "../types/enum/Item"
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

// WebSocket close code (application range 4000-4999) sent when a player is
// dropped for inactivity. The client's room.onLeave shows the "Disconnected"
// overlay regardless of code; this is mainly for logging/clarity.
const IDLE_DISCONNECT_CODE = 4002

export default class GameRoom extends Room<{ state: GameState }> {
  dispatcher: Dispatcher<this>
  additionalUncommonPool: Array<Pkm>
  additionalRarePool: Array<Pkm>
  additionalEpicPool: Array<Pkm>
  miniGame: MiniGame
  isResume: boolean = false
  runHistoryRecorded: boolean = false
  // Win + victory-leaderboard + streak are counted exactly once, the moment the
  // act-3 boss falls (see recordActThreeVictoryOnce). Elite Four / Arceus are bonus
  // content and never re-count it. This guard makes that idempotent within a room;
  // resume can't double-count because the boss-reward phase is never replayed.
  actThreeVictoryCounted: boolean = false
  // Set when the champion fight is won, so the terminal run-end (Arceus end or
  // onDispose) credits the per-account champion stat exactly once.
  becameChampion: boolean = false
  // Set once the human player leaves/disconnects. There is no reconnection to the
  // same room (a reconnect spawns a NEW room that resumes), so a left room must
  // never auto-save again — otherwise this lingering "zombie" room keeps writing
  // and can clobber the resumed room's newer progress (the SAVE WENT BACKWARD bug).
  playerLeft: boolean = false
  // The signed-in uid that owns this run ("local-player" for guests). Used to
  // enforce one active room per account: when a new room starts for this uid it
  // publishes "supersede-session" and any older room for the same uid disposes.
  ownerUid: string = ""
  // Set when this room was kicked by a newer session for the same account. Blocks
  // all further saves so the dying room can't clobber the new session's progress.
  superseded: boolean = false
  eliteFightPokemon: Pkm[] = []
  eliteMainPokemon: Pkm = Pkm.DEFAULT
  eliteMainBonusHP: number = 0
  eliteMainBonusAtk: number = 0
  eliteMainBonusAP: number = 0
  asyncFightSnapshots: Map<string, { snapshot: any; name: string; avatar: string; region: string }> = new Map()
  // Elite Designer "test fight" sandbox. When true the room runs no real spire run
  // (no map/starter/run-HP); it parks in an idle PICK phase and only runs one-off
  // AI-vs-AI simulations on TEST_ELITE_DESIGN. eliteTestFightStart stamps the start
  // of the current test fight so the result can report a duration.
  isEliteTest: boolean = false
  eliteTestFightStart: number = 0
  // Anti-AFK idle tracking (see OnUpdateCommand). idlePhase is the phase the
  // idle timer is currently counting against; idleTimeMs is real ms elapsed in
  // it without advancing the run.
  idleTimeMs: number = 0
  idlePhase: GamePhaseState | null = null
  // Guard so the idle-disconnect path fires at most once per idle window. Without
  // it, OnUpdateCommand re-triggers disconnectIdlePlayers() every tick once the
  // threshold is crossed (the timer isn't reset and a stale client doesn't leave
  // instantly), spamming client.leave() + a synchronous saveRun() per tick and
  // starving the server. Reset on phase advance so a still-connected player who
  // goes idle again can still be dropped.
  idleDisconnected: boolean = false
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
    resume,
    isEndless,
    eliteTest
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
    isEndless?: boolean
    eliteTest?: boolean
  }) {
    this.isEliteTest = !!eliteTest
    const diffLabel = isEndless ? "Endless" : difficultyMode === 0 ? "Easy" : difficultyMode === 2 ? "Hard" : difficultyMode === 3 ? "Impossible" : "Normal"
    const playerName = ownerName || Object.values(users || {})[0]?.name || "Unknown"
    logger.info(`Create Game ${this.roomId} | player: ${playerName} | difficulty: ${diffLabel}`)

    this.ownerUid = Object.keys(users || {})[0] || ""

    this.setMetadata(<IGameMetadata>{
      name,
      ownerName,
      ownerUid: this.ownerUid,
      gameMode,
      playerIds: Object.keys(users).filter((id) => users[id].isBot === false),
      playersInfo: Object.keys(users).map(
        (u) => `${users[u].name} [${users[u].elo}]`
      ),
      stageLevel: 0,
      type: "game",
      tournamentId,
      bracketId,
      difficultyMode: difficultyMode ?? 1,
      isEndless: !!isEndless,
      currentAct: 1,
      currentFloor: 0,
      runHP: 100,
      spectatorCount: 0
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
    if (isEndless) {
      const { isEndlessEnabled } = require("../services/endless-config")
      if (!resume && !isEndlessEnabled()) {
        // Endless is disabled for new runs; allow admins through for testing
        // (resuming an already-started endless run is always permitted).
        const creatorUid = Object.keys(users || {})[0]
        let isCreatorAdmin = false
        if (creatorUid && creatorUid !== "local-player") {
          try {
            const UserMetadata = require("../models/mongo-models/user-metadata").default
            const meta = await UserMetadata.findOne({ uid: creatorUid }, { role: 1 }).lean()
            isCreatorAdmin = meta?.role === Role.ADMIN
          } catch (e) {
            isCreatorAdmin = false
          }
        }
        if (!isCreatorAdmin) {
          throw new Error("Endless mode is currently disabled")
        }
      }
      this.state.isEndless = true
      this.state.difficultyMode = 1
    } else if (difficultyMode === 0 || difficultyMode === 2 || difficultyMode === 3) {
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
          const UserMetadata = require("../models/mongo-models/user-metadata").default
          const meta = await UserMetadata.findOne({ uid: user.uid }, { role: 1 }).lean()
          const resolvedRole = meta?.role || Role.BASIC
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
            resolvedRole,
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
      if (this.isEliteTest) {
        this.startEliteTestMode()
      } else if (this.isResume) {
        this.resumeGame()
      } else {
        this.startGame()
      }
    }, MAX_LOADING_TIME)

    this.onMessage(Transfer.SHOP, (client, message) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
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
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
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
        if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
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
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
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

    this.onMessage(Transfer.REROLL_ELITE_REWARD, (client) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        const player = this.state.players.get(client.auth.uid)
        if (!player || player.money < 1) return
        const choiceIdx = player.choices.findIndex((c) => c.type === "eliteReward")
        if (choiceIdx < 0) return
        // Elite loss rewards carry no items (2 Pokemon, no components); win
        // rewards carry a component per Pokemon. Regenerate the matching kind so
        // a reroll can't upgrade a loss reward into a win reward.
        const wasLossReward = player.choices[choiceIdx].items.length === 0
        player.choices.splice(choiceIdx, 1)
        player.money -= 1
        const cmd = new OnUpdatePhaseCommand()
        cmd.setPayload({})
        cmd.room = this
        cmd.state = this.state
        cmd.clock = this.clock
        if (wasLossReward) {
          cmd.generateEliteLossChoice(player)
        } else {
          cmd.generateEliteRewardChoice(player)
        }
      }
    })

    this.onMessage(Transfer.REROLL_BOSS_REWARD, (client) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        const player = this.state.players.get(client.auth.uid)
        const node = this.state.mapNodes.get(this.state.currentNodeId)
        const isAsyncMiniBoss = node?.nodeType === "ASYNC_FIGHT" && node.floor !== 20
        const isEndlessActBoss = node?.nodeType === "ASYNC_FIGHT" && node.floor === 20
        const cost = isAsyncMiniBoss ? 1 : 20
        if (!player || player.money < cost) return
        const choiceIdx = player.choices.findIndex((c) => c.type === "item")
        if (choiceIdx < 0) return
        const currentItems = [...player.choices[choiceIdx].items]
        player.choices.splice(choiceIdx, 1)
        player.money -= cost
        const { pickNRandomIn } = require("../utils/random")
        const { ShinyItems, Tools, ItemComponentsNoFossilOrScarf } = require("../types/enum/Item")
        const { PlayerChoice } = require("../models/colyseus-models/player-choice")
        if (isAsyncMiniBoss) {
          const pool = ItemComponentsNoFossilOrScarf.filter((i: Item) => !currentItems.includes(i))
          const newItems = pickNRandomIn(pool.length >= 3 ? pool : ItemComponentsNoFossilOrScarf, 3)
          player.choices.push(new PlayerChoice({ type: "item", items: newItems }))
        } else if (isEndlessActBoss) {
          // Endless floor-20 boss reward is offered from the combined
          // ShinyItems + Tools pool, so the reroll must draw from that same
          // combined pool (the legendary-boss branch below narrows to one pool
          // by item type, which is wrong for a mixed offer). Just exclude the
          // items from the previous offering.
          const count = currentItems.length || 1
          const fullPool = [...ShinyItems, ...Tools]
          const filteredPool = fullPool.filter((i: Item) => !currentItems.includes(i))
          const pool = filteredPool.length >= count ? filteredPool : fullPool
          const newItems = pickNRandomIn(pool, count)
          player.choices.push(new PlayerChoice({ type: "item", items: newItems }))
        } else {
          // Preserve the number of choices originally offered (boss win = 3,
          // boss loss = 1). Re-picking a fixed 3 here turned a single loss
          // reward into three on reroll.
          const count = currentItems.length || 1
          const originalWasTools = currentItems.some((i: Item) => Tools.includes(i))
          const fullPool = originalWasTools ? [...Tools] : [...ShinyItems]
          const filteredPool = fullPool.filter((i: Item) => !currentItems.includes(i))
          const pool = filteredPool.length >= count ? filteredPool : fullPool
          const newItems = pickNRandomIn(pool, count)
          player.choices.push(new PlayerChoice({ type: "item", items: newItems }))
        }
      }
    })

    this.onMessage(Transfer.REROLL_STARTER, (client) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        const player = this.state.players.get(client.auth.uid)
        if (!player) return
        const choiceIdx = player.choices.findIndex((c) => c.type === "starter")
        if (choiceIdx < 0) return
        player.choices.splice(choiceIdx, 1)
        const { pickRandomIn: pickRandom, pickNRandomIn: pickNRandom } = require("../utils/random")
        const { ItemComponentsNoFossilOrScarf } = require("../types/enum/Item")
        const { getPokemonData } = require("../models/precomputed/precomputed-pokemon-data")
        const { PlayerChoice } = require("../models/colyseus-models/player-choice")
        const isImpossibleReroll = this.state.difficultyMode === 3
        const allOneStars = (isImpossibleReroll
          ? [...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON]
          : [
            ...PRECOMPUTED_POKEMONS_PER_RARITY.COMMON,
            ...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON,
            ...PRECOMPUTED_POKEMONS_PER_RARITY.RARE,
            ...PRECOMPUTED_POKEMONS_PER_RARITY.EPIC
          ]
        ).filter((p: Pkm) => getPokemonData(p).stars === 1)
        const starterOptions = pickNRandom(allOneStars, 5)
        const starterItems = isImpossibleReroll
          ? []
          : starterOptions.map(() => pickRandom(ItemComponentsNoFossilOrScarf))
        player.choices.push(
          new PlayerChoice({
            type: "starter",
            pokemons: starterOptions,
            items: starterItems
          })
        )
      }
    })

    this.onMessage(Transfer.REROLL_MAP, (client) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        const player = this.state.players.get(client.auth.uid)
        if (!player) return
        if (!player.choices.some((c) => c.type === "starter")) return
        const { generateActMap } = require("../core/map-generator")
        this.state.mapNodes.clear()
        this.state.mapEdges.splice(0, this.state.mapEdges.length)
        generateActMap(this.state.currentAct, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as 0 | 1 | 2 | 3, this.state.isEndless)
        if (this.state.isEndless) this.populateAsyncFightNodes()
      }
    })

    this.onMessage(Transfer.PASS_REWARD, (client) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        const player = this.state.players.get(client.auth.uid)
        if (!player) return
        const choiceIdx = player.choices.findIndex((c) => c.type === "gymReward" || c.type === "eliteReward" || c.type === "unlockReward")
        if (choiceIdx < 0) return
        player.choices.splice(choiceIdx, 1)
        player.money += 5
      }
    })

    this.onMessage(Transfer.DRAG_DROP, (client, message: IDragDropMessage) => {
      if (!this.state.gameFinished && this.isPlayer(client)) {
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
        if (!this.state.gameFinished && this.isPlayer(client)) {
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
        if (!this.state.gameFinished && this.isPlayer(client)) {
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
          if (client.auth && this.isPlayer(client)) {
            this.miniGame.applyVector(client.auth.uid, message.x, message.y)
          }
        } catch (error) {
          logger.error(error)
        }
      }
    )

    this.onMessage(Transfer.SELL_POKEMON, (client, pokemonId: string) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
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

    this.onMessage(Transfer.SELL_ITEM, (client, itemId: string) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        const player = this.state.players.get(client.auth.uid)
        if (!player || !player.alive) return
        if (!isItemSellable(itemId as Item)) return
        const idx = player.items.findIndex((i: any) => i === itemId)
        if (idx < 0) return
        player.items.splice(idx, 1)
        player.addMoney(getItemSellValue(itemId as Item), false, null)
      }
    })

    this.onMessage(Transfer.REFRESH, (client, message) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        try {
          this.dispatcher.dispatch(new OnShopRerollCommand(), client.auth.uid)
        } catch (error) {
          logger.error("refresh error", message)
        }
      }
    })

    this.onMessage(Transfer.LOCK, (client, message) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
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
        if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
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
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
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
        if (client.auth && this.isPlayer(client)) {
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
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
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
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        // Node selection is only legal from the MAP phase. Without this guard a
        // player could open the map mid-fight (PICK/FIGHT) or during a
        // SHOP/REST/EVENT/REWARD step and click an available node, which
        // onSelectMapNode would happily process — abandoning the current
        // encounter and skipping the fight. Admin teleport and resume call
        // onSelectMapNode directly and intentionally bypass this.
        if (this.state.phase !== GamePhaseState.MAP) return
        const player = this.state.players.get(client.auth.uid)
        if (player?.choices?.some((c: any) => c.type === "starter")) return
        try {
          const cmd = new OnUpdatePhaseCommand()
          cmd.setPayload({})
          cmd.room = this
          cmd.state = this.state
          cmd.clock = this.clock
          cmd.onSelectMapNode(nodeId)
          this.updateSpectateMetadata()
        } catch (error) {
          logger.error("select map node error", error)
        }
      }
    })

    this.onMessage(
      Transfer.TEST_ELITE_DESIGN,
      async (client, payload: { design?: string; stage?: string }) => {
        // Elite Designer sandbox only. Build an AI-vs-AI fight: the design (blue)
        // vs a random saved endless team for the chosen stage (red). Refuses when
        // the design is empty or the stage has no saved teams.
        if (!this.isEliteTest || !client.auth || !this.isPlayer(client)) return
        if (this.state.phase === GamePhaseState.FIGHT) return // a test is already running
        try {
          const { parseEliteDesignExport } = require("../services/elite-test")
          const design = parseEliteDesignExport(payload?.design ?? "")
          if (!design || design.board.length === 0) {
            this.broadcast(Transfer.ELITE_TEST_RESULT, { error: "empty_design" })
            return
          }
          const { getRandomAsyncOpponentNoFallback } = require("../services/async-fight-pool")
          const opponent = await getRandomAsyncOpponentNoFallback(payload?.stage ?? "")
          // Re-read phase after the await (a fight may have started meanwhile). Cast
          // to number to dodge TS narrowing the early-return above into this check.
          if ((this.state.phase as number) === GamePhaseState.FIGHT) return
          if (!opponent) {
            this.broadcast(Transfer.ELITE_TEST_RESULT, {
              error: "no_data",
              stage: payload?.stage ?? ""
            })
            return
          }
          const player = schemaValues(this.state.players).find(
            (p: Player) => !p.isBot
          )
          if (!player) return
          const cmd = new OnUpdatePhaseCommand()
          cmd.setPayload({})
          cmd.room = this
          cmd.state = this.state
          cmd.clock = this.clock
          cmd.setupEliteTestPreview(player, design, opponent)
        } catch (error) {
          logger.error("elite test preview error", error)
        }
      }
    )

    this.onMessage(Transfer.BEGIN_ELITE_TEST, (client) => {
      // Start the staged elite test fight (both teams already previewed on board).
      if (!this.isEliteTest || !client.auth || !this.isPlayer(client)) return
      if (!this.state.eliteTestAwaitingBegin) return
      try {
        const cmd = new OnUpdatePhaseCommand()
        cmd.setPayload({})
        cmd.room = this
        cmd.state = this.state
        cmd.clock = this.clock
        cmd.beginEliteTestFight()
      } catch (error) {
        logger.error("begin elite test error", error)
      }
    })

    this.onMessage(Transfer.SKIP_REWARD, (client) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client) &&
        this.state.phase !== GamePhaseState.FIGHT &&
        this.state.phase !== GamePhaseState.MAP) {
        this.state.updatePhaseNeeded = true
        this.state.time = 0
      }
    })

    this.onMessage(Transfer.GAME_SPEED, (client, { speed }: { speed: number }) => {
      if (client.auth && this.isPlayer(client) && (speed === 0.5 || speed === 1 || speed === 2 || speed === 3)) {
        this.state.gameSpeed = speed
      }
    })

    this.onMessage(Transfer.ENTER_ELITE_FOUR, (client) => {
      if (client.auth && this.isPlayer(client) && !this.state.gameFinished) {
        const { generateActMap } = require("../core/map-generator")
        this.state.runComplete = false
        this.state.runFailed = false
        this.state.eliteFourAvailable = false
        this.state.gameFinished = false
        this.state.championChallenged = false
        this.state.arceusChallenged = false
        this.state.currentAct = 4
        this.state.currentFloor = 0
        this.state.mapNodes.clear()
        this.state.mapEdges.clear()
        generateActMap(4, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as 0 | 1 | 2 | 3)
        this.state.players.forEach((p: Player) => {
          p.dojoFamilies.clear()
          if (!p.isBot) { p.alive = true }
        })
        // Route through initializeMapPhase so stale encounter state (opponent
        // inventory/board/synergies/snapshot from the prior champion fight) is
        // cleared — otherwise it lingers on screen during the next act.
        const cmd = new OnUpdatePhaseCommand()
        cmd.setPayload({})
        cmd.room = this
        cmd.state = this.state
        cmd.clock = this.clock
        cmd.initializeMapPhase()
      }
    })

    this.onMessage(Transfer.ENTER_ACT_5, (client) => {
      if (!client.auth || !this.isPlayer(client)) return
      const player = this.state.players.get(client.auth.uid)
      const isAdmin = player?.role === Role.ADMIN
      if (this.state.currentAct === 4 || isAdmin) {
        const { generateActMap } = require("../core/map-generator")
        this.state.runComplete = false
        this.state.runFailed = false
        this.state.eliteFourAvailable = false
        this.state.gameFinished = false
        this.state.championChallenged = false
        this.state.arceusChallenged = false
        this.state.arceusDamageDealt = 0
        this.state.currentAct = 5
        this.state.currentFloor = 0
        this.state.mapNodes.clear()
        this.state.mapEdges.clear()
        generateActMap(5, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as 0 | 1 | 2 | 3)
        this.state.players.forEach((p: Player) => {
          p.dojoFamilies.clear()
          if (!p.isBot) { p.alive = true }
        })
        // Route through initializeMapPhase so stale encounter state (the defeated
        // champion's / E4 member's inventory, board, synergies, snapshot) is
        // cleared before the Arceus act — otherwise it stays on screen.
        const cmd = new OnUpdatePhaseCommand()
        cmd.setPayload({})
        cmd.room = this
        cmd.state = this.state
        cmd.clock = this.clock
        cmd.initializeMapPhase()
      }
    })

    this.onMessage(Transfer.RESET_CHAMPION, (client) => {
      if (!client.auth) return
      const { resetChampionData } = require("../services/champion-data")
      resetChampionData()
    })

    this.onMessage(Transfer.SKIP_TO_ACT, (client, { act }: { act: number }) => {
      if (!client.auth || this.state.gameFinished) return
      const player = this.state.players.get(client.auth.uid)
      if (!player || player.role !== Role.ADMIN) return
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
      generateActMap(act, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as 0 | 1 | 2 | 3)
      this.state.players.forEach((p: Player) => {
        p.dojoFamilies.clear()
        if (!p.isBot) { p.alive = true }
      })
      this.state.phase = GamePhaseState.MAP
      this.state.time = 999 * 1000
      this.state.roundTime = 999
    })

    this.onMessage(Transfer.GIVE_GOLD, (client) => {
      if (!client.auth) return
      const player = this.state.players.get(client.auth.uid)
      if (!player || player.role !== Role.ADMIN) return
      player.money = 999
    })

    this.onMessage(Transfer.GIVE_MEWTWO, (client) => {
      if (!client.auth) return
      const player = this.state.players.get(client.auth.uid)
      if (!player || player.role !== Role.ADMIN) return
      this.spawnOnBench(player, Pkm.MEWTWO)
      player.board.forEach((pokemon) => {
        if (pokemon.name === Pkm.MEWTWO) {
          pokemon.addMaxHP(500)
          pokemon.addAttack(200)
          pokemon.addAbilityPower(200)
          pokemon.addDefense(100)
          pokemon.addSpecialDefense(100)
        }
      })
    })

    this.onMessage(Transfer.ADMIN_HEAL, (client) => {
      if (!client.auth) return
      const player = this.state.players.get(client.auth.uid)
      if (!player || player.role !== Role.ADMIN) return
      this.state.runHP = 100
      player.life = 100
    })

    this.onMessage(Transfer.GIVE_DITTO, (client) => {
      if (!client.auth) return
      const player = this.state.players.get(client.auth.uid)
      if (!player || player.role !== Role.ADMIN) return
      this.spawnOnBench(player, Pkm.DITTO)
    })

    this.onMessage(Transfer.GIVE_POKEMON, (client, { pkm }: { pkm: Pkm }) => {
      if (!client.auth) return
      const player = this.state.players.get(client.auth.uid)
      if (!player || player.role !== Role.ADMIN) return
      if (!Object.values(Pkm).includes(pkm)) return
      this.spawnOnBench(player, pkm)
    })

    this.onMessage(Transfer.GIVE_ITEM, (client, { item }: { item: Item }) => {
      if (!client.auth) return
      const player = this.state.players.get(client.auth.uid)
      if (!player || player.role !== Role.ADMIN) return
      if (!Object.values(Item).includes(item)) return
      player.items.push(item)
    })

    this.onMessage(Transfer.ADMIN_TELEPORT_NODE, (client, nodeId: string) => {
      if (!client.auth || !this.isPlayer(client)) return
      const player = this.state.players.get(client.auth.uid)
      if (!player || player.role !== Role.ADMIN) return
      const node = this.state.mapNodes.get(nodeId)
      if (!node || node.visited) return
      try {
        node.available = true
        const cmd = new OnUpdatePhaseCommand()
        cmd.setPayload({})
        cmd.room = this
        cmd.state = this.state
        cmd.clock = this.clock
        cmd.onSelectMapNode(nodeId)
        this.updateSpectateMetadata()
      } catch (error) {
        logger.error("admin teleport node error", error)
      }
    })

    this.onServerAnnouncement = this.onServerAnnouncement.bind(this)
    this.presence.subscribe("server-announcement", this.onServerAnnouncement)

    // One active room per account: subscribe so an older room for this uid can be
    // told to dispose, then announce ourselves so any existing room steps aside.
    // (Guests share "local-player", so they are never superseded.)
    this.onSupersedeSession = this.onSupersedeSession.bind(this)
    this.presence.subscribe("supersede-session", this.onSupersedeSession)
    if (this.ownerUid && this.ownerUid !== "local-player") {
      // Log if this account already had a live run when they entered this one
      // (this entry will kick it), then announce ourselves to kick it.
      try {
        const rooms = await matchMaker.query({})
        const existing = rooms.filter((r) => {
          if (r.roomId === this.roomId || r.name !== "game") return false
          const meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata
          return meta?.ownerUid === this.ownerUid
        })
        if (existing.length > 0) {
          logger.warn(
            `⚠️ ${playerName} [${this.ownerUid}] entered a new run while ${existing.length} active run(s) already existed (${existing.map((r) => r.roomId).join(", ")}) — kicking the old session.`
          )
        }
      } catch (e) {
        /* query failure is non-fatal — the supersede publish below still fires */
      }
      this.presence.publish("supersede-session", { uid: this.ownerUid, newRoomId: this.roomId })
    }
  }

  onSupersedeSession(msg: { uid: string; newRoomId: string }) {
    if (msg && msg.uid === this.ownerUid && msg.newRoomId !== this.roomId && !this.superseded) {
      this.supersedeSession()
    }
  }

  // Kicked by a newer session for the same account. Block all further saves and
  // dispose, so this room can never overwrite the new session's progress.
  supersedeSession() {
    this.superseded = true
    this.playerLeft = true
    logger.info(`Superseding game ${this.roomId} for ${this.ownerUid} — a newer session started`)
    this.disconnect().catch(() => {})
  }

  onServerAnnouncement(message: string) {
    this.broadcast(Transfer.SERVER_ANNOUNCEMENT, message)
  }

  async populateAsyncFightNodes() {
    const { MapNodeType } = require("../models/colyseus-models/map-node")
    const { getAsyncFightOpponents } = require("../services/async-fight-pool")
    const { PkmIndex } = require("../types/enum/Pokemon")
    const nodesByFloor = new Map<number, string[]>()
    this.state.mapNodes.forEach((node: any, id: string) => {
      if (node.nodeType === MapNodeType.ASYNC_FIGHT) {
        const list = nodesByFloor.get(node.floor) ?? []
        list.push(id)
        nodesByFloor.set(node.floor, list)
      }
    })
    for (const [floor, nodeIds] of nodesByFloor) {
      const stage = `act${this.state.currentAct}-floor${floor}`
      const opponents = await getAsyncFightOpponents(stage, nodeIds.length)
      nodeIds.forEach((id, i) => {
        const node = this.state.mapNodes.get(id)
        const opp = opponents[i % opponents.length]
        if (node && opp) {
          node.displayName = opp.playerName
          node.eliteAvatar = opp.avatar.split("/")[0]
          this.asyncFightSnapshots.set(id, {
            snapshot: opp.snapshot,
            name: opp.playerName,
            avatar: opp.avatar,
            region: opp.region
          })
        }
      })
    }
  }

  startGame() {
    if (this.state.gameLoaded) return // already started
    this.state.gameLoaded = true
    // Fresh identity for this run so the save fence treats it as distinct from any
    // prior run in this account's save slot (lets a new run overwrite an old save).
    this.state.runId = crypto.randomUUID()
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

    const { randomBetween: randBetween } = require("../utils/random")
    const { BOARD_WIDTH, BOARD_HEIGHT } = require("../config")
    this.state.lightX = randBetween(0, BOARD_WIDTH - 1)
    this.state.lightY = randBetween(1, BOARD_HEIGHT / 2)

    this.state.phase = GamePhaseState.MAP
    this.state.time = 999 * 1000
    this.state.roundTime = 999
    generateActMap(this.state.currentAct, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as 0 | 1 | 2 | 3, this.state.isEndless)
    logger.info(`Map generated: ${this.state.mapNodes.size} nodes, ${this.state.mapEdges.length} edges`)
    if (this.state.isEndless) this.populateAsyncFightNodes()

    this.state.players.forEach((player: Player) => {
      player.lightX = this.state.lightX
      player.lightY = this.state.lightY
      if (this.state.isEndless) {
        const { ENDLESS_MAX_LEVEL } = require("../config")
        player.experienceManager.maxLevel = ENDLESS_MAX_LEVEL
      }
      if (!player.isBot) {
        const { incrementRunStarted } = require("../services/run-save")
        incrementRunStarted(player.id, this.state.difficultyMode)
        const UserMetadata = require("../models/mongo-models/user-metadata").default
        UserMetadata.findOne({ uid: player.id }, { spireRegion: 1 }).lean().then((u: any) => {
          const region = u?.spireRegion || "town"
          this.state.playerSpireRegion = region
          if (region !== "town") player.map = region
        }).catch(() => {})
        const { pickRandomIn: pickRandom } = require("../utils/random")
        const { ItemComponentsNoFossilOrScarf } = require("../types/enum/Item")
        const { getPokemonData } = require("../models/precomputed/precomputed-pokemon-data")
        const isImpossible = this.state.difficultyMode === 3
        const allOneStars = (isImpossible
          ? [...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON]
          : [
            ...PRECOMPUTED_POKEMONS_PER_RARITY.COMMON,
            ...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON,
            ...PRECOMPUTED_POKEMONS_PER_RARITY.RARE,
            ...PRECOMPUTED_POKEMONS_PER_RARITY.EPIC
          ]
        ).filter((p: Pkm) => getPokemonData(p).stars === 1)
        const starterOptions = pickNRandomIn(allOneStars, 5)
        const starterItems = isImpossible
          ? []
          : starterOptions.map(() => pickRandom(ItemComponentsNoFossilOrScarf))
        player.choices.push(
          new PlayerChoice({
            type: "starter",
            pokemons: starterOptions,
            items: starterItems
          })
        )

      }
    })
  }

  // Elite Designer "test fight" sandbox. No spire run is set up (no map, starter,
  // or run HP) — the room just runs the simulation tick loop and parks in an idle
  // PICK phase. TEST_ELITE_DESIGN spawns one AI-vs-AI fight; when it ends the room
  // returns here (idle) for the next test, so the player can tweak and re-test
  // without ever reloading.
  startEliteTestMode() {
    if (this.state.gameLoaded) return
    this.state.gameLoaded = true
    this.state.runId = crypto.randomUUID()
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
    // Idle: a "fake infinite" PICK phase (manual phases don't auto-advance).
    this.state.phase = GamePhaseState.PICK
    this.state.time = 999 * 1000
    this.state.roundTime = 999
  }

  async resumeGame() {
    if (this.state.gameLoaded) return
    this.state.gameLoaded = true

    const { loadRun, restoreRunToState, flushSaves } = require("../services/run-save")

    const player = schemaValues(this.state.players).find((p: Player) => !p.isBot)
    if (!player) {
      logger.error("resumeGame: no human player found, falling back to new game")
      this.startGame()
      return
    }

    // Drain any in-flight saves for this player first so we read the freshest run,
    // not a doc one save behind (the "resume rewound a floor" race).
    await flushSaves(player.id)
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

    // Repopulate endless async-fight opponents BEFORE any node re-select below:
    // the pending-fight resume path regenerates the encounter via onSelectMapNode,
    // which reads asyncFightSnapshots for ASYNC_FIGHT nodes. Awaited so the DB
    // lookups land first.
    if (this.state.isEndless) await this.populateAsyncFightNodes()

    const cmd = new OnUpdatePhaseCommand()
    cmd.setPayload({})
    cmd.room = this
    cmd.state = this.state
    cmd.clock = this.clock

    // One-shot finale guard: a run that already STARTED a Champion or Arceus fight
    // cannot resume back into it. Re-fighting would let players save-scum the Arceus
    // damage leaderboard (quit a bad roll, retry) or retry the champion fight. Such a
    // run is finalized here as a forfeit — it still keeps its Act-3 victory (recorded
    // by runId, so no duplicate), just no second attempt at the finale fight.
    if (this.state.arceusChallenged || this.state.championChallenged) {
      logger.info(`Resume forfeit for ${player.name}: finale fight already started (champion=${this.state.championChallenged}, arceus=${this.state.arceusChallenged}) — finalizing run, no re-fight.`)
      this.state.gameFinished = true
      this.state.runFailed = true
      player.alive = false
      player.loadingProgress = 100
      cmd.recordRunEndOnce(player, { arceusDamage: this.state.arceusDamageDealt })
      return
    }

    // A combat node was selected but its fight never resolved (mid-PICK/FIGHT
    // disconnect): pendingFightNodeId points at it. The encounter board isn't
    // persisted, so re-enter that node's PICK phase by regenerating the encounter.
    // The node was consumed (available=false) on selection, so flip it back on
    // for the re-select (onSelectMapNode early-returns on !available). Without
    // this the player drops to MAP with the node already visited — a hard-lock on
    // the floor-20 boss (no successor node) and a silent fight-skip mid-act.
    const savedPhase = savedRun.data.phase
    let pendingNodeId = savedRun.data.pendingFightNodeId
    let pendingNode = pendingNodeId ? this.state.mapNodes.get(pendingNodeId) : undefined

    // Legacy fallback: saves written before pendingFightNodeId existed can be
    // stranded on the floor-20 boss with no marker. That state is uniquely
    // identifiable — the boss is the only node with no successor, so when nothing
    // on the map is available and the current node is a visited combat node, the
    // player is hard-locked. Recover by re-entering that fight. (Endless strands
    // are handled separately by recoverIfEndlessStranded, which advances the act.)
    if (
      !pendingNode &&
      !this.state.isEndless &&
      this.state.phase !== GamePhaseState.REWARD &&
      savedPhase !== GamePhaseState.SHOP &&
      savedPhase !== GamePhaseState.REST &&
      savedPhase !== GamePhaseState.EVENT
    ) {
      const { MapNodeType } = require("../models/colyseus-models/map-node")
      const COMBAT_NODE_TYPES = [
        MapNodeType.WILD_BATTLE, MapNodeType.GYM_LEADER, MapNodeType.ELITE,
        MapNodeType.UNLOCK, MapNodeType.LEGENDARY_BOSS, MapNodeType.ELITE_FOUR,
        MapNodeType.CHAMPION, MapNodeType.ARCEUS_BOSS, MapNodeType.ASYNC_FIGHT
      ]
      let anyAvailable = false
      this.state.mapNodes.forEach((n: any) => { if (n.available) anyAvailable = true })
      const current = this.state.currentNodeId
        ? this.state.mapNodes.get(this.state.currentNodeId)
        : undefined
      if (
        !anyAvailable &&
        current &&
        current.visited &&
        COMBAT_NODE_TYPES.includes(current.nodeType)
      ) {
        pendingNodeId = this.state.currentNodeId
        pendingNode = current
        logger.info(`Recovered stranded run for ${player.name} — re-entering fight on a ${current.nodeType} node (Act ${this.state.currentAct}, Floor ${current.floor})`)
      }
    }

    // SHOP/REST/EVENT phases consume their map node on entry but rely on either
    // transient state (the shop miniGame carousel) or unsaved choice state
    // (rest/event choices) that isn't persisted. Resuming straight to MAP would
    // leave the player on an already-visited node with no way back in, so
    // re-initialize the phase instead of falling back to MAP.
    if (pendingNode) {
      pendingNode.available = true
      cmd.onSelectMapNode(pendingNodeId)
    } else if (
      savedPhase === GamePhaseState.SHOP ||
      savedPhase === GamePhaseState.REST ||
      savedPhase === GamePhaseState.EVENT
    ) {
      if (savedPhase === GamePhaseState.SHOP) cmd.initializeShopPhase()
      else if (savedPhase === GamePhaseState.REST) cmd.initializeRestPhase()
      else cmd.initializeEventPhase()
    } else if (this.state.phase !== GamePhaseState.REWARD) {
      this.state.phase = GamePhaseState.MAP
      // Safety net: if this endless save was stranded on a completed act map
      // (e.g. a legacy save from the old act-transition save race), roll it over
      // to the next act so the player resumes with a selectable node.
      if (this.state.isEndless) {
        cmd.recoverIfEndlessStranded()
      }
    }
    this.state.time = 999 * 1000
    this.state.roundTime = 999
    player.alive = true
    player.loadingProgress = 100

    logger.info(`Run resumed for ${player.name} (Act ${this.state.currentAct}, Floor ${this.state.currentFloor}${this.state.isEndless ? ", Endless" : ""})`)
  }

  async onAuth(client: Client, options, context) {
    if (options.idToken) {
      const token = await admin.auth().verifyIdToken(options.idToken)
      const user = await admin.auth().getUser(token.uid)
      const gameName = options.displayName || "Player"
      const UserMetadata = require("../models/mongo-models/user-metadata").default
      await UserMetadata.updateOne(
        { uid: user.uid },
        { $set: { displayName: gameName }, $setOnInsert: { uid: user.uid } },
        { upsert: true }
      )
      return {
        uid: user.uid,
        displayName: gameName
      }
    }
    console.log("Guest has connected")
    return {
      uid: options.odToken || "local-player",
      displayName: options.displayName || "Player"
    }
  }

  async onJoin(client: Client) {
    this.dispatcher.dispatch(new OnJoinCommand(), { client })
    this.updateSpectateMetadata()
  }

  // Drop human players who have gone idle (see the anti-AFK logic in
  // OnUpdateCommand). Signed-in players' progress is persisted first so they can
  // resume from the lobby; the client shows the standard "Disconnected" overlay.
  disconnectIdlePlayers() {
    if (this.idleDisconnected) return
    // A superseded room is being torn down by a newer session; never let its idle
    // path write a stale save over that session's progress.
    if (this.superseded) return
    this.idleDisconnected = true
    const { saveRun } = require("../services/run-save")
    const humanUids = new Set<string>()
    this.state.players.forEach((p: Player) => {
      if (!p.isBot) {
        humanUids.add(p.id)
        if (p.alive && !this.state.gameFinished && !this.state.runFailed) {
          try {
            saveRun(p.id, this.state, p)
          } catch (err) {
            logger.error("idle disconnect: failed to save run", err)
          }
        }
      }
    })

    const idleSeconds = Math.round(this.idleTimeMs / 1000)
    this.clients.forEach((client) => {
      if (client.auth && humanUids.has(client.auth.uid)) {
        const name = this.state.players.get(client.auth.uid)?.name || client.auth.uid
        logger.info(
          `Disconnecting idle player ${name} (${client.auth.uid}) from game ${this.roomId} after ${idleSeconds}s inactive | act: ${this.state.currentAct} floor: ${this.state.currentFloor}`
        )
        client.leave(IDLE_DISCONNECT_CODE)
      }
    })
  }

  async onLeave(client: Client, code: number) {
    if (client.auth && this.state.spectators.has(client.auth.uid)) {
      this.state.spectators.delete(client.auth.uid)
      this.updateSpectateMetadata()
      logger.info(`Spectator ${client.auth.uid} left game ${this.roomId}`)
      return
    }

    // Stop this (now player-less) room from auto-saving — a reconnect resumes in a
    // fresh room, so any further save from here would race/clobber that one.
    this.playerLeft = true

    const player = this.state.players.get(client.auth?.uid)
    const name = player?.name || client.auth?.uid || "Unknown"
    const location = `act: ${this.state.currentAct} floor: ${this.state.currentFloor}`

    if (this.state.runComplete || this.state.runFailed || this.state.gameFinished) {
      const reason = this.state.runComplete ? "won" : this.state.runFailed ? "dead" : "game finished"
      logger.info(`${name} left game | reason: ${reason} | ${location}`)
    } else {
      logger.info(`${name} disconnected (code: ${code}) | ${location}`)
    }
  }

  async onDispose() {
    const humanPlayer = Array.from(this.state.players.values()).find(p => !p.isBot)
    const name = humanPlayer?.name || "Unknown"
    logger.info(`Dispose Game ${this.roomId} | player: ${name}`)

    // Must unsubscribe the exact handler: presence is a shared EventEmitter across
    // all rooms, so omitting the callback would drop every other live room's listener.
    // Skipping this entirely leaks the whole room (state/board/sims). See AI-MEMORY-LEAKS.md.
    this.presence.unsubscribe("server-announcement", this.onServerAnnouncement)
    this.presence.unsubscribe("supersede-session", this.onSupersedeSession)

    // Leaving on the act-3 victory screen (boss beaten, Elite Four offered but not
    // yet entered) is NOT a run end — keep the save so the player can resume into
    // the Elite Four later. The victory itself was already counted when the boss
    // fell, so nothing is lost by deferring.
    const bonusPending =
      this.state.currentAct === 3 &&
      this.state.runComplete &&
      this.state.eliteFourAvailable &&
      !this.state.runFailed &&
      !this.state.gameFinished

    if (!this.runHistoryRecorded && !bonusPending && (this.state.runComplete || this.state.runFailed) && humanPlayer) {
      this.runHistoryRecorded = true
      const { deleteSavedRun, saveRunHistory, incrementRunEnd, updateVictoryRecord, isRunVictory } = require("../services/run-save")
      const won = isRunVictory(this.state)
      deleteSavedRun(humanPlayer.id)
      await saveRunHistory(humanPlayer.id, this.state, humanPlayer, won)
      // Win + victory were counted at the act-3 boss; here we only add the champion
      // stat (once) and Arceus damage, and record a loss for runs that never won.
      await incrementRunEnd(humanPlayer.id, this.state.difficultyMode, false, this.becameChampion, this.state.arceusDamageDealt)
      if (!won) {
        await updateVictoryRecord(humanPlayer.id, humanPlayer.name, humanPlayer.avatar, this.state.difficultyMode, false, this.state.isEndless)
      }
      logger.info(`Deferred run history saved for ${name} | victory: ${won}`)
    }

    this.dispatcher.stop()
  }

  updateSpectateMetadata() {
    this.setMetadata({
      ...this.metadata,
      currentAct: this.state.currentAct,
      currentFloor: this.state.currentFloor,
      runHP: this.state.runHP,
      spectatorCount: this.state.spectators.size
    })
  }

  isPlayer(client: Client): boolean {
    return !!client.auth && this.state.players.has(client.auth.uid)
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
      pokemon.onAcquired(player)
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
        pokemon.evolutionRule.type === EvolutionRuleType.COUNT
      ) {
        const pokemonEvolved = EvolutionManager.tryEvolve(pokemon, player)
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
    pokemon: Pokemon,
    itemAcquired: Item
  ): Pokemon | void {
    const player = this.state.players.get(playerId)
    if (!player) return

    if (
      pokemon.evolutionRule &&
      pokemon.evolutionRule.type === EvolutionRuleType.ITEM
    ) {
      const pokemonEvolved = EvolutionManager.tryEvolve(
        pokemon,
        player,
        itemAcquired
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

    if (choice.type === "unlockReward") {
      const pkm = choice.pokemons[choiceIndex]
      if (pkm && pkm !== Pkm.DEFAULT) {
        const freeSpace = getFreeSpaceOnBench(player.board)
        if (freeSpace < 1 && !bypassLackOfSpace) return false
        const data = getPokemonData(pkm as Pkm)
        if (data.rarity === Rarity.HATCH) {
          const egg = PokemonFactory.createPokemonFromName(Pkm.EGG, player) as Egg
          egg.action = PokemonActionState.SLEEP
          egg.evolution = pkm as Pkm
          egg.stacksRequired = getHatchTime(egg, player)
          const x = getFirstAvailablePositionInBench(player.board)
          if (x !== null) {
            egg.positionX = x
            egg.positionY = 0
            player.board.set(egg.id, egg)
          }
        } else {
          this.spawnOnBench(player, pkm as Pkm)
        }
      }
      if (pkm === Pkm.DEFAULT && choice.items?.length) {
        choice.items.forEach(item => { if (item) player.items.push(item) })
      }
      const idx = player.choices.indexOf(choice)
      if (idx >= 0) player.choices.splice(idx, 1)
      return
    }

    if (choice.type === "wildReward" || choice.type === "gymReward" || choice.type === "eliteReward") {
      const pkm = choice.pokemons[choiceIndex]
      if (pkm && pkm !== Pkm.DEFAULT) {
        const freeSpace = getFreeSpaceOnBench(player.board)
        if (freeSpace < 1 && !bypassLackOfSpace) return false
        this.spawnOnBench(player, pkm as Pkm)
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
        pokemon.evolutionRule.type === EvolutionRuleType.COUNT &&
        EvolutionManager.canEvolveIfGettingOne(pokemon, player)

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
              ? EvolutionManager.getEvolution(
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
      const pickedPkm = choice.pokemons.length > 0 ? choice.pokemons[choiceIndex] : undefined
      // Ditto (and its Mystery Box → Meltan swap) never grants the paired item.
      const pickedDitto = pickedPkm === Pkm.DITTO || pickedPkm === Pkm.MELTAN
      if (!pickedDitto) {
        // 6.10.1: wands are managed via fairyWands + updateFairyWands(), and must
        // NOT also be pushed to player.items (that was the wand duplication bug).
        if (isIn(Wands, item)) {
          player.fairyWands.push(item)
          player.updateFairyWands()
        } else {
          player.items.push(item)
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
