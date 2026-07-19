import { Dispatcher } from "@colyseus/command"
import type { MapSchema } from "@colyseus/schema"
import { type Client, matchMaker, Room } from "colyseus"
import admin from "firebase-admin"
import {
  getItemSellValue,
  MAX_LOADING_TIME,
  MAX_SIMULATION_DELTA_TIME
} from "../config"
import { EvolutionManager } from "../core/evolution-logic/evolution-manager"
import { getHatchTime } from "../core/evolution-logic/hatch-time"
import { MiniGame } from "../core/mini-game"
import { isRelic, Relic } from "../core/relics"
import type { IGameUser } from "../models/colyseus-models/game-user"
import { type MapNode, MapNodeType } from "../models/colyseus-models/map-node"
import Player from "../models/colyseus-models/player"
import type { Egg, Pokemon } from "../models/colyseus-models/pokemon"
import PokemonFactory from "../models/pokemon-factory"
import {
  getAdditionalsTier1,
  getPokemonData
} from "../models/precomputed/precomputed-pokemon-data"
import { PRECOMPUTED_POKEMONS_PER_RARITY } from "../models/precomputed/precomputed-rarity"
import { getSellPrice } from "../models/shop"
import {
  addHardModeItems,
  adjustEncounterItems,
  type DifficultyMode,
  type SpireEncounter
} from "../models/spire-encounters"
import {
  type ApprovedEliteDesign,
  classicFloorToStageRange,
  designToSpireEliteData,
  getApprovedBossDesigns,
  getApprovedEliteDesigns,
  getEliteDesignById,
  getRandomAutoWaveMatchup,
  type SpireEliteDesignData,
  spireFloorToStageRange
} from "../services/elite-design"
import type { ParsedEliteDesign } from "../services/elite-test"
import {
  type IDragDropCombineMessage,
  type IDragDropItemMessage,
  type IDragDropMessage,
  type IGameHistoryPokemonRecord,
  type IGameHistorySimplePlayer,
  type IGameMetadata,
  type IPokemon,
  type IPokemonEntity,
  Role,
  Transfer
} from "../types"
import { EvolutionRuleType } from "../types/EvolutionRules"
import { DungeonPMDO } from "../types/enum/Dungeon"
import type { EloRank } from "../types/enum/EloRank"
import {
  BattleResult,
  type GameMode,
  GamePhaseState,
  PokemonActionState,
  Rarity
} from "../types/enum/Game"
import {
  Item,
  isItemSellable,
  type SynergyGem,
  SynergyGivenByGem,
  Wands
} from "../types/enum/Item"
import { Passive } from "../types/enum/Passive"
import {
  Pkm,
  PkmDuos,
  PkmIndex,
  PkmRegionalVariants
} from "../types/enum/Pokemon"
import { SpecialGameRule } from "../types/enum/SpecialGameRule"
import type { Synergy } from "../types/enum/Synergy"
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
  isEliteLossResult,
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
  asyncFightSnapshots: Map<
    string,
    { snapshot: any; name: string; avatar: string; region: string }
  > = new Map()
  // Spire mode: elite fights draw from APPROVED library designs instead of the
  // hardcoded pool. Populated per act map in ALL modes, acts 1-3 (see
  // populateEliteDesignNodes); keyed by
  // map node id. spireEliteRewardSource is stashed on elite node select so the
  // reward phase can offer the design's own win/loss reward pools.
  spireEliteDesigns: Map<string, SpireEliteDesignData> = new Map()
  spireEliteRewardSource: SpireEliteDesignData | null = null
  // Elite Designer "test fight" sandbox. When true the room runs no real spire run
  // (no map/starter/run-HP); it parks in an idle PICK phase and only runs one-off
  // AI-vs-AI simulations on TEST_ELITE_DESIGN. eliteTestFightStart stamps the start
  // of the current test fight so the result can report a duration.
  isEliteTest: boolean = false
  eliteTestFightStart: number = 0
  eliteTestOpponentDesign: ParsedEliteDesign | null = null
  isAutoWave: boolean = false
  autoWaveLoading: boolean = false
  autoWavePrediction: "blue" | "red" | null = null
  autoWaveMatchup: {
    blue: { id: string; name: string; act: number; stageRange: string }
    red: { id: string; name: string; act: number; stageRange: string }
  } | null = null
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
    idToken,
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
    isSpire,
    spireClass,
    isTutorial,
    eliteTest,
    autoWave
  }: {
    idToken?: string
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
    isSpire?: boolean
    spireClass?: string
    isTutorial?: boolean
    eliteTest?: boolean
    autoWave?: boolean
  }) {
    this.isAutoWave = !!autoWave
    this.isEliteTest = !!eliteTest || this.isAutoWave
    const creatorUid = Object.keys(users || {})[0]
    if (this.isAutoWave) {
      if (!creatorUid || creatorUid === "local-player" || !idToken) {
        throw new Error("AutoWave requires an admin account")
      }
      const token = await admin.auth().verifyIdToken(idToken)
      if (token.uid !== creatorUid) {
        throw new Error("AutoWave account mismatch")
      }
      const UserMetadata =
        require("../models/mongo-models/user-metadata").default
      const meta = await UserMetadata.findOne(
        { uid: creatorUid },
        { role: 1 }
      ).lean()
      if (meta?.role !== Role.ADMIN) {
        throw new Error("AutoWave requires an admin account")
      }
    } else if (this.isEliteTest) {
      // The Elite Designer test sandbox is sign-in only: guests all share the
      // "local-player" uid and would otherwise co-own one library bucket.
      if (!creatorUid || creatorUid === "local-player") {
        throw new Error("The Elite Designer requires an account")
      }
    }
    const diffLabel = isEndless
      ? "Endless"
      : difficultyMode === 0
        ? "Easy"
        : difficultyMode === 2
          ? "Hard"
          : difficultyMode === 3
            ? "Impossible"
            : "Normal"
    const playerName =
      ownerName || Object.values(users || {})[0]?.name || "Unknown"
    logger.info(
      `Create Game ${this.roomId} | player: ${playerName} | difficulty: ${diffLabel}`
    )

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
      isEliteTest: !!eliteTest,
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
    if (isTutorial) {
      // Tutorial: a guided, fully-scripted single-act run on the normal-mode
      // ruleset. Never spire/endless; difficulty pinned to Normal. The scripted
      // map + encounters + dialog are keyed off `state.isTutorial`.
      this.state.isTutorial = true
      this.state.difficultyMode = 1
    } else if (isEndless) {
      const { isEndlessEnabled } = require("../services/endless-config")
      if (!resume && !isEndlessEnabled()) {
        // Endless is disabled for new runs; allow admins through for testing
        // (resuming an already-started endless run is always permitted).
        const creatorUid = Object.keys(users || {})[0]
        let isCreatorAdmin = false
        if (creatorUid && creatorUid !== "local-player") {
          try {
            const UserMetadata =
              require("../models/mongo-models/user-metadata").default
            const meta = await UserMetadata.findOne(
              { uid: creatorUid },
              { role: 1 }
            ).lean()
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
    } else if (isSpire) {
      // Spire mode is admin-only while in development (resuming an
      // already-started spire run is always permitted).
      if (!resume) {
        const creatorUid = Object.keys(users || {})[0]
        let isCreatorAdmin = false
        if (creatorUid && creatorUid !== "local-player") {
          try {
            const UserMetadata =
              require("../models/mongo-models/user-metadata").default
            const meta = await UserMetadata.findOne(
              { uid: creatorUid },
              { role: 1 }
            ).lean()
            isCreatorAdmin = meta?.role === Role.ADMIN
          } catch (e) {
            isCreatorAdmin = false
          }
        }
        if (!isCreatorAdmin) {
          throw new Error("Spire mode is not available yet")
        }
      }
      // Spire mode: own 16-floor / Act-3 ruleset + own difficulty curve. We keep
      // difficultyMode = 1 (Normal) so the many `difficultyMode >= 2` hard-mode
      // checks never fire; Spire's independent scaling is keyed off `isSpire`.
      this.state.isSpire = true
      this.state.spireClass = spireClass ?? ""
      this.state.difficultyMode = 1
    } else if (
      difficultyMode === 0 ||
      difficultyMode === 2 ||
      difficultyMode === 3
    ) {
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
          const UserMetadata =
            require("../models/mongo-models/user-metadata").default
          const meta = await UserMetadata.findOne(
            { uid: user.uid },
            { role: 1 }
          ).lean()
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
              this.state.updatePhaseNeeded = true
              this.state.time = 0
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
        const choiceIdx = player.choices.findIndex(
          (c) => c.type === "wildReward"
        )
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
          this.state.withRunRng(() => {
            cmd.generateWildRewardChoice(player, node, won, true)
          })
          this.autoSaveRun()
        }
      }
    })

    this.onMessage(
      Transfer.USE_REWARD_TICKET,
      (client, { ticket }: { ticket: Item }) => {
        if (this.state.gameFinished || !client.auth || !this.isPlayer(client))
          return
        if (!this.state.isSpire) return
        const player = this.state.players.get(client.auth.uid)
        if (!player) return
        const { RerollTickets } = require("../types/enum/Item")
        if (!RerollTickets.includes(ticket) || !player.items.includes(ticket))
          return
        const choiceIdx = player.choices.findIndex(
          (c) => c.type === "wildReward"
        )
        if (choiceIdx < 0) return
        const node = this.state.mapNodes.get(this.state.currentNodeId)
        const { MapNodeType } = require("../models/colyseus-models/map-node")
        if (!node || node.nodeType !== MapNodeType.WILD_BATTLE) return // wild rewards only

        const choice = player.choices[choiceIdx]
        const currentPokemon = Array.from(choice.pokemons).filter(
          (p) => p && p !== Pkm.DEFAULT
        ) as Pkm[]

        // Pick the new Pokémon pool per ticket type (undefined = fresh region reroll).
        let pool: Pkm[] | undefined
        let componentsOnlyCount: number | undefined
        const {
          rerollWildRewardClass,
          rerollWildRewardUpgrade
        } = require("../models/spire-encounters")
        this.state.withRunRng(() => {
          if (ticket === Item.CLASS_REROLL_TICKET) {
            const { SPIRE_CLASSES } = require("../core/spire-classes")
            const classSyns =
              SPIRE_CLASSES[this.state.spireClass]?.synergies ?? []
            pool = rerollWildRewardClass(currentPokemon, classSyns)
          } else if (ticket === Item.UPGRADE_TICKET) {
            pool = rerollWildRewardUpgrade(currentPokemon, node.region)
          } else if (ticket === Item.ITEM_REROLL_TICKET) {
            // Every option (incl. the win item slot) becomes a random component
            componentsOnlyCount = choice.pokemons.length
          }
        })

        // Consume the ticket, then regenerate the offer. We keep the old offer in
        // place for now and overwrite its slot by index afterwards.
        const itemIdx = player.items.indexOf(ticket)
        if (itemIdx >= 0) player.items.splice(itemIdx, 1)
        const won = player.history.at(-1)?.result === BattleResult.WIN
        const cmd = new OnUpdatePhaseCommand()
        cmd.setPayload({})
        cmd.room = this
        cmd.state = this.state
        cmd.clock = this.clock
        this.state.withRunRng(() => {
          cmd.generateWildRewardChoice(
            player,
            node,
            won,
            true,
            pool,
            componentsOnlyCount
          )
        })
        // generateWildRewardChoice appends the new offer at the end. Move it back
        // to the old offer's position so the other reward rows (xp/ticket/berry)
        // keep their place. We can't splice-insert into the middle of an
        // ArraySchema (Colyseus requires insertCount <= deleteCount), so overwrite
        // the old slot by index and drop the duplicate left at the end.
        const regenerated = player.choices.pop()
        if (regenerated) player.choices[choiceIdx] = regenerated
        this.autoSaveRun()
      }
    )

    this.onMessage(Transfer.REROLL_ELITE_REWARD, (client) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        const player = this.state.players.get(client.auth.uid)
        if (!player || player.money < 1) return
        const choiceIdx = player.choices.findIndex(
          (c) => c.type === "eliteReward"
        )
        if (choiceIdx < 0) return
        // Determine the reward tier from the fight result. Custom loss pools may
        // include paired items, so items.length cannot distinguish wins from losses.
        const wasLossReward = isEliteLossResult(player.history.at(-1)?.result)
        player.choices.splice(choiceIdx, 1)
        player.money -= 1
        const cmd = new OnUpdatePhaseCommand()
        cmd.setPayload({})
        cmd.room = this
        cmd.state = this.state
        cmd.clock = this.clock
        this.state.withRunRng(() => {
          if (wasLossReward) {
            cmd.generateEliteLossChoice(player)
          } else {
            cmd.generateEliteRewardChoice(player)
          }
        })
        this.autoSaveRun()
      }
    })

    this.onMessage(Transfer.REROLL_BOSS_REWARD, (client) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        const player = this.state.players.get(client.auth.uid)
        const node = this.state.mapNodes.get(this.state.currentNodeId)
        const isAsyncMiniBoss =
          node?.nodeType === "ASYNC_FIGHT" && node.floor !== 20
        const isEndlessActBoss =
          node?.nodeType === "ASYNC_FIGHT" && node.floor === 20
        const cost = isAsyncMiniBoss ? 1 : 20
        if (!player || player.money < cost) return
        const choiceIdx = player.choices.findIndex((c) => c.type === "item")
        if (choiceIdx < 0) return
        const currentItems = [...player.choices[choiceIdx].items]
        player.choices.splice(choiceIdx, 1)
        player.money -= cost
        const { pickNRandomIn } = require("../utils/random")
        const {
          ShinyItems,
          Tools,
          ItemComponentsNoFossilOrScarf
        } = require("../types/enum/Item")
        const {
          PlayerChoice
        } = require("../models/colyseus-models/player-choice")
        this.state.withRunRng(() => {
          if (isAsyncMiniBoss) {
            const pool = ItemComponentsNoFossilOrScarf.filter(
              (i: Item) => !currentItems.includes(i)
            )
            const newItems = pickNRandomIn(
              pool.length >= 3 ? pool : ItemComponentsNoFossilOrScarf,
              3
            )
            player.choices.push(
              new PlayerChoice({ type: "item", items: newItems })
            )
          } else if (isEndlessActBoss) {
            // Endless floor-20 boss reward is offered from the combined
            // ShinyItems + Tools pool, so the reroll must draw from that same
            // combined pool (the legendary-boss branch below narrows to one pool
            // by item type, which is wrong for a mixed offer). Just exclude the
            // items from the previous offering.
            const count = currentItems.length || 1
            const fullPool = [...ShinyItems, ...Tools]
            const filteredPool = fullPool.filter(
              (i: Item) => !currentItems.includes(i)
            )
            const pool = filteredPool.length >= count ? filteredPool : fullPool
            const newItems = pickNRandomIn(pool, count)
            player.choices.push(
              new PlayerChoice({ type: "item", items: newItems })
            )
          } else {
            // Preserve the number of choices originally offered (boss win = 3,
            // boss loss = 1). Re-picking a fixed 3 here turned a single loss
            // reward into three on reroll.
            const count = currentItems.length || 1
            const originalWasTools = currentItems.some((i: Item) =>
              Tools.includes(i)
            )
            const fullPool = originalWasTools ? [...Tools] : [...ShinyItems]
            const filteredPool = fullPool.filter(
              (i: Item) => !currentItems.includes(i)
            )
            const pool = filteredPool.length >= count ? filteredPool : fullPool
            const newItems = pickNRandomIn(pool, count)
            player.choices.push(
              new PlayerChoice({ type: "item", items: newItems })
            )
          }
        })
        this.autoSaveRun()
      }
    })

    this.onMessage(Transfer.REROLL_STARTER, (client) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        const player = this.state.players.get(client.auth.uid)
        if (!player) return
        const choiceIdx = player.choices.findIndex((c) => c.type === "starter")
        if (choiceIdx < 0) return
        player.choices.splice(choiceIdx, 1)
        const {
          pickRandomIn: pickRandom,
          pickNRandomIn: pickNRandom
        } = require("../utils/random")
        const { ItemComponentsNoFossilOrScarf } = require("../types/enum/Item")
        const {
          getPokemonData
        } = require("../models/precomputed/precomputed-pokemon-data")
        const {
          PlayerChoice
        } = require("../models/colyseus-models/player-choice")
        const isImpossibleReroll = this.state.difficultyMode === 3
        const allOneStars = (
          isImpossibleReroll
            ? [...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON]
            : [
                ...PRECOMPUTED_POKEMONS_PER_RARITY.COMMON,
                ...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON,
                ...PRECOMPUTED_POKEMONS_PER_RARITY.RARE,
                ...PRECOMPUTED_POKEMONS_PER_RARITY.EPIC
              ]
        ).filter((p: Pkm) => getPokemonData(p).stars === 1)
        const starterOptions = this.state.withRunRng(() =>
          pickNRandom(allOneStars, 5)
        )
        const starterItems = isImpossibleReroll
          ? []
          : this.state.withRunRng(() =>
              starterOptions.map(() =>
                pickRandom(ItemComponentsNoFossilOrScarf)
              )
            )
        player.choices.push(
          new PlayerChoice({
            type: "starter",
            pokemons: starterOptions,
            items: starterItems
          })
        )
        this.autoSaveRun()
      }
    })

    this.onMessage(Transfer.REROLL_MAP, (client) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        const player = this.state.players.get(client.auth.uid)
        if (!player) return
        if (!player.choices.some((c) => c.type === "starter")) return
        this.clearEliteDesignAssignments()
        const { generateActMap } = require("../core/map-generator")
        this.state.mapNodes.clear()
        this.state.mapEdges.splice(0, this.state.mapEdges.length)
        this.state.withRunRng(() => {
          generateActMap(
            this.state.currentAct,
            this.state.mapNodes,
            this.state.mapEdges,
            this.state.difficultyMode as 0 | 1 | 2 | 3,
            this.state.isEndless,
            this.state.isSpire
          )
        })
        if (this.state.isEndless) this.populateAsyncFightNodes()
        this.populateEliteDesignNodes()
      }
    })

    this.onMessage(Transfer.PASS_REWARD, (client) => {
      if (!this.state.gameFinished && client.auth && this.isPlayer(client)) {
        const player = this.state.players.get(client.auth.uid)
        if (!player) return
        const choiceIdx = player.choices.findIndex(
          (c) =>
            c.type === "gymReward" ||
            c.type === "eliteReward" ||
            c.type === "unlockReward"
        )
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
        const synType = SynergyGivenByGem[itemId as SynergyGem]
        if (synType) {
          const current = player.bonusSynergies.get(synType) ?? 0
          if (current <= 1) {
            player.bonusSynergies.delete(synType)
          } else {
            player.bonusSynergies.set(synType, current - 1)
          }
          player.updateSynergies()
        }
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
          if (this.isEliteTest) {
            this.startEliteTestMode()
          } else if (this.isResume) {
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
      async (
        client,
        payload: {
          design?: string
          opponent?: {
            type?: unknown
            stage?: unknown
            difficulty?: unknown
            designId?: unknown
          }
        }
      ) => {
        // Elite Designer sandbox only. Stages a saved-team snapshot, live PVE
        // encounter, or another library design; the fight still waits for Begin.
        if (
          !this.isEliteTest ||
          this.isAutoWave ||
          !client.auth ||
          !this.isPlayer(client)
        )
          return
        if (this.state.phase === GamePhaseState.FIGHT) return
        try {
          const {
            createBuiltInEliteTestEncounter,
            parseEliteDesignExport,
            parseEliteTestBossAct,
            parseEliteTestDifficulty
          } = require("../services/elite-test")
          const design = parseEliteDesignExport(payload?.design ?? "")
          if (!design || design.board.length === 0) {
            this.broadcast(Transfer.ELITE_TEST_RESULT, {
              error: "empty_design"
            })
            return
          }

          const request = payload?.opponent
          if (!request || typeof request !== "object") {
            this.broadcast(Transfer.ELITE_TEST_RESULT, {
              error: "invalid_target"
            })
            return
          }
          const player = schemaValues(this.state.players).find(
            (candidate: Player) => !candidate.isBot
          )
          if (!player) return
          const cmd = new OnUpdatePhaseCommand()
          cmd.setPayload({})
          cmd.room = this
          cmd.state = this.state
          cmd.clock = this.clock

          if (request.type === "design") {
            if (
              typeof request.designId !== "string" ||
              request.designId.length === 0
            ) {
              this.broadcast(Transfer.ELITE_TEST_RESULT, {
                error: "invalid_target"
              })
              return
            }
            const opponentDoc = await getEliteDesignById(request.designId)
            if ((this.state.phase as number) === GamePhaseState.FIGHT) return
            if (!opponentDoc) {
              this.broadcast(Transfer.ELITE_TEST_RESULT, {
                error: "opponent_not_found"
              })
              return
            }
            const opponentDesign = parseEliteDesignExport(
              opponentDoc.designJson
            )
            if (!opponentDesign || opponentDesign.board.length === 0) {
              this.broadcast(Transfer.ELITE_TEST_RESULT, {
                error: "invalid_opponent"
              })
              return
            }
            const rangeEnd =
              opponentDoc.stageRange === "boss"
                ? 20
                : Number(opponentDoc.stageRange.match(/-(\d+)$/)?.[1] ?? 20)
            const stageLevel = (opponentDoc.act - 1) * 15 + rangeEnd
            this.state.difficultyMode = 1
            player.map = "town" as any
            cmd.setupEliteTestDesignPreview(
              player,
              design,
              opponentDesign,
              stageLevel
            )
            return
          }

          if (request.type !== "stage") {
            this.broadcast(Transfer.ELITE_TEST_RESULT, {
              error: "invalid_target"
            })
            return
          }
          const difficulty = parseEliteTestDifficulty(request.difficulty)
          if (difficulty == null) {
            this.broadcast(Transfer.ELITE_TEST_RESULT, {
              error: "invalid_target"
            })
            return
          }
          const target = typeof request.stage === "string" ? request.stage : ""
          const bossAct = parseEliteTestBossAct(target)
          const isSpecialTarget = bossAct != null || target === "arceus"
          if (
            !isSpecialTarget &&
            (target.startsWith("boss-act") ||
              !/^act\d+-floor(?:5|10|15|20)$/.test(target))
          ) {
            this.broadcast(Transfer.ELITE_TEST_RESULT, {
              error: "invalid_target"
            })
            return
          }
          this.state.difficultyMode = difficulty

          if (isSpecialTarget) {
            let encounter: SpireEncounter | null = null
            let stageLevel = 61
            if (bossAct != null) {
              const approvedBosses = (await getApprovedBossDesigns(bossAct))
                .map((doc) => designToSpireEliteData(doc))
                .filter(
                  (candidate): candidate is SpireEliteDesignData =>
                    candidate?.kind === "boss"
                )
              const selected =
                approvedBosses.length > 0
                  ? this.state.withRunRng(
                      () =>
                        approvedBosses[
                          Math.floor(Math.random() * approvedBosses.length)
                        ]
                    )
                  : null
              encounter = selected
                ? addHardModeItems(
                    adjustEncounterItems(
                      selected.encounter,
                      difficulty as DifficultyMode,
                      bossAct
                    ),
                    bossAct,
                    20,
                    difficulty as DifficultyMode
                  )
                : createBuiltInEliteTestEncounter(target, difficulty)
              stageLevel = (bossAct - 1) * 15 + 20
              player.map = "town" as any
            } else {
              encounter = createBuiltInEliteTestEncounter(target, difficulty)
              player.map = "In the Nightmare" as any
            }
            if (!encounter) {
              this.broadcast(Transfer.ELITE_TEST_RESULT, {
                error: "invalid_target"
              })
              return
            }
            if ((this.state.phase as number) === GamePhaseState.FIGHT) return
            cmd.setupEliteTestEncounterPreview(
              player,
              design,
              encounter,
              stageLevel
            )
            return
          }

          const {
            getRandomAsyncOpponentNoFallback
          } = require("../services/async-fight-pool")
          const opponent = await getRandomAsyncOpponentNoFallback(target)
          if ((this.state.phase as number) === GamePhaseState.FIGHT) return
          if (!opponent) {
            this.broadcast(Transfer.ELITE_TEST_RESULT, {
              error: "no_data",
              stage: target
            })
            return
          }
          const stageMatch = target.match(/^act(\d+)-floor(\d+)$/)
          const act = Number(stageMatch?.[1] ?? 1)
          const floor = Number(stageMatch?.[2] ?? 1)
          const stageLevel = (act - 1) * 15 + floor
          player.map = (opponent.region || "town") as any
          cmd.setupEliteTestPreview(player, design, opponent, stageLevel)
        } catch (error) {
          logger.error("elite test preview error", error)
        }
      }
    )

    this.onMessage(Transfer.BEGIN_ELITE_TEST, (client) => {
      // Start the staged elite test fight (both teams already previewed on board).
      if (
        !this.isEliteTest ||
        this.isAutoWave ||
        !client.auth ||
        !this.isPlayer(client)
      )
        return
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

    this.onMessage(Transfer.AUTOWAVE_NEXT_ROUND, async (client) => {
      if (
        !this.isAutoWave ||
        !client.auth ||
        !this.isPlayer(client) ||
        this.autoWaveLoading ||
        this.state.phase === GamePhaseState.FIGHT ||
        this.state.eliteTestAwaitingBegin
      )
        return

      this.autoWaveLoading = true
      try {
        const matchup = await getRandomAutoWaveMatchup()
        if (
          (this.state.phase as number) === GamePhaseState.FIGHT ||
          this.state.eliteTestAwaitingBegin
        )
          return
        if (!matchup) {
          client.send(Transfer.AUTOWAVE_MATCHUP, {
            error: "insufficient_pool"
          })
          return
        }

        const { parseEliteDesignExport } = require("../services/elite-test")
        const blueDesign = parseEliteDesignExport(matchup.blue.designJson)
        const redDesign = parseEliteDesignExport(matchup.red.designJson)
        if (
          !blueDesign ||
          blueDesign.board.length === 0 ||
          !redDesign ||
          redDesign.board.length === 0
        ) {
          client.send(Transfer.AUTOWAVE_MATCHUP, {
            error: "invalid_design"
          })
          return
        }

        const player = this.state.players.get(client.auth.uid)
        if (!player) return
        const cmd = new OnUpdatePhaseCommand()
        cmd.setPayload({})
        cmd.room = this
        cmd.state = this.state
        cmd.clock = this.clock
        const rangeEnd = Number(
          matchup.red.stageRange.match(/-(\d+)$/)?.[1] ?? 20
        )
        const stageLevel = (matchup.red.act - 1) * 15 + rangeEnd
        this.state.difficultyMode = 1
        player.map = "town"
        cmd.setupEliteTestDesignPreview(
          player,
          blueDesign,
          redDesign,
          stageLevel
        )
        this.autoWavePrediction = null
        this.autoWaveMatchup = {
          blue: {
            id: matchup.blue.id,
            name: matchup.blue.name,
            act: matchup.blue.act,
            stageRange: matchup.blue.stageRange
          },
          red: {
            id: matchup.red.id,
            name: matchup.red.name,
            act: matchup.red.act,
            stageRange: matchup.red.stageRange
          }
        }
        client.send(Transfer.AUTOWAVE_MATCHUP, this.autoWaveMatchup)
      } catch (error) {
        logger.error("AutoWave matchup error", error)
        client.send(Transfer.AUTOWAVE_MATCHUP, { error: "server_error" })
      } finally {
        this.autoWaveLoading = false
      }
    })

    this.onMessage(
      Transfer.AUTOWAVE_PREDICT,
      (client, prediction: "blue" | "red") => {
        if (
          !this.isAutoWave ||
          !client.auth ||
          !this.isPlayer(client) ||
          !this.autoWaveMatchup ||
          this.autoWavePrediction != null ||
          !this.state.eliteTestAwaitingBegin ||
          (prediction !== "blue" && prediction !== "red")
        )
          return

        this.autoWavePrediction = prediction
        try {
          const cmd = new OnUpdatePhaseCommand()
          cmd.setPayload({})
          cmd.room = this
          cmd.state = this.state
          cmd.clock = this.clock
          cmd.beginEliteTestFight()
        } catch (error) {
          this.autoWavePrediction = null
          logger.error("AutoWave prediction error", error)
        }
      }
    )

    this.onMessage(
      Transfer.MEASURE_ELITE_DESIGN,
      async (client, payload: { id?: string }) => {
        // Elite Designer sandbox only. Measures a saved library design's success
        // rate: headless AI-vs-AI fights against every saved endless team in the
        // pools bracketing its stage range. Results persist to the design doc;
        // progress/result broadcast via ELITE_MEASURE_UPDATE.
        if (
          !this.isEliteTest ||
          this.isAutoWave ||
          !client.auth ||
          !this.isPlayer(client)
        )
          return
        if (this.state.phase === GamePhaseState.FIGHT) return
        const designId = payload?.id ?? ""
        try {
          const {
            measureEliteDesign,
            isEliteMeasureRunning
          } = require("../services/elite-test")
          const {
            getEliteDesignById,
            saveEliteDesignResults
          } = require("../services/elite-design")
          if (isEliteMeasureRunning()) {
            this.broadcast(Transfer.ELITE_MEASURE_UPDATE, {
              status: "error",
              designId,
              error: "busy"
            })
            return
          }
          const doc = await getEliteDesignById(designId)
          if (!doc) {
            this.broadcast(Transfer.ELITE_MEASURE_UPDATE, {
              status: "error",
              designId,
              error: "not_found"
            })
            return
          }
          const outcome = await measureEliteDesign(
            this,
            doc.designJson,
            doc.act,
            doc.stageRange,
            (done: number, total: number) => {
              try {
                this.broadcast(Transfer.ELITE_MEASURE_UPDATE, {
                  status: "progress",
                  designId,
                  done,
                  total
                })
              } catch {
                // Room may be tearing down mid-batch; the measure loop aborts
                // on its own when the room empties.
              }
            },
            { shouldAbort: () => this.clients.length === 0 }
          )
          if (Array.isArray(outcome)) {
            // doc.designJson = what the fights actually ran against; if the
            // design was edited/bumped mid-measure the write is skipped.
            await saveEliteDesignResults(designId, outcome, doc.designJson)
            this.broadcast(Transfer.ELITE_MEASURE_UPDATE, {
              status: "done",
              designId,
              results: outcome
            })
          } else {
            this.broadcast(Transfer.ELITE_MEASURE_UPDATE, {
              status: "error",
              designId,
              error: outcome.error
            })
          }
        } catch (error) {
          logger.error("measure elite design error", error)
          try {
            this.broadcast(Transfer.ELITE_MEASURE_UPDATE, {
              status: "error",
              designId,
              error: "internal"
            })
          } catch {
            // room already disposed
          }
        }
      }
    )

    this.onMessage(Transfer.SKIP_REWARD, (client) => {
      const canAdvance =
        this.state.phase === GamePhaseState.PICK ||
        this.state.phase === GamePhaseState.SHOP
      if (
        !this.state.gameFinished &&
        client.auth &&
        this.isPlayer(client) &&
        canAdvance
      ) {
        this.state.updatePhaseNeeded = true
        this.state.time = 0
      }
    })

    // Forfeit every unclaimed reward. In REWARD this is the rewards screen's
    // Skip action. In MAP it also repairs stale MAP + choices saves; an optional
    // nodeId makes forfeiture and progression one server-authoritative action.
    this.onMessage(
      Transfer.SKIP_ALL_REWARDS,
      (client, payload?: { nodeId?: string }) => {
        if (this.state.gameFinished || !client.auth || !this.isPlayer(client))
          return

        const player = this.state.players.get(client.auth.uid)
        if (!player || player.choices.length === 0) return

        if (
          (this.state.phase !== GamePhaseState.REWARD &&
            this.state.phase !== GamePhaseState.MAP) ||
          player.choices.some((choice) => choice.type === "starter")
        )
          return

        const nodeId = payload?.nodeId
        if (nodeId) {
          // Validate the intended progression before discarding anything. A
          // stale or forged confirmation must never cost the player's rewards.
          const node = this.state.mapNodes.get(nodeId)
          if (!node || !node.available || node.visited) return
        }

        if (this.state.phase === GamePhaseState.REWARD && !nodeId) {
          player.choices.clear()
          this.state.updatePhaseNeeded = true
          this.state.time = 0
          return
        }

        player.choices.clear()
        if (!nodeId) {
          this.autoSaveRun()
          return
        }

        const cmd = new OnUpdatePhaseCommand()
        cmd.setPayload({})
        cmd.room = this
        cmd.state = this.state
        cmd.clock = this.clock
        if (this.state.phase === GamePhaseState.REWARD) {
          cmd.initializeMapPhase()
        }
        cmd.onSelectMapNode(nodeId)
        this.updateSpectateMetadata()
      }
    )

    this.onMessage(
      Transfer.GAME_SPEED,
      (client, { speed }: { speed: number }) => {
        if (
          client.auth &&
          this.isPlayer(client) &&
          (speed === 0.5 || speed === 1 || speed === 2 || speed === 3)
        ) {
          this.state.gameSpeed = speed
        }
      }
    )

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
        this.clearEliteDesignAssignments()
        this.state.withRunRng(() => {
          generateActMap(
            4,
            this.state.mapNodes,
            this.state.mapEdges,
            this.state.difficultyMode as 0 | 1 | 2 | 3
          )
        })
        this.state.players.forEach((p: Player) => {
          p.dojoFamilies.clear()
          if (!p.isBot) {
            p.alive = true
            // The act-3 boss gold row may still be unclaimed (the victory window
            // invites clicking straight through). Claim-and-clear it here — a
            // choice carried onto the act-4 map blocks every node click.
            this.forfeitPendingChoices(p)
          }
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
        this.clearEliteDesignAssignments()
        this.state.withRunRng(() => {
          generateActMap(
            5,
            this.state.mapNodes,
            this.state.mapEdges,
            this.state.difficultyMode as 0 | 1 | 2 | 3
          )
        })
        this.state.players.forEach((p: Player) => {
          p.dojoFamilies.clear()
          if (!p.isBot) {
            p.alive = true
            // The champion-win shiny item pick may still be unclaimed when
            // "Challenge Arceus" is pressed — same stale-choice hard-lock as
            // the Elite Four entry. Claim instant rows, forfeit the rest.
            this.forfeitPendingChoices(p)
          }
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
      this.clearEliteDesignAssignments()
      this.state.withRunRng(() => {
        generateActMap(
          act,
          this.state.mapNodes,
          this.state.mapEdges,
          this.state.difficultyMode as 0 | 1 | 2 | 3
        )
      })
      this.state.players.forEach((p: Player) => {
        p.dojoFamilies.clear()
        if (!p.isBot) {
          p.alive = true
        }
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
      const synType = SynergyGivenByGem[item as SynergyGem]
      if (synType) {
        player.bonusSynergies.set(
          synType,
          (player.bonusSynergies.get(synType) ?? 0) + 1
        )
        player.updateSynergies()
      }
    })

    this.onMessage(
      Transfer.GIVE_RELIC,
      (client, { relic }: { relic: string }) => {
        if (!client.auth) return
        const player = this.state.players.get(client.auth.uid)
        if (!player || player.role !== Role.ADMIN) return
        if (!isRelic(relic)) return
        this.grantRelic(player, relic, client)
      }
    )

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
          const meta =
            typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata
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
      this.presence.publish("supersede-session", {
        uid: this.ownerUid,
        newRoomId: this.roomId
      })
    }
  }

  onSupersedeSession(msg: { uid: string; newRoomId: string }) {
    if (
      msg &&
      msg.uid === this.ownerUid &&
      msg.newRoomId !== this.roomId &&
      !this.superseded
    ) {
      this.supersedeSession()
    }
  }

  // Kicked by a newer session for the same account. Block all further saves and
  // dispose, so this room can never overwrite the new session's progress.
  supersedeSession() {
    this.superseded = true
    this.playerLeft = true
    logger.info(
      `Superseding game ${this.roomId} for ${this.ownerUid} — a newer session started`
    )
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

  async autoSaveRun() {
    if (
      this.state.isTutorial ||
      this.isEliteTest ||
      this.playerLeft ||
      this.state.gameFinished ||
      this.state.runFailed
    )
      return

    const { saveRun } = require("../services/run-save")
    const saves: Promise<void>[] = []
    this.state.players.forEach((player) => {
      if (!player.isBot && player.alive) {
        saves.push(saveRun(player.id, this.state, player))
      }
    })
    await Promise.allSettled(saves)
  }

  clearEliteDesignAssignments() {
    this.spireEliteDesigns.clear()
    this.state.eliteDesignAssignments.clear()
  }

  // Assigns approved library designs to every elite and act-boss node in acts
  // 1-3. Missing elite brackets become wild fights; missing boss pools retain
  // the existing hardcoded bosses. Assignments persist with the run.
  async populateEliteDesignNodes() {
    if (this.state.isEndless && this.state.currentAct > 3) return

    const act = Math.min(this.state.currentAct, 3)
    this.spireEliteDesigns.clear()
    let assignmentsChanged = false

    const eliteNodes: { id: string; node: MapNode }[] = []
    this.state.mapNodes.forEach((node, id) => {
      if (node.nodeType === MapNodeType.ELITE) eliteNodes.push({ id, node })
    })
    const poolCache = new Map<string, ApprovedEliteDesign[]>()
    const usedEliteDesignIds = new Set<string>()
    const allDungeons = Object.values(DungeonPMDO)

    for (const { id, node } of eliteNodes) {
      const restored = this.state.eliteDesignAssignments.get(id)
      if (restored) {
        usedEliteDesignIds.add(restored.designId)
        this.spireEliteDesigns.set(id, restored)
        node.displayName = restored.name
        node.eliteAvatar = PkmIndex[restored.icon] ?? ""
        continue
      }

      const bracket = this.state.isSpire
        ? spireFloorToStageRange(node.floor)
        : classicFloorToStageRange(act, node.floor)
      let pool = poolCache.get(bracket) ?? []
      if (bracket && !poolCache.has(bracket)) {
        pool = await getApprovedEliteDesigns(act, bracket)
        poolCache.set(bracket, pool)
      }
      const fresh = pool.filter(
        (candidate) => !usedEliteDesignIds.has(candidate.id)
      )
      const candidates = fresh.length > 0 ? fresh : pool
      const picked =
        candidates.length > 0
          ? candidates[
              Math.floor(this.state.nextRunRandom() * candidates.length)
            ]
          : null
      const data = picked ? designToSpireEliteData(picked) : null
      if (!data) {
        node.nodeType = MapNodeType.WILD_BATTLE
        node.eliteEncounterIndex = -1
        node.displayName = ""
        node.eliteAvatar = ""
        node.region =
          allDungeons[
            Math.floor(this.state.nextRunRandom() * allDungeons.length)
          ]
        assignmentsChanged = true
        continue
      }
      usedEliteDesignIds.add(data.designId)
      this.spireEliteDesigns.set(id, data)
      this.state.eliteDesignAssignments.set(id, data)
      assignmentsChanged = true
      node.displayName = data.name
      node.eliteAvatar = PkmIndex[data.icon] ?? ""
    }

    const bossNodes: { id: string; node: MapNode }[] = []
    this.state.mapNodes.forEach((node, id) => {
      if (node.nodeType === MapNodeType.LEGENDARY_BOSS) {
        bossNodes.push({ id, node })
      }
    })
    const bossPool =
      bossNodes.length > 0 ? await getApprovedBossDesigns(act) : []
    const usedBossDesignIds = new Set<string>()
    for (const { id, node } of bossNodes) {
      const restored = this.state.eliteDesignAssignments.get(id)
      if (restored?.kind === "boss") {
        usedBossDesignIds.add(restored.designId)
        this.spireEliteDesigns.set(id, restored)
        node.displayName = restored.name
        node.bossSprites = restored.encounter.board
          .map(([pokemon]) => PkmIndex[pokemon] ?? "")
          .join(",")
        continue
      }
      const fresh = bossPool.filter(
        (candidate) => !usedBossDesignIds.has(candidate.id)
      )
      const candidates = fresh.length > 0 ? fresh : bossPool
      const picked =
        candidates.length > 0
          ? candidates[
              Math.floor(this.state.nextRunRandom() * candidates.length)
            ]
          : null
      const data = picked ? designToSpireEliteData(picked) : null
      if (!data) continue
      usedBossDesignIds.add(data.designId)
      this.spireEliteDesigns.set(id, data)
      this.state.eliteDesignAssignments.set(id, data)
      assignmentsChanged = true
      node.displayName = data.name
      node.bossSprites = data.encounter.board
        .map(([pokemon]) => PkmIndex[pokemon] ?? "")
        .join(",")
    }

    logger.info(
      `Library fights populated (act ${act}): ${eliteNodes.length} elite nodes, ` +
        `${bossNodes.length} boss nodes, ${this.spireEliteDesigns.size} assignments`
    )
    if (assignmentsChanged) this.autoSaveRun()
  }

  startGame() {
    if (this.state.gameLoaded) return // already started
    this.state.gameLoaded = true
    // Fresh identity for this run so the save fence treats it as distinct from any
    // prior run in this account's save slot (lets a new run overwrite an old save).
    this.state.runId = crypto.randomUUID()
    this.state.initializeRunRng()
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
    const {
      generateActMap,
      generateTutorialMap
    } = require("../core/map-generator")
    const { PlayerChoice } = require("../models/colyseus-models/player-choice")
    const { Starters } = require("../types/enum/Starters")
    const { pickNRandomIn } = require("../utils/random")
    const {
      PRECOMPUTED_POKEMONS_PER_RARITY
    } = require("../models/precomputed/precomputed-rarity")

    const { randomBetween: randBetween } = require("../utils/random")
    const { BOARD_WIDTH, BOARD_HEIGHT } = require("../config")
    this.state.withRunRng(() => {
      this.state.lightX = randBetween(0, BOARD_WIDTH - 1)
      this.state.lightY = randBetween(1, BOARD_HEIGHT / 2)
    })

    this.state.phase = GamePhaseState.MAP
    this.state.time = 999 * 1000
    this.state.roundTime = 999
    if (this.state.isTutorial) {
      generateTutorialMap(this.state.mapNodes, this.state.mapEdges)
    } else {
      this.state.withRunRng(() => {
        generateActMap(
          this.state.currentAct,
          this.state.mapNodes,
          this.state.mapEdges,
          this.state.difficultyMode as 0 | 1 | 2 | 3,
          this.state.isEndless,
          this.state.isSpire
        )
      })
    }
    logger.info(
      `Map generated: ${this.state.mapNodes.size} nodes, ${this.state.mapEdges.length} edges`
    )
    if (this.state.isEndless) this.populateAsyncFightNodes()
    this.populateEliteDesignNodes()

    this.state.players.forEach((player: Player) => {
      player.lightX = this.state.lightX
      player.lightY = this.state.lightY
      if (this.state.isEndless) {
        const { ENDLESS_MAX_LEVEL } = require("../config")
        player.experienceManager.maxLevel = ENDLESS_MAX_LEVEL
      }
      if (this.state.isSpire) {
        // Spire: own level-up curve, starting fresh at level 1.
        // biome-ignore lint/correctness/useHookAtTopLevel: This is an experience-manager method, not a React hook.
        player.experienceManager.useSpireMode()
      }
      if (!player.isBot) {
        if (!this.state.isTutorial) {
          const { incrementRunStarted } = require("../services/run-save")
          incrementRunStarted(player.id, this.state.difficultyMode)
        }
        // Spire mode: grant the chosen class's starting relic.
        if (this.state.isSpire && this.state.spireClass) {
          const { SPIRE_CLASSES } = require("../core/spire-classes")
          const cls = SPIRE_CLASSES[this.state.spireClass]
          if (cls?.startingRelic) {
            this.grantRelic(player, cls.startingRelic)
          }
        }
        const UserMetadata =
          require("../models/mongo-models/user-metadata").default
        UserMetadata.findOne({ uid: player.id }, { spireRegion: 1 })
          .lean()
          .then((u: any) => {
            const region = u?.spireRegion || "town"
            this.state.playerSpireRegion = region
            if (region !== "town") player.map = region
          })
          .catch(() => {})
        const { pickRandomIn: pickRandom } = require("../utils/random")
        const { ItemComponentsNoFossilOrScarf } = require("../types/enum/Item")
        const {
          getPokemonData
        } = require("../models/precomputed/precomputed-pokemon-data")
        const isImpossible = this.state.difficultyMode === 3
        let allOneStars = (
          isImpossible
            ? [...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON]
            : [
                ...PRECOMPUTED_POKEMONS_PER_RARITY.COMMON,
                ...PRECOMPUTED_POKEMONS_PER_RARITY.UNCOMMON,
                ...PRECOMPUTED_POKEMONS_PER_RARITY.RARE,
                ...PRECOMPUTED_POKEMONS_PER_RARITY.EPIC
              ]
        ).filter((p: Pkm) => getPokemonData(p).stars === 1)
        // Spire mode: starter offers are drawn from the chosen class's synergies.
        if (this.state.isSpire && this.state.spireClass) {
          const { SPIRE_CLASSES } = require("../core/spire-classes")
          const classSynergies: string[] =
            SPIRE_CLASSES[this.state.spireClass]?.synergies ?? []
          if (classSynergies.length > 0) {
            const inClass = allOneStars.filter((p: Pkm) =>
              getPokemonData(p).types.some((t: string) =>
                classSynergies.includes(t)
              )
            )
            if (inClass.length >= 5) allOneStars = inClass
          }
        }
        const starterOptions = this.state.withRunRng(() =>
          pickNRandomIn(allOneStars, 5)
        )
        const starterItems = isImpossible
          ? []
          : this.state.withRunRng(() =>
              starterOptions.map(() =>
                pickRandom(ItemComponentsNoFossilOrScarf)
              )
            )
        player.choices.push(
          new PlayerChoice({
            type: "starter",
            pokemons: starterOptions,
            items: starterItems
          })
        )
      }
    })

    // Tutorial: the welcome + map-intro prompts are fired client-side (when the
    // starter picker / map actually appear) so they're perfectly timed and block
    // before the player can act. See game.tsx.
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

    const {
      loadRun,
      restoreRunToState,
      flushSaves
    } = require("../services/run-save")

    const player = schemaValues(this.state.players).find(
      (p: Player) => !p.isBot
    )
    if (!player) {
      logger.error(
        "resumeGame: no human player found, falling back to new game"
      )
      this.startGame()
      return
    }

    // Drain any in-flight saves for this player first so we read the freshest run,
    // not a doc one save behind (the "resume rewound a floor" race).
    await flushSaves(player.id)
    const savedRun = await loadRun(player.id)
    if (!savedRun?.data) {
      logger.error(
        "resumeGame: no saved run found for " +
          player.id +
          ", falling back to new game"
      )
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
    this.spireEliteRewardSource =
      this.state.pendingEncounter?.eliteDesign ?? null

    // Repopulate endless async-fight opponents BEFORE any node re-select below:
    // the pending-fight resume path regenerates the encounter via onSelectMapNode,
    // which reads asyncFightSnapshots for ASYNC_FIGHT nodes. Awaited so the DB
    // lookups land first.
    if (this.state.isEndless) await this.populateAsyncFightNodes()
    // Same for elite designs (all modes, acts 1-3): the stash isn't persisted,
    // so a resumed map's elite nodes need designs reassigned before any
    // pending-fight re-select.
    await this.populateEliteDesignNodes()

    const cmd = new OnUpdatePhaseCommand()
    cmd.setPayload({})
    cmd.room = this
    cmd.state = this.state
    cmd.clock = this.clock

    // One-shot finale guard: a run that already entered the Arceus act (classic act 5)
    // or STARTED a Champion fight cannot resume back into it. Re-entering would let
    // players save-scum the Arceus damage leaderboard (quit a bad roll, retry) or
    // retry the champion fight. NOTE: act 5 exists solely for the terminal Arceus
    // one-shot, and merely ENTERING it (ENTER_ACT_5 → initializeMapPhase) autosaves a
    // run BEFORE arceusChallenged is set at fight start — so the act itself, not just
    // arceusChallenged, is the commit point (without this, leaving from the Act-5 map
    // or the Arceus PICK screen left a resumable run and you could re-enter Arceus).
    // Endless is EXCLUDED: it increments currentAct unbounded (acts 5/6/7…) with no
    // Arceus, so those high-act runs are normal resumable progression, not a finale.
    // Finalized here as a forfeit — it still keeps its Act-3 victory (recorded by
    // runId, so no duplicate), just no second attempt at the finale.
    const enteredArceusAct = !this.state.isEndless && this.state.currentAct >= 5
    if (
      this.state.arceusChallenged ||
      this.state.championChallenged ||
      enteredArceusAct
    ) {
      logger.info(
        `Resume forfeit for ${player.name}: finale already entered (act=${this.state.currentAct}, champion=${this.state.championChallenged}, arceus=${this.state.arceusChallenged}) — finalizing run, no re-fight.`
      )
      this.state.gameFinished = true
      this.state.runFailed = true
      player.alive = false
      player.loadingProgress = 100
      cmd.recordRunEndOnce(player, {
        arceusDamage: this.state.arceusDamageDealt
      })
      return
    }

    // Recovery for runs stuck by the (since fixed) Elite Four entry bug:
    // entering act 4/5 used to carry unclaimed reward rows (the act-3 boss
    // gold) past REWARD, blocking every map node click with no rewards screen
    // left to resolve them. Claim-and-clear on resume unsticks those saves.
    // Endless is excluded (its acts 4+ are normal play with real reward
    // phases), as are REWARD-phase saves (resume re-enters that screen).
    if (
      !this.state.isEndless &&
      this.state.currentAct >= 4 &&
      this.state.phase !== GamePhaseState.REWARD
    ) {
      this.forfeitPendingChoices(player)
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
    let pendingNode = pendingNodeId
      ? this.state.mapNodes.get(pendingNodeId)
      : undefined

    // Legacy fallback: saves written before pendingFightNodeId existed can be
    // stranded on the floor-20 boss with no marker. That state is uniquely
    // identifiable — the boss is the only node with no successor, so when nothing
    // on the map is available and the current node is a visited combat node, the
    // player is hard-locked. Recover by re-entering that fight. (Endless strands
    // are handled separately by recoverIfEndlessStranded, which advances the act.)
    // runComplete excludes the act-3 victory-screen save (boss beaten, Elite Four
    // offered but not yet entered — kept alive by onDispose's bonusPending): that
    // map is legitimately exhausted, and resuming must land on the victory screen
    // with its Enter Elite Four button, NOT force a re-fight of the beaten boss.
    if (
      !pendingNode &&
      !this.state.isEndless &&
      !this.state.runComplete &&
      this.state.phase !== GamePhaseState.REWARD &&
      savedPhase !== GamePhaseState.SHOP &&
      savedPhase !== GamePhaseState.REST &&
      savedPhase !== GamePhaseState.EVENT
    ) {
      const { MapNodeType } = require("../models/colyseus-models/map-node")
      const COMBAT_NODE_TYPES = [
        MapNodeType.WILD_BATTLE,
        MapNodeType.GYM_LEADER,
        MapNodeType.ELITE,
        MapNodeType.UNLOCK,
        MapNodeType.LEGENDARY_BOSS,
        MapNodeType.ELITE_FOUR,
        MapNodeType.CHAMPION,
        MapNodeType.ARCEUS_BOSS,
        MapNodeType.ASYNC_FIGHT
      ]
      let anyAvailable = false
      this.state.mapNodes.forEach((n: any) => {
        if (n.available) anyAvailable = true
      })
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
        logger.info(
          `Recovered stranded run for ${player.name} — re-entering fight on a ${current.nodeType} node (Act ${this.state.currentAct}, Floor ${current.floor})`
        )
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

    logger.info(
      `Run resumed for ${player.name} (Act ${this.state.currentAct}, Floor ${this.state.currentFloor}${this.state.isEndless ? ", Endless" : ""})`
    )
  }

  async onAuth(client: Client, options, context) {
    if (options.idToken) {
      const token = await admin.auth().verifyIdToken(options.idToken)
      const user = await admin.auth().getUser(token.uid)
      const gameName = options.displayName || "Player"
      const UserMetadata =
        require("../models/mongo-models/user-metadata").default
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
        const name =
          this.state.players.get(client.auth.uid)?.name || client.auth.uid
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

    if (
      this.state.runComplete ||
      this.state.runFailed ||
      this.state.gameFinished
    ) {
      const reason = this.state.runComplete
        ? "won"
        : this.state.runFailed
          ? "dead"
          : "game finished"
      logger.info(`${name} left game | reason: ${reason} | ${location}`)
    } else {
      logger.info(`${name} disconnected (code: ${code}) | ${location}`)
    }
  }

  async onDispose() {
    const humanPlayer = Array.from(this.state.players.values()).find(
      (p) => !p.isBot
    )
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

    if (
      !this.runHistoryRecorded &&
      !bonusPending &&
      (this.state.runComplete || this.state.runFailed) &&
      humanPlayer
    ) {
      this.runHistoryRecorded = true
      const {
        deleteSavedRun,
        saveRunHistory,
        incrementRunEnd,
        updateVictoryRecord,
        isRunVictory
      } = require("../services/run-save")
      const won = isRunVictory(this.state)
      deleteSavedRun(humanPlayer.id)
      await saveRunHistory(humanPlayer.id, this.state, humanPlayer, won)
      // Win + victory were counted at the act-3 boss; here we only add the champion
      // stat (once) and Arceus damage, and record a loss for runs that never won.
      await incrementRunEnd(
        humanPlayer.id,
        this.state.difficultyMode,
        false,
        this.becameChampion,
        this.state.arceusDamageDealt
      )
      if (!won) {
        await updateVictoryRecord(
          humanPlayer.id,
          humanPlayer.name,
          humanPlayer.avatar,
          this.state.difficultyMode,
          false,
          this.state.isEndless
        )
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

  // Tutorial: broadcast the ordered dialog-step i18n keys for a scripted trigger.
  // The client (tutorial-dialog.tsx) queues and shows them one at a time. No-op
  // outside tutorial runs so callers don't have to guard every site.
  sendTutorialDialog(trigger: string) {
    if (!this.state.isTutorial) return
    const { getTutorialDialogSteps } = require("../models/tutorial")
    const steps: string[] = getTutorialDialogSteps(trigger)
    if (steps.length > 0) {
      this.broadcast(Transfer.TUTORIAL_DIALOG, { trigger, steps })
    }
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

  // Central relic-grant: pushes the relic (unique per run) and applies any
  // on-acquire side effects. Returns true if the relic was newly added.
  grantRelic(player: Player, relic: string, client?: Client): boolean {
    if (player.relics.includes(relic)) return false // relics are unique per run
    player.relics.push(relic)

    // Old Coin: gain 40 gold the moment the relic is acquired.
    if (relic === Relic.OldCoin) {
      player.addMoney(40, true, null)
      client?.send(Transfer.PLAYER_INCOME, 40)
    }
    // Matryoshka changes synergy counting — recompute now so the effect shows
    // immediately instead of waiting for the next board change.
    if (relic === Relic.Matryoshka) {
      player.updateSynergies()
    }
    return true
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

  // Claim any instant reward rows (gold / heal / XP / item grants) the player
  // left unclaimed, then forfeit everything else — same semantics as the
  // rewards screen's Skip button. A choice carried past the REWARD phase
  // hard-locks the run: the client blocks map node clicks while choices are
  // pending ("Select a reward first") but no rewards screen exists outside
  // REWARD to resolve them. Called by the act transitions (Enter Elite Four /
  // Challenge Arceus, where the act-3 boss / champion reward may still be
  // unclaimed when the button is pressed) and by the resume recovery for runs
  // already stuck this way.
  forfeitPendingChoices(player: Player) {
    if (player.choices.length === 0) return
    Array.from(player.choices).forEach((choice) => {
      if (choice.type === "gold") {
        player.addMoney(choice.value, true, null)
        const client = this.clients.find((cli) => cli.auth?.uid === player.id)
        client?.send(Transfer.PLAYER_INCOME, choice.value)
      } else if (choice.type === "heal") {
        player.addRunHP(choice.value)
      } else if (choice.type === "xp") {
        player.experienceManager.addExperience(choice.value)
      } else if (choice.type === "itemGrant") {
        const item = choice.items[0]
        if (item) player.items.push(item)
      }
    })
    player.choices.clear()
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
    if (!choice) return

    // STS-style instant reward rows (gold / heal / XP) carry no pokemons or
    // items — just a numeric value. Claim and remove them up front, before the
    // index validation below (which assumes a pokemons/items slot exists).
    if (
      choice.type === "gold" ||
      choice.type === "heal" ||
      choice.type === "xp" ||
      choice.type === "itemGrant"
    ) {
      if (choice.type === "gold") {
        player.addMoney(choice.value, true, null)
        const client = this.clients.find((cli) => cli.auth?.uid === player.id)
        client?.send(Transfer.PLAYER_INCOME, choice.value)
      } else if (choice.type === "heal") {
        player.addRunHP(choice.value)
      } else if (choice.type === "xp") {
        player.experienceManager.addExperience(choice.value)
      } else if (choice.type === "itemGrant") {
        const item = choice.items[0]
        if (item) player.items.push(item)
      }
      removeInArray(player.choices, choice)
      if (
        this.state.phase === GamePhaseState.REWARD &&
        player.choices.length === 0
      ) {
        this.state.updatePhaseNeeded = true
        this.state.time = 0
      }
      return
    }

    if (
      choiceIndex < 0 ||
      choiceIndex >= (choice.pokemons?.length || choice.items?.length)
    )
      return

    // Relic reward option (Spire): granting a relic consumes the whole choice.
    const relicReward = choice.relics?.[choiceIndex]
    if (relicReward) {
      this.grantRelic(player, relicReward)
      const idx = player.choices.indexOf(choice)
      if (idx >= 0) player.choices.splice(idx, 1)
      // Advance REWARD -> MAP when the last choice is resolved (this branch
      // returns early and would otherwise leave the player stuck in REWARD).
      if (
        this.state.phase === GamePhaseState.REWARD &&
        player.choices.length === 0
      ) {
        this.state.updatePhaseNeeded = true
        this.state.time = 0
      }
      return
    }

    if (choice.type === "unlockReward") {
      const pkm = choice.pokemons[choiceIndex]
      if (pkm && pkm !== Pkm.DEFAULT) {
        const freeSpace = getFreeSpaceOnBench(player.board)
        if (freeSpace < 1 && !bypassLackOfSpace) return false
        const data = getPokemonData(pkm as Pkm)
        if (data.rarity === Rarity.HATCH) {
          const egg = PokemonFactory.createPokemonFromName(
            Pkm.EGG,
            player
          ) as Egg
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
        choice.items.forEach((item) => {
          if (item) player.items.push(item)
        })
      }
      const idx = player.choices.indexOf(choice)
      if (idx >= 0) player.choices.splice(idx, 1)
      // Advance REWARD -> MAP when the last choice is resolved (this branch
      // returns early and would otherwise leave the player stuck in REWARD).
      if (
        this.state.phase === GamePhaseState.REWARD &&
        player.choices.length === 0
      ) {
        this.state.updatePhaseNeeded = true
        this.state.time = 0
      }
      return
    }

    if (
      choice.type === "wildReward" ||
      choice.type === "gymReward" ||
      choice.type === "eliteReward"
    ) {
      const pkm = choice.pokemons[choiceIndex]
      if (pkm && pkm !== Pkm.DEFAULT) {
        const freeSpace = getFreeSpaceOnBench(player.board)
        if (freeSpace < 1 && !bypassLackOfSpace) return false
        this.spawnOnBench(player, pkm as Pkm)
        // Approved-design elite rewards are atomic Pokémon + optional item
        // choices in every mode. Legacy/hardcoded elite rewards remain Pokémon-only.
        if (this.spireEliteRewardSource && choice.type === "eliteReward") {
          const pairedItem = choice.items[choiceIndex]
          if (pairedItem) {
            player.items.push(pairedItem)
            const pairedSynType = SynergyGivenByGem[pairedItem as SynergyGem]
            if (pairedSynType) {
              player.bonusSynergies.set(
                pairedSynType,
                (player.bonusSynergies.get(pairedSynType) ?? 0) + 1
              )
              player.updateSynergies()
            }
          }
        }
      } else {
        const item = choice.items[choiceIndex]
        if (item) {
          player.items.push(item)
          const synType = SynergyGivenByGem[item as SynergyGem]
          if (synType) {
            player.bonusSynergies.set(
              synType,
              (player.bonusSynergies.get(synType) ?? 0) + 1
            )
            player.updateSynergies()
          }
        }
      }
      const idx = player.choices.indexOf(choice)
      if (idx >= 0) player.choices.splice(idx, 1)
      // Advance REWARD -> MAP when the last choice is resolved (this branch
      // returns early and would otherwise leave the player stuck in REWARD).
      if (
        this.state.phase === GamePhaseState.REWARD &&
        player.choices.length === 0
      ) {
        this.state.updatePhaseNeeded = true
        this.state.time = 0
      }
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
      const pickedPkm =
        choice.pokemons.length > 0 ? choice.pokemons[choiceIndex] : undefined
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

    if (
      this.state.phase === GamePhaseState.REWARD &&
      player.choices.length === 0
    ) {
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
