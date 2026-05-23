import { Dispatcher } from "@colyseus/command"
import { MapSchema } from "@colyseus/schema"
import { Client, Room } from "colyseus"
import {
  MAX_LOADING_TIME,
  MAX_SIMULATION_DELTA_TIME
} from "../config"
import { CountEvolutionRule, ItemEvolutionRule } from "../core/evolution-rules"
import { MiniGame } from "../core/mini-game"
import { IGameUser } from "../models/colyseus-models/game-user"
import Player from "../models/colyseus-models/player"
import { Pokemon } from "../models/colyseus-models/pokemon"
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
import { GameMode, GamePhaseState, PokemonActionState, Rarity } from "../types/enum/Game"
import { Item, Wands } from "../types/enum/Item"
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
    bracketId
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
  }) {
    logger.info("Create Game ", this.roomId)
    logger.info("onCreate options:", JSON.stringify({ name, ownerName, gameMode, users: Object.keys(users || {}) }))

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
      this.startGame()
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
          this.startGame()
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
      if (!this.state.gameFinished && client.auth) {
        this.state.updatePhaseNeeded = true
        this.state.time = 0
      }
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
    generateActMap(this.state.currentAct, this.state.mapNodes, this.state.mapEdges)
    logger.info(`Map generated: ${this.state.mapNodes.size} nodes, ${this.state.mapEdges.length} edges`)

    this.state.players.forEach((player: Player) => {
      if (!player.isBot) {
        const firstStageStarters = [
          Pkm.BULBASAUR,
          Pkm.CHARMANDER,
          Pkm.SQUIRTLE,
          Pkm.CHIKORITA,
          Pkm.CYNDAQUIL,
          Pkm.TOTODILE,
          Pkm.TREECKO,
          Pkm.TORCHIC,
          Pkm.MUDKIP,
          Pkm.TURTWIG,
          Pkm.CHIMCHAR,
          Pkm.PIPLUP,
          Pkm.SHINX,
          Pkm.RIOLU,
          Pkm.EEVEE
        ]
        const starterOptions = pickNRandomIn(firstStageStarters, 3)
        player.choices.push(
          new PlayerChoice({
            type: "starter",
            pokemons: starterOptions
          })
        )

        this.spawnOnBench(player, Pkm.MEWTWO)
        this.spawnOnBench(player, Pkm.MEWTWO)
      }
    })
  }

  async onAuth(client: Client, options, context) {
    return {
      uid: options.odToken || "local-player",
      displayName: options.displayName || "Player"
    }
  }

  async onJoin(client: Client) {
    this.dispatcher.dispatch(new OnJoinCommand(), { client })
  }

  async onLeave(client: Client, code: number) {
    logger.info("Player left game")
  }

  async onDispose() {
    logger.info("Dispose Game ", this.roomId)
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
      const { isRelic } = require("../core/relic-effects")
      if (isRelic(item)) {
        logger.info(`Relic acquired: ${item}, total relics: ${player.relics.length + 1}`)
        player.relics.push(item)
      } else {
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
    let damage = Math.ceil(stageLevel / 2)
    if (opponentTeam.size > 0) {
      opponentTeam.forEach((pokemon) => {
        if (!pokemon.isSpawn && pokemon.passive !== Passive.INANIMATE) {
          damage += 1
        }
      })
    }
    return damage
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
