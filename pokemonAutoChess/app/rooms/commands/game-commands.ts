import { Command } from "@colyseus/command"
import { MapSchema, SetSchema, StateView } from "@colyseus/schema"
import { Client, updateLobby } from "colyseus"
import {
  AdditionalPicksStages,
  BOARD_SIDE_HEIGHT,
  BOARD_WIDTH,
  FIGHTING_PHASE_DURATION,
  GOLDEN_BERRY_TREE_TYPES,
  getAltFormForPlayer,
  ITEM_CAROUSEL_BASE_DURATION,
  ItemCarouselStages,
  ItemSellPricesAtTown,
  MAX_PLAYERS_PER_GAME,
  OUTLAW_GOLD_REWARD,
  PkmsWithAltForms,
  PORTAL_CAROUSEL_BASE_DURATION,
  PortalCarouselStages,
  SHARDS_PER_SHINY_UNOWN_WANDERER,
  SHARDS_PER_UNOWN_WANDERER,
  SHINY_UNOWN_ENCOUNTER_CHANCE,
  StageDuration,
  SynergyTriggers,
  TREASURE_BOX_LIFE_THRESHOLD,
  UNOWN_ENCOUNTER_CHANCE
} from "../../config"
import { castAbility } from "../../core/abilities/abilities"
import {
  OnItemDroppedEffect,
  OnStageStartEffect
} from "../../core/effects/effect"
import { DishByPkm } from "../../core/dishes"
import { ItemEffects } from "../../core/effects/items"
import { PassiveEffects } from "../../core/effects/passives"
import { giveRandomEgg } from "../../core/eggs"
import {
  ConditionBasedEvolutionRule,
  CountEvolutionRule,
  HatchEvolutionRule
} from "../../core/evolution-rules"
import { getFlowerPotsUnlocked } from "../../core/flower-pots"
import { generateActMap, markAvailableNodes } from "../../core/map-generator"
import { selectMatchups } from "../../core/matchmaking"
import { canSell, getUnitScore, PokemonEntity } from "../../core/pokemon-entity"
import Simulation from "../../core/simulation"
import { MapNodeType } from "../../models/colyseus-models/map-node"
import {
  calculateEncounterStats,
  generateWildRewardPokemon,
  getArceusEncounter,
  getEliteEncounter,
  getEliteEncounterPokemon,
  getEliteEncounterType,
  getGoldReward,
  generateGymEncounter,
  getGymLeaderBaseFormPokemon,
  getGymLeaderGem,
  getLegendaryBossEncounter,
  getLegendaryBossEncounterByName,
  getRegionalWildEncounter,
  getUnlockEncounter,
  getUnlockEncounterPokemon,
  getUnlockEncounterType,
  getWildEncounter,
  SpireEncounter
} from "../../models/spire-encounters"
import { loadChampionData, saveChampionData, promoteNewChampion, getChampionSlotForEncounter, getEliteFourSlotForEncounter, DEFAULT_SNAPSHOT, type DifficultyMode } from "../../services/champion-data"
import { discordService } from "../../services/discord"
import { snapshotPlayerTeam, reconstructTeamAsPlayer, encodeSnapshotForClient } from "../../services/team-snapshot"
import { getEventBerries, getEventItems, getRandomEvent } from "../../models/spire-events"
import { generateShopItems } from "../../models/spire-shops"
import {
  getPassiveItemBonusGold,
  getPassiveItemBonusXP,
  getPassiveItemDamageReduction,
  getPassiveItemPokemonOfferCount,
  getPassiveItemPostBattleHeal
} from "../../core/relic-effects"
import Player from "../../models/colyseus-models/player"
import { PlayerChoice } from "../../models/colyseus-models/player-choice"
import { Pokemon, PokemonClasses } from "../../models/colyseus-models/pokemon"
import Synergies, { computeSynergies, getSynergyStep } from "../../models/colyseus-models/synergies"
import { Effects } from "../../models/effects"
import PokemonFactory, {
  getPokemonBaseline
} from "../../models/pokemon-factory"
import { getPokemonData } from "../../models/precomputed/precomputed-pokemon-data"
import { PRECOMPUTED_POKEMONS_PER_TYPE } from "../../models/precomputed/precomputed-types"
import { PVEStages } from "../../models/pve-stages"
import { getBuyPrice, getSellPrice } from "../../models/shop"
import { updatePlayerTitlesAfterFight } from "../../models/titles"
import {
  Emotion,
  IClient,
  IDragDropCombineMessage,
  IDragDropItemMessage,
  IDragDropMessage,
  Role,
  Title,
  TMPerAbility,
  Transfer
} from "../../types"
import { Ability } from "../../types/enum/Ability"
import { DungeonPMDO } from "../../types/enum/Dungeon"
import { EffectEnum } from "../../types/enum/Effect"
import {
  BattleResult,
  GamePhaseState,
  PokemonActionState,
  Team
} from "../../types/enum/Game"
import {
  ConsumableItems,
  CraftableItemsNoScarves,
  CraftableNoStonesOrScarves,
  Dishes,
  DishesGoingToInventory,
  HerbaMysticas,
  Item,
  ItemComponents,
  ItemComponentsNoFossilOrScarf,
  ItemComponentsNoScarf,
  ItemRecipe,
  ItemsSoldAtTown,
  Mulches,
  NonSpecialBerries,
  Scarves,
  Sweets,
  SynergyGem,
  SynergyGems,
  SynergyGivenByGem,
  SynergyGivenByItem,
  ShinyItems,
  SynergyStones,
  Tools,
  UnholdableItems
} from "../../types/enum/Item"
import { Passive } from "../../types/enum/Passive"
import {
  Pkm,
  PkmIndex,
  PkmRegionalVariants,
  Unowns,
  UnownsForScribble
} from "../../types/enum/Pokemon"
import { SpecialGameRule } from "../../types/enum/SpecialGameRule"
import { Synergy } from "../../types/enum/Synergy"
import { TownEncounters } from "../../types/enum/TownEncounter"
import { WandererBehavior, WandererType } from "../../types/enum/Wanderer"
import type { IDetailledPokemon } from "../../types/models/bot-v2"
import { DisplayText } from "../../types/strings/DisplayText"
import { isIn, removeInArray } from "../../utils/array"
import { getAvatarString } from "../../utils/avatar"
import {
  getFirstAvailablePositionInBench,
  getFirstAvailablePositionOnBoard,
  getFreeSpaceOnBench,
  getMaxTeamSize,
  isOnBench,
  isPositionEmpty
} from "../../utils/board"
import { distanceC } from "../../utils/distance"
import { repeat } from "../../utils/function"
import { logger } from "../../utils/logger"
import { max } from "../../utils/number"
import {
  chance,
  pickNRandomIn,
  pickRandomIn,
  randomBetween,
  randomWeighted
} from "../../utils/random"
import { resetArraySchema, schemaValues } from "../../utils/schemas"
import { getWeather } from "../../utils/weather"
import GameRoom from "../game-room"
import GameState from "../states/game-state"

export class OnBuyPokemonCommand extends Command<
  GameRoom,
  {
    playerId: string
    index: number
  }
> {
  execute({ playerId, index }) {
    if (
      playerId === undefined ||
      index === undefined ||
      !this.state.players.has(playerId)
    )
      return
    const player = this.state.players.get(playerId)
    const name = player?.shop[index]
    if (!player || !player.alive || !name || name === Pkm.DEFAULT) return

    const pokemon = PokemonFactory.createPokemonFromName(name, player)
    const isEvolution =
      pokemon.evolutionRule &&
      pokemon.evolutionRule instanceof CountEvolutionRule &&
      pokemon.evolutionRule.canEvolveIfGettingOne(pokemon, player)

    const cost = getBuyPrice(name, this.state.specialGameRule)
    const freeSpaceOnBench = getFreeSpaceOnBench(player.board)
    const hasSpaceOnBench = freeSpaceOnBench > 0 || isEvolution

    const canBuy = player.money >= cost && hasSpaceOnBench
    if (!canBuy) return

    player.money -= cost

    const x = getFirstAvailablePositionInBench(player.board)
    pokemon.positionX = x !== null ? x : -1
    pokemon.positionY = 0
    player.board.set(pokemon.id, pokemon)
    pokemon.onAcquired(player)

    if (
      pokemon.passive === Passive.UNOWN &&
      (player.effects.has(EffectEnum.TRANSCENDENCE) ||
        player.shopsSinceLastUnownShop === 0) &&
      player.shopFreeRolls > 0 &&
      player.shop.every((p) => Unowns.includes(p) || p === Pkm.DEFAULT)
    ) {
      // reset shop after picking in a unown shop
      this.state.shop.assignShop(player, true, this.state)
      player.shopFreeRolls -= 1
    } else {
      player.shop[index] = Pkm.DEFAULT
    }

    this.room.checkEvolutionsAfterPokemonAcquired(playerId)
  }
}

export class OnRemoveFromShopCommand extends Command<
  GameRoom,
  {
    playerId: string
    index: number
  }
> {
  execute({ playerId, index }) {
    if (
      playerId === undefined ||
      index === undefined ||
      !this.state.players.has(playerId)
    )
      return
    const player = this.state.players.get(playerId)
    const name = player?.shop[index]
    if (!player || !player.alive || !name || name === Pkm.DEFAULT) return

    const cost = getBuyPrice(name, this.state.specialGameRule)
    if (player.money >= cost) {
      player.shop[index] = Pkm.DEFAULT
      player.shopLocked = true
      this.state.shop.releasePokemon(name, player, this.state)
    }
  }
}

export class OnPokemonCatchCommand extends Command<
  GameRoom,
  {
    client: Client
    playerId: string
    id: string
  }
> {
  async execute({ client, playerId, id }) {
    if (playerId === undefined || !this.state.players.has(playerId)) return
    const player = this.state.players.get(playerId)
    const wanderer = player?.wanderers.get(id)

    if (!player || !player.alive || !wanderer) return
    player.wanderers.delete(id)

    if (wanderer.type === WandererType.UNOWN) {
      // no-op: MongoDB persistence removed for single-player
    } else if (wanderer.type === WandererType.CATCHABLE) {
      const pokemon = PokemonFactory.createPokemonFromName(wanderer.pkm, player)
      const freeSpaceOnBench = getFreeSpaceOnBench(player.board)
      const hasSpaceOnBench =
        freeSpaceOnBench > 0 ||
        (pokemon.evolutionRule &&
          pokemon.evolutionRule instanceof CountEvolutionRule &&
          pokemon.evolutionRule.canEvolveIfGettingOne(pokemon, player))

      if (hasSpaceOnBench) {
        const x = getFirstAvailablePositionInBench(player.board)
        pokemon.positionX = x !== null ? x : -1
        pokemon.positionY = 0
        player.board.set(pokemon.id, pokemon)
        pokemon.onAcquired(player)
        this.room.checkEvolutionsAfterPokemonAcquired(playerId)
      }
    } else if (wanderer.type === WandererType.OUTLAW) {
      player.addMoney(OUTLAW_GOLD_REWARD, true, null)
      removeInArray(player.items, Item.WANTED_NOTICE)
    }
  }
}

export class OnDragDropPokemonCommand extends Command<
  GameRoom,
  {
    client: IClient
    detail: IDragDropMessage
  }
> {
  execute({ client, detail }) {
    const commands = []
    let success = false
    let dittoReplaced = false
    const message = {
      updateBoard: true,
      updateItems: true
    }
    const playerId = client.auth.uid
    const player = this.state.players.get(playerId)

    if (player && player.alive) {
      message.updateItems = false
      const pokemon = player.board.get(detail.id)
      const { x, y } = detail

      if (
        pokemon &&
        x != null &&
        x >= 0 &&
        x < BOARD_WIDTH &&
        y != null &&
        y >= 0 &&
        y < BOARD_SIDE_HEIGHT
      ) {
        const dropOnBench = y == 0
        const dropFromBench = isOnBench(pokemon)

        if (
          pokemon.name === Pkm.DITTO &&
          dropFromBench &&
          !isPositionEmpty(x, y, player.board) &&
          !(this.state.phase === GamePhaseState.FIGHT && y > 0)
        ) {
          const pokemonToClone = player.getPokemonAt(x, y)
          if (pokemonToClone && pokemonToClone.canBeCloned) {
            dittoReplaced = true
            player.gameStats.dittosUsed += 1
            let pkm = getPokemonBaseline(pokemonToClone.name)
            if (PkmsWithAltForms.includes(pkm)) {
              pkm = getAltFormForPlayer(pkm, player)
            }
            const replaceDitto = PokemonFactory.createPokemonFromName(
              pkm,
              player
            )
            replaceDitto.onAcquired(player)
            pokemon.items.forEach((item) => {
              player.items.push(item)
            })
            player.board.delete(detail.id)
            const position = getFirstAvailablePositionInBench(player.board)
            if (position !== null) {
              replaceDitto.positionX = position
              replaceDitto.positionY = 0
              player.board.set(replaceDitto.id, replaceDitto)
              success = true
              message.updateBoard = false
            }
          } else if (dropOnBench) {
            this.swapPokemonPositions(player, pokemon, x, y)
            success = true
          }
        } else if (
          pokemon.name === Pkm.MELTAN &&
          player.getPokemonAt(x, y)?.name === Pkm.MELMETAL
        ) {
          // Meltan can merge with Melmetal
          const melmetal = player.getPokemonAt(x, y)!
          melmetal.addMaxHP(50)
          pokemon.items.forEach((item) => {
            player.items.push(item)
          })
          player.board.delete(pokemon.id)
          success = true
        } else if (dropOnBench && dropFromBench) {
          // Drag and drop pokemons through bench has no limitation
          this.swapPokemonPositions(player, pokemon, x, y)
          success = true
        } else if (this.state.phase == GamePhaseState.PICK || this.state.phase == GamePhaseState.MAP || this.state.phase == GamePhaseState.REWARD) {
          // On pick, map, or reward, allow to drop on / from board
          const teamSize = this.room.getTeamSize(player.board)
          const isBoardFull =
            teamSize >=
            getMaxTeamSize(
              player.experienceManager.level,
              this.room.state.specialGameRule
            )
          const dropToEmptyPlace = isPositionEmpty(x, y, player.board)
          const target = player.getPokemonAt(x, y)

          if (dropOnBench) {
            if (
              pokemon.canBeBenched &&
              (!target || target.canBePlaced) &&
              !(
                isBoardFull &&
                target &&
                pokemon?.doesCountForTeamSize === false
              )
            ) {
              // From board to bench (bench to bench is already handled)
              this.swapPokemonPositions(player, pokemon, x, y)
              success = true
            }
          } else if (
            pokemon.canBePlaced &&
            (!target || target.canBeBenched) &&
            !(
              dropFromBench &&
              dropToEmptyPlace &&
              isBoardFull &&
              pokemon.doesCountForTeamSize
            ) &&
            !(
              dropFromBench &&
              isBoardFull &&
              target?.doesCountForTeamSize === false
            )
          ) {
            // Prevents a pokemon to go on the board only if it's adding a pokemon from the bench on a full board
            this.swapPokemonPositions(player, pokemon, x, y)
            success = true
          }
        }
      }

      if (!success && client.send) {
        client.send(Transfer.DRAG_DROP_CANCEL, message)
      }
      if (dittoReplaced) {
        this.room.checkEvolutionsAfterPokemonAcquired(playerId)
      }

      if (success) {
        player.updateSynergies()
        player.boardSize = this.room.getTeamSize(player.board)
      }
    }
    if (commands.length > 0) {
      return commands
    }
  }

  swapPokemonPositions(player: Player, pokemon: Pokemon, x: number, y: number) {
    const pokemonToSwap = player.getPokemonAt(x, y)
    if (pokemonToSwap) {
      pokemonToSwap.positionX = pokemon.positionX
      pokemonToSwap.positionY = pokemon.positionY
      changePokemonPosition(
        pokemonToSwap,
        pokemon.positionX,
        pokemon.positionY,
        player,
        this.state
      )
    }
    pokemon.positionX = x
    pokemon.positionY = y
    changePokemonPosition(pokemon, x, y, player, this.state)
  }
}

export class OnSwitchBenchAndBoardCommand extends Command<
  GameRoom,
  {
    client: Client
    pokemonId: string
  }
> {
  execute({ client, pokemonId }) {
    const playerId = client.auth.uid
    const player = this.room.state.players.get(playerId)
    if (!player || !player.alive) return

    const pokemon = player.board.get(pokemonId)
    if (!pokemon) return

    if (this.state.phase !== GamePhaseState.PICK) return // can't switch pokemons if not in pick phase

    if (pokemon.positionY === 0) {
      // pokemon is on bench, switch to board
      const teamSize = this.room.getTeamSize(player.board)
      const isBoardFull =
        teamSize >=
        getMaxTeamSize(
          player.experienceManager.level,
          this.room.state.specialGameRule
        )
      const destination = getFirstAvailablePositionOnBoard(
        player.board,
        pokemon.range
      )
      if (
        pokemon.canBePlaced &&
        destination &&
        !(isBoardFull && pokemon.doesCountForTeamSize)
      ) {
        const [x, y] = destination
        pokemon.positionX = x
        pokemon.positionY = y
        pokemon.onChangePosition(x, y, player, this.state)
      }
    } else {
      // pokemon is on board, switch to bench
      const x = getFirstAvailablePositionInBench(player.board)
      if (x !== null) {
        pokemon.positionX = x
        pokemon.positionY = 0
        pokemon.onChangePosition(x, 0, player, this.state)
      }
    }

    player.updateSynergies()
    player.boardSize = this.room.getTeamSize(player.board)
  }
}

export class OnDragDropCombineCommand extends Command<
  GameRoom,
  {
    client: Client
    detail: IDragDropCombineMessage
  }
> {
  execute({ client, detail }) {
    const playerId = client.auth.uid
    const message = {
      updateBoard: true,
      updateItems: true
    }
    const player = this.state.players.get(playerId)

    if (!player || !player.alive) return

    message.updateBoard = false
    message.updateItems = true

    const itemA = detail.itemA
    const itemB = detail.itemB

    //verify player has both items
    if (!player.items.includes(itemA) || !player.items.includes(itemB)) {
      client.send(Transfer.DRAG_DROP_CANCEL, message)
      return
    }
    // check for two if both items are same
    else if (itemA == itemB) {
      let count = 0
      player.items.forEach((item) => {
        if (item == itemA) {
          count++
        }
      })

      if (count < 2) {
        client.send(Transfer.DRAG_DROP_CANCEL, message)
        return
      }
    }

    let result: Item | undefined = undefined

    if (itemA === Item.EXCHANGE_TICKET || itemB === Item.EXCHANGE_TICKET) {
      const exchangedItem = itemA === Item.EXCHANGE_TICKET ? itemB : itemA
      if (ItemComponentsNoScarf.includes(exchangedItem)) {
        result = pickRandomIn(
          ItemComponentsNoFossilOrScarf.filter((i) => i !== exchangedItem)
        )
      } else if (SynergyStones.includes(exchangedItem)) {
        result = pickRandomIn(SynergyStones.filter((i) => i !== exchangedItem))
      } else if (CraftableItemsNoScarves.includes(exchangedItem)) {
        result = pickRandomIn(
          CraftableNoStonesOrScarves.filter((i) => i !== exchangedItem)
        )
      } else {
        client.send(Transfer.DRAG_DROP_CANCEL, message)
        return
      }
    } else if (itemA === Item.RECYCLE_TICKET || itemB === Item.RECYCLE_TICKET) {
      const recycledItem = itemA === Item.RECYCLE_TICKET ? itemB : itemA
      const recipe = ItemRecipe[recycledItem]
      if (!recipe) {
        client.send(Transfer.DRAG_DROP_CANCEL, message)
        return
      }
      if (Scarves.includes(recycledItem)) {
        removeInArray(player.scarvesItems, recycledItem)
      }
      removeInArray(player.items, itemA)
      removeInArray(player.items, itemB)
      player.items.push(recipe[0])
      player.items.push(recipe[1])
      player.updateSynergies()
      return
    } else {
      // find recipe result
      const recipes = Object.entries(ItemRecipe) as [Item, Item[]][]
      for (const [key, value] of recipes) {
        if (
          (value[0] == itemA && value[1] == itemB) ||
          (value[0] == itemB && value[1] == itemA)
        ) {
          result = key
          break
        }
      }
    }

    if (!result) {
      client.send(Transfer.DRAG_DROP_CANCEL, message)
      return
    } else {
      if (itemA === Item.SILK_SCARF || itemB === Item.SILK_SCARF) {
        const nbScarvesBasedOnNormalSynergy = getSynergyStep(
          player.synergies,
          Synergy.NORMAL
        )
        if (player.scarvesItems.length < nbScarvesBasedOnNormalSynergy) {
          player.scarvesItems.push(result)
        }
      }

      player.items.push(result)
      removeInArray(player.items, itemA)
      removeInArray(player.items, itemB)
    }

    player.updateSynergies()
  }
}

export class OnDragDropItemCommand extends Command<
  GameRoom,
  {
    client: Client
    detail: IDragDropItemMessage
  }
> {
  execute({
    client,
    detail
  }: {
    client: Client
    detail: IDragDropItemMessage
  }) {
    const playerId = client.auth.uid
    const message = {
      updateBoard: true,
      updateItems: true
    }
    const player = this.state.players.get(playerId)
    if (!player || !player.alive) return

    message.updateBoard = false
    message.updateItems = true

    const { zone, index, id: item } = detail

    if (!player.items.includes(item)) {
      client.send(Transfer.DRAG_DROP_CANCEL, message)
      return
    }

    let pokemon: Pokemon | undefined
    if (zone === "flower-pot-zone") {
      const nbPots = getFlowerPotsUnlocked(player).length
      if (index >= nbPots) {
        // has not unlocked that flower pot yet
        client.send(Transfer.DRAG_DROP_CANCEL, message)
        return
      }
      pokemon = player.flowerPots[index]
      if (!pokemon || isIn(Mulches, item) === false) {
        client.send(Transfer.DRAG_DROP_CANCEL, message)
        return
      }
      if (item === Item.RICH_MULCH) {
        if (pokemon.evolution === Pkm.DEFAULT) {
          client.send(Transfer.DRAG_DROP_CANCEL, {
            ...message,
            text: "fully_grown" satisfies DisplayText,
            pokemonId: pokemon.id
          })
          return
        }
        const potEvolution = PokemonFactory.createPokemonFromName(
          pokemon.evolution,
          player
        )
        potEvolution.action = PokemonActionState.SLEEP
        player.flowerPots[index] = potEvolution
        removeInArray(player.items, item)
        client.send(Transfer.DRAG_DROP_CANCEL, message)
        return
      }
    } else if (zone === "berry-tree-zone") {
      const grassLevel = player.synergies.get(Synergy.GRASS) ?? 0
      const nbTrees = SynergyTriggers[Synergy.GRASS].filter(
        (n) => n <= grassLevel
      ).length

      if (item === Item.RICH_MULCH && index < nbTrees) {
        player.berryTreesStages[index] = 3
        removeInArray(player.items, item)
      } else if (item === Item.AMAZE_MULCH && index < nbTrees) {
        player.berryTreesType[index] = pickRandomIn(
          GOLDEN_BERRY_TREE_TYPES.filter(
            (b) => player.berryTreesType.includes(b) === false
          )
        )
        player.berryTreesStages[index] = 3
        removeInArray(player.items, item)
      }
      client.send(Transfer.DRAG_DROP_CANCEL, message)
      return
    } else {
      const x = index % BOARD_WIDTH
      const y = Math.floor(index / BOARD_WIDTH)
      pokemon = player.getPokemonAt(x, y)
    }

    if (!pokemon) {
      client.send(Transfer.DRAG_DROP_CANCEL, message)
      return
    }

    const onItemDroppedEffects: OnItemDroppedEffect[] = [
      ...(ItemEffects[item]?.filter(
        (effect) => effect instanceof OnItemDroppedEffect
      ) ?? []),
      ...(PassiveEffects[pokemon.passive]?.filter(
        (effect) => effect instanceof OnItemDroppedEffect
      ) ?? [])
    ]
    for (const onItemDroppedEffect of onItemDroppedEffects) {
      const shouldEquipItem = onItemDroppedEffect.apply({
        pokemon,
        player,
        item,
        room: this.room
      })
      if (shouldEquipItem === false) {
        client.send(Transfer.DRAG_DROP_CANCEL, message)
        return
      }
    }

    if (isIn(Dishes, item)) {
      if (pokemon.canEat && !pokemon.dishes.has(item)) {
        pokemon.dishes.add(item)
        pokemon.action = PokemonActionState.EAT
        removeInArray(player.items, item)
        client.send(Transfer.DRAG_DROP_CANCEL, message)
        pokemon.items.add(item) // add the item just in time for the evolution
        const pokemonEvolved = this.room.checkEvolutionsAfterItemAcquired(
          playerId,
          pokemon
        )
        if (pokemonEvolved) pokemonEvolved.items.delete(item)
        else pokemon.items.delete(item)
        return
      } else {
        client.send(Transfer.DRAG_DROP_CANCEL, {
          ...message,
          text: (pokemon.dishes.size > 0
            ? "belly_full"
            : "not_hungry") satisfies DisplayText,
          pokemonId: pokemon.id
        })
        return
      }
    }

    if (UnholdableItems.includes(item) && !ConsumableItems.includes(item)) {
      // Unholdable and non-consummable items should have zero interaction on any Pokémon
      client.send(Transfer.DRAG_DROP_CANCEL, message)
      return
    }

    if (
      pokemon.canHoldItems === false &&
      !(UnholdableItems.includes(item) && isIn(ConsumableItems, item)) // unholdable consumable items like dishes or dojo tickets can still be used on pokemon that can't hold items, since they are consumed right away and don't actually get held by the pokemon
    ) {
      client.send(Transfer.DRAG_DROP_CANCEL, message)
      return
    }

    const isBasicItem = ItemComponents.includes(item)
    const existingBasicItemToCombine = schemaValues(pokemon.items).find((i) =>
      ItemComponents.includes(i)
    )

    // check if full items and nothing to combine
    if (
      pokemon.items.size >= 3 &&
      !(isBasicItem && existingBasicItemToCombine) &&
      UnholdableItems.includes(item) === false
    ) {
      client.send(Transfer.DRAG_DROP_CANCEL, {
        ...message,
        text: "full" satisfies DisplayText,
        pokemonId: pokemon.id
      })
      return
    }

    if (!isBasicItem && pokemon.items.has(item)) {
      // prevent adding twice the same item
      client.send(Transfer.DRAG_DROP_CANCEL, {
        ...message,
        text: "already_held" satisfies DisplayText,
        pokemonId: pokemon.id
      })
      return
    }

    if (isBasicItem && existingBasicItemToCombine) {
      const recipe = Object.entries(ItemRecipe).find(
        ([_result, recipe]) =>
          (recipe[0] === existingBasicItemToCombine && recipe[1] === item) ||
          (recipe[0] === item && recipe[1] === existingBasicItemToCombine)
      )

      if (!recipe) {
        client.send(Transfer.DRAG_DROP_CANCEL, message)
        return
      }

      const itemCombined = recipe[0] as Item

      if (recipe[1].includes(Item.SILK_SCARF)) {
        const nbScarvesBasedOnNormalSynergy = getSynergyStep(
          player.synergies,
          Synergy.NORMAL
        )
        if (player.scarvesItems.length < nbScarvesBasedOnNormalSynergy) {
          player.scarvesItems.push(itemCombined)
        }
      }

      pokemon.items.delete(existingBasicItemToCombine)
      removeInArray(player.items, item)

      if (pokemon.items.has(itemCombined)) {
        // pokemon already has the combined item so the second one pops off and go to player inventory
        player.items.push(itemCombined)
      } else if (
        (isIn(SynergyStones, itemCombined) ||
          itemCombined === Item.FRIEND_BOW) &&
        pokemon.types.has(SynergyGivenByItem[itemCombined])
      ) {
        // combining into a synergy stone on a pokemon that already has this synergy makes the stone pops off and go to player inventory
        player.items.push(itemCombined)
      } else {
        pokemon.addItem(itemCombined, player)
      }
    } else {
      if (
        (isIn(SynergyStones, item) || item === Item.FRIEND_BOW) &&
        pokemon.types.has(SynergyGivenByItem[item])
      ) {
        // prevent combining into a synergy stone on a pokemon that already has this synergy
        client.send(Transfer.DRAG_DROP_CANCEL, message)
        return
      }
      pokemon.addItem(item, player)
      removeInArray(player.items, item)
    }

    if (pokemon.items.has(Item.SHINY_CHARM)) {
      pokemon.shiny = true
    }

    this.room.checkEvolutionsAfterItemAcquired(playerId, pokemon)

    if (pokemon.items.has(item) && isIn(UnholdableItems, item)) {
      // if the item is not holdable, we immediately remove it from the pokemon items
      // It is added just in time for ItemEvolutionRule to be checked
      pokemon.items.delete(item)
      if (!isIn(ConsumableItems, item) && !isIn(Mulches, item)) {
        // item is not holdable and has not been consumed, so we add it back to player items
        player.items.push(item)
      }
    }

    player.updateSynergies()
  }
}

export class OnSellPokemonCommand extends Command<
  GameRoom,
  {
    client: Client
    pokemonId: string
  }
> {
  execute({ client, pokemonId }) {
    const player = this.state.players.get(client.auth.uid)

    if (!player || !player.alive) return

    const pokemon = player.board.get(pokemonId)
    if (!pokemon) return
    if (!isOnBench(pokemon) && this.state.phase === GamePhaseState.FIGHT) {
      return // can't sell a pokemon currently fighting
    }

    if (canSell(pokemon.name, this.state.specialGameRule) === false) {
      return
    }

    player.board.delete(pokemonId)
    this.state.shop.releasePokemon(pokemon.name, player, this.state)

    const sellPrice = getSellPrice(pokemon, this.state.specialGameRule)
    player.addMoney(sellPrice, false, null)
    pokemon.items.forEach((it) => {
      player.items.push(it)
    })

    player.updateSynergies()
    player.boardSize = this.room.getTeamSize(player.board)
    pokemon.afterSell(player)
  }
}

export class OnShopRerollCommand extends Command<GameRoom, string> {
  execute(id) {
    const player = this.state.players.get(id)
    if (!player || !player.alive) return
    const rollCost = player.shopFreeRolls > 0 ? 0 : 1
    const canRoll = (player?.money ?? 0) >= rollCost

    if (canRoll) {
      player.gameStats.rerollCount++
      player.money -= rollCost
      if (player.shopFreeRolls > 0) {
        player.shopFreeRolls--
      } else {
        const repeatBallHolders = schemaValues(player.board).filter((p) =>
          p.items.has(Item.REPEAT_BALL)
        )
        if (repeatBallHolders.length > 0)
          player.shopFreeRolls += repeatBallHolders.length
      }
      this.state.shop.assignShop(player, true, this.state)
    }
  }
}

export class OnLockCommand extends Command<GameRoom, string> {
  execute(id) {
    const player = this.state.players.get(id)
    if (!player || !player.alive) return
    player.shopLocked = !player.shopLocked
  }
}

export class OnSpectateCommand extends Command<
  GameRoom,
  {
    id: string
    spectatedPlayerId: string
  }
> {
  execute({ id, spectatedPlayerId }) {
    const player = this.state.players.get(id)
    if (!player) return
    player.spectatedPlayerId = spectatedPlayerId
  }
}

export class OnLevelUpCommand extends Command<
  GameRoom,
  {
    id: string
  }
> {
  execute(id) {
    const player = this.state.players.get(id)
    if (!player || !player.alive) return

    if (player.experienceManager.canLevelUp()) {
      const xpNeeded =
        player.experienceManager.expNeeded -
        player.experienceManager.experience
      if (player.money >= xpNeeded) {
        player.addExperience(xpNeeded)
        player.money -= xpNeeded
      }
    }
  }
}

export class OnPickBerryCommand extends Command<
  GameRoom,
  {
    playerId: string
    berryIndex: number
  }
> {
  execute({ playerId, berryIndex }) {
    const player = this.state.players.get(playerId)
    if (!player || !player.alive) return
    if (player.berryTreesStages[berryIndex] >= 3) {
      player.berryTreesStages[berryIndex] = 0
      const type =
        getSynergyStep(player.synergies, Synergy.GRASS) === 4
          ? GOLDEN_BERRY_TREE_TYPES[berryIndex]
          : player.berryTreesType[berryIndex]
      player.items.push(type)
    }
  }
}

export class OnJoinCommand extends Command<GameRoom, { client: Client }> {
  async execute({ client }) {
    try {
      //logger.debug("onJoin", client.auth.uid)
      if (!client.userData) client.userData = {}
      client.userData.spectatedPlayerId = client.auth.uid
      client.view = new StateView()
      const players = schemaValues(this.state.players)
      const connectedPlayer = players.find((p) => p.id === client.auth.uid)
      if (connectedPlayer) {
        /*logger.info(
          `${client.auth.displayName} (${client.id}) joined game room ${this.room.roomId}`
        )*/
        client.view.add(connectedPlayer)
        if (this.state.players.size >= MAX_PLAYERS_PER_GAME) {
          const humanPlayers = players.filter((p) => !p.isBot)
          if (humanPlayers.length === 1) {
            humanPlayers[0].titles.add(Title.LONE_WOLF)
          }
        }
      } else {
        this.state.spectators.add(client.auth.uid)
      }
    } catch (error) {
      logger.error(error)
    }
  }
}

export class OnUpdateCommand extends Command<
  GameRoom,
  {
    deltaTime: number
  }
> {
  execute({ deltaTime }) {
    if (deltaTime) {
      const speed = this.state.gameSpeed || 1
      deltaTime = deltaTime * speed
      this.state.time -= deltaTime
      if (Math.round(this.state.time / 1000) != this.state.roundTime) {
        this.state.roundTime = Math.round(this.state.time / 1000)
      }
      if (this.state.time < 0) {
        this.state.updatePhaseNeeded = true
      } else if (this.state.phase == GamePhaseState.FIGHT) {
        let everySimulationFinished = true

        this.state.simulations.forEach((simulation) => {
          if (!simulation.finished) {
            if (simulation.started) simulation.update(deltaTime)
            everySimulationFinished = false
          }
        })

        if (everySimulationFinished && !this.state.updatePhaseNeeded) {
          // wait for 3 seconds victory anim before moving to next stage
          this.state.time = 3000
          this.state.updatePhaseNeeded = true
        }
      } else if (this.state.phase === GamePhaseState.TOWN || this.state.phase === GamePhaseState.SHOP) {
        this.room.miniGame.update(deltaTime)
      }
      if (this.state.updatePhaseNeeded && this.state.time < 0) {
        return [new OnUpdatePhaseCommand()]
      }
    }
  }
}

export class OnUpdatePhaseCommand extends Command<GameRoom> {
  execute() {
    this.state.updatePhaseNeeded = false

    if (this.state.gameFinished) return

    if (this.state.phase === GamePhaseState.MAP) {
      // MAP phase doesn't auto-transition; the player selects a node via message
      return
    } else if (this.state.phase === GamePhaseState.PICK) {
      this.stopPickingPhase()
      this.checkForLazyTeam()
      this.initializeFightingPhase()
    } else if (this.state.phase === GamePhaseState.FIGHT) {
      const fightNode = this.state.mapNodes.get(this.state.currentNodeId)
      if (fightNode?.nodeType === MapNodeType.ARCEUS_BOSS) {
        this.endArceusFight()
      } else {
        this.stopSpireFightingPhase()
        if (this.state.gameFinished) {
          // already ended (e.g. champion fight processed on prior tick)
        } else if (fightNode?.nodeType === MapNodeType.CHAMPION) {
          this.endChampionFight()
        } else if (fightNode?.nodeType === MapNodeType.ELITE_FOUR) {
          const e4Won = schemaValues(this.state.players).some(
            (p) => !p.isBot && p.history.at(-1)?.result === BattleResult.WIN
          )
          if (e4Won && !this.state.runFailed) {
            this.initializeMapPhase()
          } else if (!this.state.runFailed) {
            this.state.runFailed = true
            this.state.players.forEach((p: Player) => {
              if (!p.isBot) {
                p.life = 0
                p.alive = false
              }
            })
            this.syncRunHPToPlayers()
          }
        } else if (!this.state.runFailed) {
          this.initializeRewardPhase()
        }
      }
    } else if (this.state.phase === GamePhaseState.REWARD) {
      this.initializeMapPhase()
    } else if (this.state.phase === GamePhaseState.SHOP) {
      this.room.miniGame.stop(this.state)
      this.initializeMapPhase()
    } else if (this.state.phase === GamePhaseState.REST) {
      this.initializeMapPhase()
    } else if (this.state.phase === GamePhaseState.EVENT) {
      this.initializeMapPhase()
    } else if (this.state.phase === GamePhaseState.TOWN) {
      this.stopTownPhase()
      if (this.state.stageLevel === 0) {
        this.state.stageLevel = 1
      }
      this.initializePickingPhase()
    }
  }

  generateWildRewardChoice(player: Player, node: any, won: boolean, rerolled = false) {
    const REWARD_COMPONENTS: Item[] = [
      Item.MIRACLE_SEED, Item.MYSTIC_WATER, Item.HEART_SCALE,
      Item.NEVER_MELT_ICE, Item.CHARCOAL, Item.MAGNET,
      Item.BLACK_GLASSES, Item.TWISTED_SPOON, Item.FOSSIL_STONE
    ]

    // 3 Pokemon: one per region synergy, with 50% chance of a regional swap
    const pokemonPool: Pkm[] = node.region
      ? generateWildRewardPokemon(node.region, this.state.currentAct)
      : []

    // Fallback if region produced fewer than 3
    while (pokemonPool.length < 3) {
      const p = this.state.shop.pickPokemon(player, this.state, -1, true)
      if (!p) break
      pokemonPool.push(p)
    }

    // Ditto: 33% chance to replace a random Pokemon on win (never on reroll)
    if (won && !rerolled && Math.random() < 0.33 && pokemonPool.length > 0) {
      const idx = Math.floor(Math.random() * pokemonPool.length)
      pokemonPool[idx] = Pkm.DITTO
    }

    const pokemons: (Pkm | typeof Pkm.DEFAULT)[] = []
    const items: Item[] = []

    // Pokemon slots
    for (const pkm of pokemonPool) {
      pokemons.push(pkm)
      items.push(Item.ORAN_BERRY)
    }

    // Win: 4th slot is a random item component
    if (won) {
      pokemons.push(Pkm.DEFAULT)
      items.push(pickRandomIn(REWARD_COMPONENTS))
    }

    player.choices.push(
      new PlayerChoice({
        type: "wildReward",
        pokemons,
        items
      })
    )
  }

  applyFisho2EliteOverride() {
    if (this.state.currentAct > 3) return
    const isFisho2 = schemaValues(this.state.players).some(
      (p) => !p.isBot && p.name === "Fisho2"
    )
    if (!isFisho2) return
    const { getEliteEncounterCount, getEliteEncounterName, getEliteEncounterAvatar } = require("../../models/spire-encounters")
    const { PkmIndex } = require("../../types/enum/Pokemon")
    const eliteTotal = getEliteEncounterCount(this.state.currentAct)
    let converted = 0
    let eliteIdx = 0
    this.state.mapNodes.forEach((node: any) => {
      if (converted >= 10) return
      if (node.nodeType === MapNodeType.WILD_BATTLE || node.nodeType === MapNodeType.GYM_LEADER || node.nodeType === MapNodeType.MYSTERY_ENCOUNTER || node.nodeType === MapNodeType.POKEMART) {
        node.nodeType = MapNodeType.ELITE
        node.eliteEncounterIndex = eliteIdx % eliteTotal
        node.displayName = getEliteEncounterName(eliteIdx % eliteTotal, this.state.currentAct)
        node.eliteAvatar = PkmIndex[getEliteEncounterAvatar(eliteIdx % eliteTotal, this.state.currentAct)] ?? ""
        eliteIdx++
        converted++
      }
    })
  }

  syncRunHPToPlayers() {
    this.state.players.forEach((player: Player) => {
      if (!player.isBot) {
        player.life = this.state.runHP
      }
    })
  }

  autoSaveRun() {
    this.state.players.forEach((player: Player) => {
      if (!player.isBot && player.alive && !this.state.runComplete && !this.state.runFailed) {
        const { saveRun } = require("../../services/run-save")
        saveRun(player.id, this.state, player)
      }
    })
  }

  initializeMapPhase() {
    this.state.phase = GamePhaseState.MAP
    this.state.time = 999 * 1000
    this.state.roundTime = 999
    this.syncRunHPToPlayers()
    resetArraySchema(this.state.spireEncounterBoard, [])
    resetArraySchema(this.state.encounterInventory, [])
    resetArraySchema(this.state.encounterGroundHoles, [])
    resetArraySchema(this.state.encounterSynergies, [])
    this.state.encounterSnapshot = null
    this.state.encounterCrownedAt = null
    this.state.encounterBonusHP = 0
    this.state.encounterBonusDef = 0
    this.state.encounterBonusSpeDef = 0

    // Clean up any lingering minigame state
    this.state.avatars.forEach((a, key) => this.state.avatars.delete(key))
    this.state.floatingItems.forEach((i, key) => this.state.floatingItems.delete(key))
    this.state.portals.forEach((p, key) => this.state.portals.delete(key))
    this.state.symbols.forEach((s, key) => this.state.symbols.delete(key))
    this.state.players.forEach((player: Player) => {
      if (!player.isBot) {
        player.map = "town"
      }
    })

    if (this.state.mapNodes.size === 0) {
      generateActMap(this.state.currentAct, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as DifficultyMode)
    }

    this.autoSaveRun()
  }

  onSelectMapNode(nodeId: string) {
    const node = this.state.mapNodes.get(nodeId)
    if (!node || !node.available) return

    node.visited = true
    this.state.currentNodeId = nodeId
    this.state.currentFloor = node.floor

    markAvailableNodes(nodeId, this.state.mapNodes, this.state.mapEdges)

    // Set player map to region for background tilemap and update regional pool
    if (node.region && node.nodeType === MapNodeType.WILD_BATTLE) {
      this.state.players.forEach((player: Player) => {
        if (!player.isBot) {
          const previousMap = player.map
          player.map = node.region as any
          player.updateRegionalPool(this.state, true, previousMap)
        }
      })
    } else if (node.nodeType === MapNodeType.ARCEUS_BOSS) {
      this.state.players.forEach((player: Player) => {
        if (!player.isBot) {
          player.map = "In the Nightmare" as any
        }
      })
    }

    switch (node.nodeType) {
      case MapNodeType.WILD_BATTLE:
      case MapNodeType.GYM_LEADER:
      case MapNodeType.ELITE:
      case MapNodeType.UNLOCK:
      case MapNodeType.LEGENDARY_BOSS:
      case MapNodeType.ELITE_FOUR:
      case MapNodeType.CHAMPION:
      case MapNodeType.ARCEUS_BOSS: {
        this.state.stageLevel = (this.state.currentAct - 1) * 15 + node.floor
        let encounter: SpireEncounter | null = null
        const mode = this.state.difficultyMode as 0 | 1 | 2 | 3
        if (node.nodeType === MapNodeType.ARCEUS_BOSS) {
          encounter = getArceusEncounter()
        } else if (node.nodeType === MapNodeType.WILD_BATTLE) {
          encounter = node.region
            ? getRegionalWildEncounter(this.state.currentAct, node.floor, node.region, mode)
            : getWildEncounter(this.state.currentAct, node.floor, node.x + node.floor * 7)
        } else if (node.nodeType === MapNodeType.GYM_LEADER) {
          encounter = generateGymEncounter(
            node.gymLeaderSynergy as Synergy,
            this.state.currentAct,
            node.floor,
            mode,
            node.displayName || undefined
          )
        } else if (node.nodeType === MapNodeType.ELITE) {
          encounter = getEliteEncounter(node.eliteEncounterIndex, this.state.currentAct, node.floor, mode)
        } else if (node.nodeType === MapNodeType.UNLOCK) {
          encounter = getUnlockEncounter(node.eliteEncounterIndex, this.state.currentAct, node.floor, mode)
        } else if (node.nodeType === MapNodeType.ELITE_FOUR) {
          const e4Index = node.floor - 1
          const champData = loadChampionData(this.state.difficultyMode as DifficultyMode)
          const slotData = getEliteFourSlotForEncounter(champData.eliteFour[e4Index], e4Index)
          this.state.encounterSnapshot = slotData.snapshot
          this.state.encounterCrownedAt = champData.eliteFourCrownedAt?.[e4Index] ?? champData.championSince ?? null
          if (slotData.snapshot.region && slotData.snapshot.region !== "town") {
            this.state.players.forEach((p: Player) => { if (!p.isBot) p.map = slotData.snapshot.region as any })
          }
          encounter = { name: slotData.name, avatar: slotData.avatar, board: [], items: [] }
        } else if (node.nodeType === MapNodeType.CHAMPION) {
          const champData = loadChampionData(this.state.difficultyMode as DifficultyMode)
          const slotData = getChampionSlotForEncounter(champData.champion)
          this.state.encounterSnapshot = slotData.snapshot
          this.state.encounterCrownedAt = champData.championSince ?? null
          if (slotData.snapshot.region && slotData.snapshot.region !== "town") {
            this.state.players.forEach((p: Player) => { if (!p.isBot) p.map = slotData.snapshot.region as any })
          }
          encounter = { name: slotData.name, avatar: slotData.avatar, board: [], items: [] }
        } else {
          encounter = node.displayName
            ? getLegendaryBossEncounterByName(this.state.currentAct, node.displayName, mode)
            : getLegendaryBossEncounter(this.state.currentAct, mode)
        }

        resetArraySchema(this.state.encounterInventory, [])

        if (this.state.encounterSnapshot) {
          const snap = this.state.encounterSnapshot
          let displaySnap = snap
          if (this.state.encounterCrownedAt && this.state.difficultyMode < 2) {
            const elapsedMs = Date.now() - new Date(this.state.encounterCrownedAt).getTime()
            const isEasy = this.state.difficultyMode === 0
            const hpDecay = Math.floor(elapsedMs / ((isEasy ? 2.5 : 5) * 60 * 1000))
            if (hpDecay > 0) {
              displaySnap = {
                ...snap,
                pokemon: snap.pokemon.map((p) => {
                  if (p.y <= 0) return p
                  const baseHp = PokemonFactory.createPokemonFromName(p.name as Pkm).hp
                  const effectiveHp = baseHp + (p.statBoosts?.hp ?? 0)
                  if (effectiveHp <= 50) return p
                  const reduction = Math.min(hpDecay, effectiveHp - 50)
                  const newHpBoost = (p.statBoosts?.hp ?? 0) - reduction
                  const boosts = p.statBoosts ?? { hp: 0, atk: 0, def: 0, speDef: 0, ap: 0, speed: 0 }
                  return { ...p, statBoosts: { ...boosts, hp: newHpBoost } }
                })
              }
            }
          }
          resetArraySchema(this.state.spireEncounterBoard, encodeSnapshotForClient(displaySnap))
          if (snap.inventory?.length) {
            resetArraySchema(this.state.encounterInventory, snap.inventory)
          }
          if (snap.groundHoles?.length) {
            resetArraySchema(this.state.encounterGroundHoles, snap.groundHoles)
          }
          // Compute server-side synergies (includes Dragon double-types etc.)
          const snapBoard = snap.pokemon.filter((p) => p.y > 0)
          const tempPokemon = snapBoard.map((p) => {
            const pkm = PokemonFactory.createPokemonFromName(p.name as Pkm)
            pkm.positionY = p.y
            if (p.items) p.items.forEach((item) => { if (!pkm.items.has(item as Item)) pkm.items.add(item as Item) })
            return pkm
          })
          const snapBonusSynergies = new Map<Synergy, number>()
          for (const item of snap.inventory ?? []) {
            const synType = SynergyGivenByGem[item as SynergyGem]
            if (synType) snapBonusSynergies.set(synType, (snapBonusSynergies.get(synType) ?? 0) + 1)
          }
          const snapSynergies = computeSynergies(tempPokemon, snapBonusSynergies.size > 0 ? snapBonusSynergies : undefined)
          resetArraySchema(
            this.state.encounterSynergies,
            Array.from(snapSynergies.entries()).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`)
          )
          // Build a SpireEncounter from snapshot for stats calculation
          const snapEncounter: SpireEncounter = {
            name: encounter.name,
            avatar: (snap.pokemon[0]?.name ?? "MAGIKARP") as Pkm,
            board: snap.pokemon.filter((p) => p.y > 0).map((p) => [p.name, p.x, p.y]),
            items: snap.pokemon.filter((p) => p.y > 0).map((p) => p.items)
          }
          const stats = calculateEncounterStats(snapEncounter)
          this.state.encounterDifficulty = stats.difficulty
          this.state.encounterPokemonCount = stats.pokemonCount
          this.state.encounterTotalStars = stats.totalStars
          this.state.encounterTotalItems = stats.totalItems
        } else {
          resetArraySchema(
            this.state.spireEncounterBoard,
            encounter.board.map(([pkm, x, y], i) => {
              const itemStr = encounter.items?.[i]?.length ? `,${encounter.items[i].join(",")}` : ""
              return `${pkm},${x},${y}${itemStr}`
            })
          )
          const stats = calculateEncounterStats(encounter)
          this.state.encounterDifficulty = stats.difficulty
          this.state.encounterPokemonCount = stats.pokemonCount
          this.state.encounterTotalStars = stats.totalStars
          this.state.encounterTotalItems = stats.totalItems
        }
        this.state.encounterName = encounter.name
        this.state.encounterBonusHP = encounter.bonusHP ?? 0
        this.state.encounterBonusAtk = encounter.bonusAtk ?? 0
        this.state.encounterBonusDef = encounter.bonusDef ?? 0
        this.state.encounterBonusSpeDef = encounter.bonusSpeDef ?? 0
        this.state.encounterBonusAP = encounter.bonusAP ?? 0
        this.state.encounterBonusPP = encounter.bonusPP ?? 0
        this.initializePickingPhase()
        break
      }
      case MapNodeType.POKEMART:
        this.initializeShopPhase()
        break
      case MapNodeType.POKEMON_CENTER:
        this.initializeRestPhase()
        break
      case MapNodeType.MYSTERY_ENCOUNTER:
        this.initializeEventPhase()
        break
    }
  }

  initializeShopPhase() {
    this.state.phase = GamePhaseState.SHOP
    this.state.time = 999 * 1000
    this.state.roundTime = 999
    this.autoSaveRun()

    const shopItems = generateShopItems(this.state.currentAct)

    this.room.miniGame.initialize(this.state, this.room, true)
    this.room.miniGame.initializeShopCarousel(
      shopItems.map((si) => ({
        type: si.type,
        item: si.item,
        pokemon: si.pokemon,
        price: si.price
      }))
    )
  }

  initializeRestPhase() {
    this.state.phase = GamePhaseState.REST
    this.state.time = 999 * 1000
    this.state.roundTime = 999
    this.autoSaveRun()

    const dojoTicket = this.getDojoTicket()

    const randomComponent = pickRandomIn(ItemComponentsNoFossilOrScarf)

    this.state.spireEventName = "Pokemon Center"
    this.state.spireEventDescription = "Choose one:"
    resetArraySchema(this.state.spireEventChoiceLabels, [
      "Heal 30",
      "Ditto",
      dojoTicket.replace(/_/g, " ")
    ])
    resetArraySchema(this.state.spireEventChoiceDescs, [
      Item.ORAN_BERRY,
      "",
      dojoTicket
    ])
  }

  handleRestChoice(playerId: string, choiceIndex: number) {
    const player = this.state.players.get(playerId)
    if (!player) return

    if (choiceIndex === 0) {
      this.state.runHP = Math.min(100, this.state.runHP + 30)
      this.syncRunHPToPlayers()
    } else if (choiceIndex === 1) {
      this.room.spawnOnBench(player, Pkm.DITTO)
    } else if (choiceIndex === 2) {
      player.items.push(this.getDojoTicket())
    }
  }

  getDojoTicket(): Item {
    const act = this.state.currentAct
    const mode = this.state.difficultyMode
    if (mode === 3) {
      return act <= 2 ? Item.BRONZE_DOJO_TICKET : Item.SILVER_DOJO_TICKET
    }
    if (act === 1) {
      return mode === 0 ? Item.SILVER_DOJO_TICKET : Item.BRONZE_DOJO_TICKET
    } else if (act === 2) {
      return Item.SILVER_DOJO_TICKET
    } else {
      return mode === 2 ? Item.SILVER_DOJO_TICKET : Item.GOLD_DOJO_TICKET
    }
  }

  initializeEventPhase() {
    this.state.phase = GamePhaseState.EVENT
    this.state.time = 999 * 1000
    this.state.roundTime = 999
    this.autoSaveRun()

    const event = getRandomEvent()
    this.state.spireEventName = event.name
    this.state.spireEventDescription = event.description
    this.state.spireEventPortrait = event.portrait
    resetArraySchema(this.state.spireEventChoiceLabels, event.choices.map(c => c.label))
    resetArraySchema(this.state.spireEventChoiceDescs, event.choices.map(c => c.description))

  }

  handleEventChoice(playerId: string, choiceIndex: number) {
    const player = this.state.players.get(playerId)
    if (!player) return

    const label = (this.state.spireEventChoiceLabels[choiceIndex] ?? "").toLowerCase()
    if (!label) return

    if (label.includes("egg")) {
      giveRandomEgg(player)
    } else if (label.includes("dojo ticket")) {
      player.items.push(this.getDojoTicket())
    } else if (label.includes("pick all berries")) {
      if (player.money >= 6) {
        player.addMoney(-6, false, null)
        const berries = getEventBerries(7)
        berries.forEach(item => player.items.push(item))
      }
    } else if (label.includes("pick more berries")) {
      if (player.money >= 3) {
        player.addMoney(-3, false, null)
        const berries = getEventBerries(5)
        berries.forEach(item => player.items.push(item))
      }
    } else if (label.includes("pick berries")) {
      const berries = getEventBerries(3)
      berries.forEach(item => player.items.push(item))
    } else if (label.includes("trade 10 gold")) {
      if (player.money >= 10) {
        player.addMoney(-10, false, null)
        player.items.push(pickRandomIn(Tools))
      }
    } else if (label.includes("buy supplies")) {
      if (player.money >= 8) {
        player.addMoney(-8, false, null)
        const items = getEventItems(2)
        items.forEach(item => player.items.push(item))
      }
    } else if (label.includes("sacrifice")) {
      this.state.runHP = Math.max(0, this.state.runHP - 20)
      this.syncRunHPToPlayers()
      const item = pickRandomIn(CraftableNoStonesOrScarves)
      player.items.push(item)
    } else if (label.includes("offering")) {
      this.state.runHP = Math.max(0, this.state.runHP - 10)
      this.syncRunHPToPlayers()
      const items = getEventItems(1)
      items.forEach(item => player.items.push(item))
    } else if (label.includes("dig for gems")) {
      player.items.push(pickRandomIn(SynergyStones))
    } else if (label.includes("search for fossils")) {
      player.items.push(Item.FOSSIL_STONE)
    } else if (label.includes("rob")) {
      this.state.runHP = Math.max(0, this.state.runHP - 40)
      this.syncRunHPToPlayers()
      const items = getEventItems(2)
      items.forEach(item => player.items.push(item))
    } else if (label.includes("rocky helmet challenge")) {
      this.state.challengeItem = Item.ROCKY_HELMET
    } else if (label.includes("assault vest challenge")) {
      this.state.challengeItem = Item.ASSAULT_VEST
    } else if (label.includes("kings rock challenge")) {
      this.state.challengeItem = Item.KINGS_ROCK
    } else if (label.includes("red orb challenge")) {
      this.state.challengeItem = Item.RED_ORB
    } else if (label.includes("blue orb challenge")) {
      this.state.challengeItem = Item.BLUE_ORB
    } else if (label.includes("green orb challenge")) {
      this.state.challengeItem = Item.GREEN_ORB
    } else if (label.includes("2 exchange tickets")) {
      player.items.push(Item.EXCHANGE_TICKET)
      player.items.push(Item.EXCHANGE_TICKET)
    } else if (label.includes("1 exchange + 1 recycle")) {
      player.items.push(Item.EXCHANGE_TICKET)
      player.items.push(Item.RECYCLE_TICKET)
    } else if (label.includes("2 recycle tickets")) {
      player.items.push(Item.RECYCLE_TICKET)
      player.items.push(Item.RECYCLE_TICKET)
    } else if (label.includes("take a carp")) {
      this.room.spawnOnBench(player, Pkm.MAGIKARP)
    } else if (label.includes("buy a feebas")) {
      if (player.money >= 10) {
        player.addMoney(-10, false, null)
        this.room.spawnOnBench(player, Pkm.FEEBAS)
      }
    } else if (label.includes("buy a wishiwashi")) {
      if (player.money >= 20) {
        player.addMoney(-20, false, null)
        this.room.spawnOnBench(player, Pkm.WISHIWASHI)
      }
    } else if (label.includes("potion")) {
      this.state.runHP = Math.min(100, this.state.runHP + 20)
      this.syncRunHPToPlayers()
    } else if (label.includes("rest (10 gold)")) {
      if (player.money >= 10) {
        player.addMoney(-10, false, null)
        this.state.runHP = Math.min(100, this.state.runHP + 50)
        this.syncRunHPToPlayers()
      }
    } else if (label.includes("berries for the road")) {
      if (player.money >= 3) {
        player.addMoney(-3, false, null)
        for (let i = 0; i < 5; i++) player.items.push(Item.ORAN_BERRY)
      }
    }

    this.checkRunDeath(player)
  }

  endArceusFight() {
    let totalDamageDealt = 0
    this.state.simulations.forEach((simulation) => {
      simulation.blueDpsMeter.forEach((dps) => {
        totalDamageDealt += dps.physicalDamage + dps.specialDamage + dps.trueDamage
      })
    })

    this.state.simulations.forEach((simulation) => {
      if (!simulation.finished) {
        simulation.onFinish()
      }
      simulation.stop()
    })

    this.state.players.forEach((player: Player) => {
      player.wanderers.clear()
      if (player.alive && !player.isBot) {
        player.board.forEach((pokemon) => {
          if (pokemon.evolutionRule instanceof HatchEvolutionRule) {
            pokemon.evolutionRule.updateHatch(pokemon, player, this.state.stageLevel)
          }
        })
        player.updateSynergies()
      }
    })

    this.state.arceusDamageDealt = totalDamageDealt
    this.state.gameFinished = true
    this.state.runFailed = true

    const humanPlayer = schemaValues(this.state.players).find((p) => !p.isBot)
    if (humanPlayer && totalDamageDealt > 0) {
      const snapshot = snapshotPlayerTeam(humanPlayer, { includeBench: true })
      const { checkAndUpdateArceusRecord } = require("../../services/arceus-record")
      const { isNewRecord, previousRecord } = checkAndUpdateArceusRecord(
        humanPlayer.name,
        totalDamageDealt,
        snapshot,
        this.state.difficultyMode as 0 | 1 | 2 | 3
      )
      if (isNewRecord) {
        this.state.isNewArceusRecord = true
        if (previousRecord) {
          this.state.previousArceusRecord = previousRecord.damage
          this.state.previousArceusHolder = previousRecord.playerName
        }
        discordService.announceArceusRecord(
          snapshot,
          totalDamageDealt,
          this.state.difficultyMode as 0 | 1 | 2 | 3,
          previousRecord
        )
      } else if (previousRecord) {
        this.state.previousArceusRecord = previousRecord.damage
        this.state.previousArceusHolder = previousRecord.playerName
      }
    }

    this.state.players.forEach((p: Player) => {
      if (!p.isBot) {
        p.life = 0
        p.alive = false
        const { deleteSavedRun, saveRunHistory, incrementRunEnd } = require("../../services/run-save")
        deleteSavedRun(p.id)
        saveRunHistory(p.id, this.state, p, false)
        incrementRunEnd(p.id, this.state.difficultyMode, true, true, this.state.arceusDamageDealt)
        this.room.runHistoryRecorded = true
      }
    })
    this.syncRunHPToPlayers()
  }

  endChampionFight() {
    this.state.gameFinished = true
    const winner = schemaValues(this.state.players).find(
      (p) => !p.isBot && p.history.at(-1)?.result === BattleResult.WIN
    )
    if (winner) {
      this.state.runComplete = true

      const snapshot = snapshotPlayerTeam(winner, { includeBench: true })
      snapshot.region = this.state.playerSpireRegion || "town"
      if (snapshot.pokemon.length > 0) {
        const previousData = loadChampionData(this.state.difficultyMode as DifficultyMode)
        const defeatedChampion = previousData.champion.name
        const result = promoteNewChampion(snapshot, this.state.difficultyMode as DifficultyMode)
        const newE4 = [
          previousData.eliteFour[1].name,
          previousData.eliteFour[2].name,
          previousData.eliteFour[3].name,
          defeatedChampion
        ]
        discordService.announceNewChampion(
          snapshot,
          this.state.difficultyMode as DifficultyMode,
          defeatedChampion,
          newE4,
          result.reignDurationMs
        )
        if (result.isNewLongestReign) {
          discordService.announceNewLongestReign(
            result.previousChampion,
            result.reignDurationMs!,
            this.state.difficultyMode as DifficultyMode,
            result.previousLongestReign
          )
        }
      }
    } else {
      this.state.runFailed = true
      this.state.players.forEach((p: Player) => {
        if (!p.isBot) {
          p.life = 0
          p.alive = false
          const loserSnapshot = snapshotPlayerTeam(p, { includeBench: true })
          loserSnapshot.region = this.state.playerSpireRegion || "town"
          if (loserSnapshot.pokemon.length > 0) {
            const data = loadChampionData(this.state.difficultyMode as DifficultyMode)
            // Find highest Fish slot (search from index 3 down to 0)
            let placed = false
            for (let i = 3; i >= 0; i--) {
              if (data.eliteFour[i].name === DEFAULT_SNAPSHOT.name) {
                data.eliteFour[i] = loserSnapshot
                saveChampionData(data, this.state.difficultyMode as DifficultyMode)
                placed = true
                break
              }
            }
          }
        }
      })
      this.syncRunHPToPlayers()
    }
    // Delete saved run and record history
    this.state.players.forEach((p: Player) => {
      if (!p.isBot) {
        const { deleteSavedRun, saveRunHistory, incrementRunEnd } = require("../../services/run-save")
        deleteSavedRun(p.id)
        saveRunHistory(p.id, this.state, p, !!winner)
        incrementRunEnd(p.id, this.state.difficultyMode, true, !!winner, 0)
        this.room.runHistoryRecorded = true
      }
    })
  }

  checkRunDeath(player: Player) {
    if (this.state.runHP <= 0 && !this.state.runFailed) {
      this.state.runHP = 0
      this.state.runFailed = true
      this.state.gameFinished = true
      player.life = 0
      player.alive = false
      this.syncRunHPToPlayers()
      const { deleteSavedRun, saveRunHistory, incrementRunEnd } = require("../../services/run-save")
      deleteSavedRun(player.id)
      saveRunHistory(player.id, this.state, player, false)
      incrementRunEnd(player.id, this.state.difficultyMode, false, false, 0)
      this.room.runHistoryRecorded = true
    }
  }

  initializeRewardPhase() {
    this.state.phase = GamePhaseState.REWARD
    this.state.time = 999 * 1000
    this.state.roundTime = 999
    resetArraySchema(this.state.spireEncounterBoard, [])

    const node = this.state.mapNodes.get(this.state.currentNodeId)
    if (!node) return

    this.state.players.forEach((player: Player) => {
      if (player.alive && !player.isBot) {
        const lastHistory = player.history.at(-1)
        const won = lastHistory?.result === BattleResult.WIN
        const modeLabel = ["Easy", "Normal", "Hard"][this.state.difficultyMode] ?? "Normal"
        const guestTag = player.id === "local-player" ? " - guest" : ""
        logger.info(`Player: ${player.name.padEnd(20)} stage ${String(this.state.stageLevel).padStart(2)} ${won ? "win " : "loss"}, hp: ${String(this.state.runHP).padStart(3)}, difficulty: ${modeLabel.padEnd(10)}${guestTag}`)

        const baseGold = getGoldReward(node.nodeType, this.state.currentAct)
        const bonusGold = getPassiveItemBonusGold(player.items)
        const totalGold = won ? baseGold + bonusGold : Math.floor(baseGold / 3)
        player.addMoney(totalGold, true, null)
        const client = this.room.clients.find((cli) => cli.auth.uid === player.id)
        client?.send(Transfer.PLAYER_INCOME, totalGold)

        const healAmount = getPassiveItemPostBattleHeal(player.items, won)
        if (healAmount > 0) {
          this.state.runHP = Math.min(100, this.state.runHP + healAmount)
          this.syncRunHPToPlayers()
        }

        const bonusXP = getPassiveItemBonusXP(player.items)
        if (bonusXP > 0) {
          player.experienceManager.addExperience(bonusXP)
        }

        // Challenge item reward
        if (this.state.challengeItem && node.nodeType === MapNodeType.WILD_BATTLE) {
          if (won) {
            player.items.push(this.state.challengeItem as Item)
          }
          this.state.challengeItem = ""
        }

        // Reward offers
        if (node.nodeType === MapNodeType.WILD_BATTLE) {
          this.generateWildRewardChoice(player, node, won)
        } else if (node.nodeType === MapNodeType.ELITE && node.eliteEncounterIndex >= 0) {
          const encounterType = getEliteEncounterType(node.eliteEncounterIndex, this.state.currentAct)

          if (won && encounterType) {
            const mainPokemon = getEliteEncounterPokemon(node.eliteEncounterIndex, this.state.currentAct)
            const mainPkm = mainPokemon[0] ?? Pkm.DITTO
            const mainData = getPokemonData(mainPkm)
            const synergies = (mainData.types ?? []) as Synergy[]
            const supportPool: Pkm[] = []
            for (const syn of synergies) {
              const typed = PRECOMPUTED_POKEMONS_PER_TYPE[syn] ?? []
              for (const pkm of typed) {
                const data = getPokemonData(pkm)
                if (pkm !== mainPkm && data.rarity !== "LEGENDARY" && data.rarity !== "UNIQUE" &&
                    data.rarity !== "HATCH" && data.rarity !== "SPECIAL" && !supportPool.includes(pkm)) {
                  supportPool.push(pkm)
                }
              }
            }
            const support1 = supportPool.length > 0 ? pickRandomIn(supportPool) : Pkm.DITTO
            const support2 = supportPool.length > 1 ? pickRandomIn(supportPool.filter(p => p !== support1)) : Pkm.DITTO
            const comp1 = pickRandomIn(ItemComponentsNoFossilOrScarf)
            const comp2 = pickRandomIn(ItemComponentsNoFossilOrScarf)
            const pokemons: Pkm[] = [mainPkm, support1, support2]
            const items: Item[] = [Item.ORAN_BERRY, comp1, comp2]
            player.choices.push(
              new PlayerChoice({ type: "eliteReward", pokemons, items })
            )
          } else if (!won && encounterType) {
            this.generateWildRewardChoice(player, node, false)
          } else {

          const eliteEncounters = (require("../../models/spire-encounters") as any)
          const encounters = eliteEncounters.getEliteEncountersForAct(this.state.currentAct)
          const template = encounters[node.eliteEncounterIndex % encounters.length]

          if (won && template.name === "Eeveelution Squad") {
            const evoStones = [
              Item.WATER_STONE, Item.THUNDER_STONE, Item.FIRE_STONE,
              Item.LEAF_STONE, Item.ICE_STONE, Item.MOON_STONE,
              Item.SUN_STONE, Item.DUSK_STONE, Item.DAWN_STONE
            ]
            const stones = pickNRandomIn(evoStones, 2)
            const pokemons: Pkm[] = [Pkm.EEVEE, Pkm.DEFAULT, Pkm.DEFAULT]
            const items: Item[] = [Item.FOSSIL_STONE, stones[0], stones[1]]
            player.choices.push(
              new PlayerChoice({ type: "eliteReward", pokemons, items })
            )
          } else if (won && template.name === "Psychic Circle") {
            const offers = pickNRandomIn(template.rewards, 3)
            const pairedItems: Item[] = offers.map(() => pickRandomIn(ItemComponentsNoFossilOrScarf))
            player.choices.push(
              new PlayerChoice({ type: "eliteReward", pokemons: offers, items: pairedItems })
            )
          } else if (won && template.name === "Bat Cave") {
            const comp1 = pickRandomIn(ItemComponentsNoFossilOrScarf)
            const comp2 = pickRandomIn(ItemComponentsNoFossilOrScarf)
            const pokemons: Pkm[] = [Pkm.ZUBAT, Pkm.WOOBAT, Pkm.NOIBAT]
            const items: Item[] = [comp1, comp2, Item.ORAN_BERRY]
            player.choices.push(
              new PlayerChoice({ type: "eliteReward", pokemons, items })
            )
          } else if (won && template.name === "Rival Flames") {
            const synergyItem = pickRandomIn([Item.ELECTIRIZER, Item.MAGMARIZER])
            const pokemons: Pkm[] = [Pkm.ELEKID, Pkm.MAGBY, Pkm.DEFAULT]
            const items: Item[] = [Item.ORAN_BERRY, Item.ORAN_BERRY, synergyItem]
            player.choices.push(
              new PlayerChoice({ type: "eliteReward", pokemons, items })
            )
          } else if (won && template.name === "Iron Defense") {
            const comp1 = pickRandomIn(ItemComponentsNoFossilOrScarf)
            const comp2 = pickRandomIn(ItemComponentsNoFossilOrScarf)
            const pokemons: Pkm[] = [Pkm.BELDUM, Pkm.RIOLU, Pkm.SCYTHER]
            const items: Item[] = [comp1, comp2, Item.ORAN_BERRY]
            player.choices.push(
              new PlayerChoice({ type: "eliteReward", pokemons, items })
            )
          } else if (won && template.name === "Psychic Conclave") {
            const rewardPool: Pkm[] = [Pkm.ABRA, Pkm.RALTS, Pkm.DROWZEE, Pkm.FENNEKIN]
            const offers = pickNRandomIn(rewardPool, 2)
            const comps: Item[] = offers.map(() => pickRandomIn(ItemComponentsNoFossilOrScarf))
            const pokemons: Pkm[] = [offers[0], offers[1], Pkm.DEFAULT]
            const items: Item[] = [comps[0], comps[1], Item.TWISTED_SPOON]
            player.choices.push(
              new PlayerChoice({ type: "eliteReward", pokemons, items })
            )
          } else if (won && template.name === "Sleeping Giant") {
            const comp1 = pickRandomIn(ItemComponentsNoFossilOrScarf)
            const comp2 = pickRandomIn(ItemComponentsNoFossilOrScarf)
            const pokemons: Pkm[] = [Pkm.SNORLAX, Pkm.SLAKOTH, Pkm.DEFAULT]
            const items: Item[] = [comp1, comp2, Item.BIG_EATER_BELT]
            player.choices.push(
              new PlayerChoice({ type: "eliteReward", pokemons, items })
            )
          } else if (won && template.name === "Poltergeist") {
            const foughtRotoms = Array.from(this.state.spireEncounterBoard)
              .map((entry: string) => entry.split(",")[0] as Pkm)
              .filter((pkm) => pkm !== Pkm.DEFAULT)
            const offers = foughtRotoms.length > 0 ? foughtRotoms : [Pkm.ROTOM]
            player.choices.push(
              new PlayerChoice({ type: "eliteReward", pokemons: offers })
            )
          } else if (won) {
            const elitePokemon = getEliteEncounterPokemon(node.eliteEncounterIndex, this.state.currentAct)
            if (elitePokemon.length > 0) {
              const offers = pickNRandomIn(elitePokemon, Math.min(3, elitePokemon.length))
              const pairedItems: Item[] = offers.map(() =>
                pickRandomIn(ItemComponentsNoFossilOrScarf)
              )
              player.choices.push(
                new PlayerChoice({ type: "eliteReward", pokemons: offers, items: pairedItems })
              )
            }
          } else {
            this.generateWildRewardChoice(player, node, false)
          }
          } // end else (handcrafted elite)
        } else if (node.nodeType === MapNodeType.UNLOCK && node.eliteEncounterIndex >= 0) {
          if (won) {
            const unlockPokemon = getUnlockEncounterPokemon(node.eliteEncounterIndex, this.state.currentAct)
            const unlockType = getUnlockEncounterType(node.eliteEncounterIndex, this.state.currentAct)
            if (unlockType === "hatch") {
              const component = pickRandomIn(ItemComponentsNoFossilOrScarf)
              player.choices.push(
                new PlayerChoice({ type: "unlockReward", pokemons: [...unlockPokemon, Pkm.DEFAULT], items: ["" as Item, component] })
              )
            } else {
              player.choices.push(
                new PlayerChoice({ type: "unlockReward", pokemons: unlockPokemon, items: [] })
              )
            }
          } else {
            this.generateWildRewardChoice(player, node, false)
          }
        } else if (node.nodeType === MapNodeType.GYM_LEADER) {
          if (won && node.gymLeaderSynergy) {
            const synergy = node.gymLeaderSynergy as Synergy
            const gem = getGymLeaderGem(synergy)
            const tool = pickRandomIn([...Tools])
            const baseForms = getGymLeaderBaseFormPokemon(synergy)
            const gymPokemon = baseForms.length > 0 ? pickRandomIn(baseForms) : Pkm.DITTO
            const pokemons: Pkm[] = [Pkm.DEFAULT, Pkm.DEFAULT, gymPokemon]
            const items: Item[] = [gem, tool, Item.ORAN_BERRY]
            player.choices.push(
              new PlayerChoice({ type: "gymReward", pokemons, items })
            )
          } else {
            this.generateWildRewardChoice(player, node, false)
          }
        } else if (node.nodeType === MapNodeType.CHAMPION) {
          if (won) {
            const goldItemChoices = pickNRandomIn([...ShinyItems], 3)
            player.choices.push(
              new PlayerChoice({ type: "item", items: goldItemChoices as any[] })
            )
          }
        } else if (node.nodeType !== MapNodeType.LEGENDARY_BOSS) {
          const offerCount = getPassiveItemPokemonOfferCount(player.items)
          const pokemonOffers: Pkm[] = []
          while (pokemonOffers.length < offerCount) {
            const p = this.state.shop.pickPokemon(player, this.state, -1, true)
            if (p) pokemonOffers.push(p)
            else break
          }
          if (won && pokemonOffers.length > 0) {
            const pairedItems: Item[] = pokemonOffers.map(() =>
              pickRandomIn(ItemComponentsNoFossilOrScarf)
            )
            player.choices.push(
              new PlayerChoice({ type: "addPick", pokemons: pokemonOffers, items: pairedItems })
            )
          } else if (pokemonOffers.length > 0) {
            player.choices.push(
              new PlayerChoice({ type: "addPick", pokemons: pokemonOffers })
            )
          }
        }
        if (node.nodeType === MapNodeType.LEGENDARY_BOSS && this.state.currentAct < 3) {
          const isHardOrAbove = this.state.difficultyMode >= 2
          const isImpossible = this.state.difficultyMode === 3
          // Impossible Act 2: no shiny item reward
          if (!(isImpossible && this.state.currentAct === 2)) {
            const rewardPool = isHardOrAbove && this.state.currentAct === 1 ? [...Tools] : [...ShinyItems]
            const count = won ? 3 : 1
            const goldItemChoices = pickNRandomIn(rewardPool, count)
            player.choices.push(
              new PlayerChoice({ type: "item", items: goldItemChoices as any[] })
            )
          }
        }
      }
    })

    this.autoSaveRun()

    const currentNode = this.state.mapNodes.get(this.state.currentNodeId)
    if (currentNode?.nodeType === MapNodeType.LEGENDARY_BOSS) {
      const anyPlayerWon = schemaValues(this.state.players).some(
        (p) => !p.isBot && p.history.at(-1)?.result === BattleResult.WIN
      )
      if (anyPlayerWon) {
        if (this.state.currentAct < 3) {
          this.state.currentAct += 1
          this.state.currentFloor = 0
          this.state.mapNodes.clear()
          this.state.mapEdges.clear()
          generateActMap(this.state.currentAct, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as DifficultyMode)
          this.applyFisho2EliteOverride()
          this.state.players.forEach((p) => { p.dojoFamilies.clear() })
        } else {
          // Act 3 boss beaten: show victory, allow entering Elite 4
          this.state.runComplete = true
          this.state.eliteFourAvailable = true
        }
      } else if (this.state.currentAct < 3) {
        this.state.currentAct += 1
        this.state.currentFloor = 0
        this.state.mapNodes.clear()
        this.state.mapEdges.clear()
        generateActMap(this.state.currentAct, this.state.mapNodes, this.state.mapEdges, this.state.difficultyMode as DifficultyMode)
        this.applyFisho2EliteOverride()
        this.state.players.forEach((p) => { p.dojoFamilies.clear() })
      } else {
        this.state.runFailed = true
        this.state.gameFinished = true
        this.state.players.forEach((p: Player) => {
          if (!p.isBot) {
            p.life = 0
            p.alive = false
            const { deleteSavedRun, saveRunHistory, incrementRunEnd } = require("../../services/run-save")
            deleteSavedRun(p.id)
            saveRunHistory(p.id, this.state, p, false)
            incrementRunEnd(p.id, this.state.difficultyMode, false, false, 0)
            this.room.runHistoryRecorded = true
          }
        })
        this.syncRunHPToPlayers()
      }
    }
  }

  stopSpireFightingPhase() {
    if (this.state.gameFinished) return

    // Calculate damage before stopping simulations (stop() clears redTeam)
    let remainingEnemyStars = 0
    const humanPlayer = schemaValues(this.state.players).find(p => !p.isBot)
    const playerSim = humanPlayer ? this.state.simulations.get(humanPlayer.simulationId) : undefined
    if (playerSim) {
      playerSim.redTeam.forEach((pokemon) => {
        if (pokemon.hp > 0 && !pokemon.isSpawn && pokemon.passive !== Passive.INANIMATE) {
          remainingEnemyStars += getPokemonData(pokemon.name).stars
        }
      })
    }

    this.state.simulations.forEach((simulation) => {
      try {
        if (!simulation.finished) {
          simulation.onFinish()
        }
        simulation.stop()
      } catch (e) {}
    })

    this.state.players.forEach((player: Player) => {
      player.wanderers.clear()

      if (player.alive && !player.isBot) {
        const lastHistory = player.history.at(-1)
        if (lastHistory && lastHistory.result !== BattleResult.WIN) {
          let damage = remainingEnemyStars * 2
          damage = Math.max(1, damage - getPassiveItemDamageReduction(player.items))
          this.state.runHP -= damage
          if (this.state.runHP <= 0) {
            this.state.runHP = 0
            this.state.runFailed = true
            this.state.gameFinished = true
            player.life = 0
            player.alive = false
            const { deleteSavedRun, saveRunHistory, incrementRunEnd } = require("../../services/run-save")
            deleteSavedRun(player.id)
            saveRunHistory(player.id, this.state, player, false)
            incrementRunEnd(player.id, this.state.difficultyMode, false, false, 0)
            this.room.runHistoryRecorded = true
            this.syncRunHPToPlayers()
          }
        }

        player.board.forEach((pokemon) => {
          if (pokemon.evolutionRule instanceof HatchEvolutionRule) {
            pokemon.evolutionRule.updateHatch(pokemon, player, this.state.stageLevel)
          }
          if (pokemon.action === PokemonActionState.TRAINING) {
            pokemon.addAttack(4)
            pokemon.addMaxHP(Math.ceil(0.1 * getPokemonData(pokemon.name).hp))
            pokemon.action = PokemonActionState.IDLE
          }
        })

        player.updateSynergies()
      }
    })

    this.syncRunHPToPlayers()
  }

  computeAchievements() {
    this.state.players.forEach((player) => {
      updatePlayerTitlesAfterFight(player, this.state)
      player.updateGameStats(this.state)
    })
  }

  checkEndGame(): boolean {
    const playersAlive = schemaValues(this.state.players).filter((p) => p.alive)

    if (playersAlive.length <= 1) {
      this.state.gameFinished = true
      const winner = playersAlive[0]
      if (winner) {
        /* there is a case where none of the players is alive because
         all the remaining players are dead due to a draw battle.
         In that case, they all already received their rank with checkDeath function */
        const client = this.room.clients.find(
          (cli) => cli.auth.uid === winner.id
        )
        if (client) {
          client.send(Transfer.FINAL_RANK, 1)
        }
      }
      return true
    }

    return false
  }

  computeIncome(isPVE: boolean, specialGameRule: SpecialGameRule | null) {
    this.state.players.forEach((player) => {
      let income = 0
      if (player.alive && !player.isBot) {
        const nbGimmighoulCoins = player.items.filter(
          (item) => item === Item.GIMMIGHOUL_COIN
        ).length
        const nbAmuletCoins =
          player.items.filter((item) => item === Item.AMULET_COIN).length +
          schemaValues(player.board).filter((pokemon) =>
            pokemon.items.has(Item.AMULET_COIN)
          ).length
        const nbRedScales = player.items.filter(
          (item) => item === Item.RED_SCALE
        ).length
        player.maxInterest = 5 + nbGimmighoulCoins - nbAmuletCoins
        if (specialGameRule !== SpecialGameRule.BLOOD_MONEY) {
          player.interest = max(player.maxInterest)(
            Math.floor(player.money / 10)
          )
          income += player.interest
        }
        if (!isPVE) {
          income += max(5)(player.streak)
        }
        income += 5
        income += nbRedScales * 5
        player.addMoney(income, true, null)
        if (income > 0) {
          const client = this.room.clients.find(
            (cli) => cli.auth.uid === player.id
          )
          client?.send(Transfer.PLAYER_INCOME, income)
        }
        player.addExperience(2)
      }
    })
  }

  checkDeath() {
    this.state.players.forEach((player: Player) => {
      if (player.life <= 0 && player.alive) {
        if (!player.isBot) {
          player.shop.forEach((pkm) => {
            this.state.shop.releasePokemon(pkm, player, this.state)
          })
          player.board.forEach((pokemon) => {
            this.state.shop.releasePokemon(pokemon.name, player, this.state)
          })
        }
        player.alive = false
        player.spectatedPlayerId = player.id // spectate self to not show KO players on another player side
        const client = this.room.clients.find(
          (cli) => cli.auth.uid === player.id
        )
        if (client) {
          client.send(Transfer.FINAL_RANK, player.rank)
        }
      }
    })
  }

  initializePickingPhase() {
    this.state.phase = GamePhaseState.PICK
    this.state.time = 999 * 1000
    this.state.roundTime = 999

    // Clean up minigame avatars from previous phases
    this.state.avatars.forEach((a, key) => this.state.avatars.delete(key))
    this.state.floatingItems.forEach((i, key) => this.state.floatingItems.delete(key))

    if (
      [2, 4].includes(this.state.stageLevel) &&
      this.state.specialGameRule === SpecialGameRule.TECHNOLOGIC
    ) {
      this.state.players.forEach((player: Player) => {
        const itemsSet = Tools.filter(
          (item) => player.artificialItems.includes(item) === false
        )
        player.choices.push(
          new PlayerChoice({
            type: "item",
            items: pickNRandomIn(itemsSet, 3)
          })
        )
      })
    }

    const commands = new Array<Command>()

    this.state.players.forEach((p) => this.updatePlayerBetweenStages(p))

    this.spawnWanderingPokemons()

    // PvE stage initialization
    const pveStage = PVEStages[this.state.stageLevel]
    if (pveStage) {
      this.state.shinyEncounter =
        this.state.townEncounter === TownEncounters.CELEBI ||
        (this.state.specialGameRule === SpecialGameRule.SHINY_HUNTER &&
          pveStage.shinyChance !== undefined) ||
        chance(pveStage.shinyChance ?? 0)
    }

    return commands
  }

  updatePlayerBetweenStages(player: Player) {
    const board = schemaValues(player.board)

    board.forEach((pokemon) => { pokemon._cookedDishes = [] })

    if (
      getSynergyStep(player.synergies, Synergy.FIRE) === 4 &&
      player.items.includes(Item.FIRE_SHARD) === false &&
      player.getRunHP() > 2
    ) {
      player.items.push(Item.FIRE_SHARD)
    }

    if (
      player.items.includes(Item.TREASURE_BOX) &&
      player.getRunHP() <= TREASURE_BOX_LIFE_THRESHOLD
    ) {
      removeInArray(player.items, Item.TREASURE_BOX)

      let rewards: Item[] = []
      let rewardsIcons: Item[] | undefined = undefined
      switch (this.state.treasureBoxRewardGiven) {
        case "sweets":
          rewardsIcons = [Item.SWEETS]
          rewards = pickNRandomIn(Sweets, 5)
          break
        case "itemComponents":
          rewards = pickNRandomIn(ItemComponents, 4)
          break
        case "componentsAndTickets":
          rewards = [
            ...pickNRandomIn(ItemComponents, 2),
            Item.RECYCLE_TICKET,
            Item.EXCHANGE_TICKET
          ]
          break
        case "craftableItems":
          rewards = pickNRandomIn(CraftableNoStonesOrScarves, 2)
          break
        case "mushrooms":
          rewardsIcons = [Item.MUSHROOMS]
          rewards = [Item.TINY_MUSHROOM, Item.BIG_MUSHROOM, Item.BALM_MUSHROOM]
          break
        case "goldBow":
          rewards = [Item.GOLD_BOW]
          break
        case "gold":
        default:
          rewards = [Item.BIG_NUGGET]
          break
      }

      player.spawnWanderingPokemon({
        pkm: Pkm.XATU,
        shiny: false,
        type: WandererType.DIALOG,
        behavior: WandererBehavior.SPECTATE,
        data: (rewardsIcons ?? rewards).join(";"),
        delay: 3000
      })

      setTimeout(() => {
        if (rewards[0] === Item.BIG_NUGGET) {
          const moneyGained = 10
          player.addMoney(moneyGained, true, null)
          const client = this.room.clients.find(
            (cli) => cli.auth.uid === player.id
          )
          client?.send(Transfer.PLAYER_INCOME, moneyGained)
        } else {
          player.items.push(...rewards)
        }
      }, 10000)
    }

    const nbTrees = getSynergyStep(player.synergies, Synergy.GRASS)
    for (let i = 0; i < nbTrees; i++) {
      player.berryTreesStages[i] = max(3)(player.berryTreesStages[i] + 1)
    }

    if (getSynergyStep(player.synergies, Synergy.GROUND) > 0) {
      player.board.forEach((pokemon, pokemonId) => {
        if (
          pokemon.types.has(Synergy.GROUND) &&
          !isOnBench(pokemon) &&
          pokemon.items.has(Item.CHEF_HAT) === false
        ) {
          const index =
            (pokemon.positionY - 1) * BOARD_WIDTH + pokemon.positionX
          const hasAlreadyReachedMaxDepth = player.groundHoles[index] === 5
          const isReachingMaxDepth = player.groundHoles[index] === 4
          if (!hasAlreadyReachedMaxDepth) {
            let buriedItem = isReachingMaxDepth
              ? player.buriedItems[index]
              : null
            if (
              pokemon.items.has(Item.EXPLORER_KIT) &&
              isReachingMaxDepth &&
              !buriedItem
            ) {
              if (chance(0.1, pokemon)) {
                buriedItem = Item.BIG_NUGGET
              } else if (chance(0.5, pokemon)) {
                buriedItem = Item.NUGGET
              } else {
                buriedItem = Item.COIN
              }
            }
            this.room.broadcast(Transfer.DIG, {
              pokemonId,
              buriedItem
            })
            this.room.clock.setTimeout(() => {
              player.groundHoles[index] = max(5)(player.groundHoles[index] + 1)
              if (pokemon.passive === Passive.ORTHWORM) {
                pokemon.addMaxHP(5)
              }
              player.board.forEach((pokemon) => {
                // Condition based evolutions on ground hole dig
                if (
                  pokemon.evolutionRule instanceof ConditionBasedEvolutionRule
                ) {
                  pokemon.evolutionRule.tryEvolve(
                    pokemon,
                    player,
                    this.state.stageLevel
                  )
                }
              })
            }, 1000)

            if (buriedItem) {
              this.room.clock.setTimeout(() => {
                if (buriedItem === Item.COIN) {
                  player.addMoney(1, true, null)
                } else if (buriedItem === Item.NUGGET) {
                  player.addMoney(3, true, null)
                } else if (buriedItem === Item.BIG_NUGGET) {
                  player.addMoney(10, true, null)
                } else if (buriedItem === Item.TREASURE_BOX) {
                  player.items.push(...pickNRandomIn(ItemComponents, 2))
                } else if (isIn(SynergyGems, buriedItem)) {
                  const type = SynergyGivenByGem[buriedItem]
                  player.bonusSynergies.set(
                    type,
                    (player.bonusSynergies.get(type) ?? 0) + 1
                  )
                  player.items.push(buriedItem)
                  player.updateSynergies()
                } else {
                  player.items.push(buriedItem)
                }
              }, 2500)
            }
          }
        }
      })
    }

    const rottingItems: Map<Item, Item> = new Map([
      // order matters to not convert several times in a row
      [Item.SIRUPY_APPLE, Item.LEFTOVERS],
      [Item.SWEET_APPLE, Item.SIRUPY_APPLE],
      [Item.TART_APPLE, Item.SWEET_APPLE]
    ])

    for (const rottingItem of rottingItems.keys()) {
      while (player.items.includes(rottingItem as Item)) {
        const index = player.items.indexOf(rottingItem)
        const newItem = rottingItems.get(rottingItem)
        if (index >= 0 && newItem) {
          // SEE https://github.com/colyseus/schema/issues/192
          player.items.splice(index, 1)
          player.items.push(newItem)
        }
      }
    }

    if (
      this.state.specialGameRule === SpecialGameRule.FIRST_PARTNER &&
      this.state.stageLevel > 1 &&
      this.state.stageLevel < 10 &&
      player.firstPartner
    ) {
      this.room.spawnOnBench(player, player.firstPartner, "spawn")
    }

    if (this.state.specialGameRule === SpecialGameRule.GO_BIG_OR_GO_HOME) {
      board.forEach((pokemon) => {
        pokemon.addMaxHP(5)
      })
    }

    if (
      player.pokemonsTrainingInDojo.some(
        (p) => p.returnStage === this.state.stageLevel
      )
    ) {
      const returningPokemons = player.pokemonsTrainingInDojo.filter(
        (p) => p.returnStage === this.state.stageLevel
      )
      returningPokemons.forEach((p) => {
        const substitute = schemaValues(player.board).find(
          (s) => s.name === Pkm.SUBSTITUTE && s.id === p.pokemon.id
        )
        if (!substitute) return
        p.pokemon.hp += [50, 100, 150][p.ticketLevel - 1] ?? 0
        p.pokemon.maxHP += [50, 100, 150][p.ticketLevel - 1] ?? 0
        p.pokemon.atk += [5, 10, 15][p.ticketLevel - 1] ?? 0
        p.pokemon.ap += [15, 30, 45][p.ticketLevel - 1] ?? 0
        p.pokemon.positionX = substitute.positionX
        p.pokemon.positionY = substitute.positionY
        player.board.delete(substitute.id)
        player.board.set(p.pokemon.id, p.pokemon)
        /* Set schemas needs to be reset to fix reactivity issues ; bug on Colyseus Schema ? */
        p.pokemon.types = new SetSchema<Synergy>(schemaValues(p.pokemon.types))
        p.pokemon.items = new SetSchema<Item>()
        p.pokemon.addItems(schemaValues(substitute.items), player)
        substitute.items.clear()
        this.room.checkEvolutionsAfterPokemonAcquired(player.id)
        player.pokemonsTrainingInDojo.splice(
          player.pokemonsTrainingInDojo.indexOf(p),
          1
        )
      })
    }

    board.forEach((pokemon) => {
      // Passives updating every stage
      const passiveEffects =
        PassiveEffects[pokemon.passive]?.filter(
          (p) => p instanceof OnStageStartEffect
        ) ?? []
      passiveEffects.forEach((effect) =>
        effect.apply({ pokemon, player, room: this.room })
      )

      // Held item effects on stage start
      const itemEffects =
        schemaValues(pokemon.items)
          .flatMap((item) => ItemEffects[item])
          ?.filter((p) => p instanceof OnStageStartEffect) ?? []
      itemEffects.forEach((effect) =>
        effect.apply({ pokemon, player, room: this.room })
      )

      // Condition based evolutions on stage start
      if (pokemon.evolutionRule instanceof ConditionBasedEvolutionRule) {
        pokemon.evolutionRule.tryEvolve(pokemon, player, this.state.stageLevel)
      }
    })

    // Unholdable item effects on stage start
    player.items.forEach((item) => {
      const itemEffects =
        ItemEffects[item]?.filter((p) => p instanceof OnStageStartEffect) ?? []
      itemEffects.forEach((effect) => effect.apply({ player, room: this.room }))
    })
  }

  checkForLazyTeam() {
    // force move on board some units if room available
    this.state.players.forEach((player, key) => {
      if (player.isBot) return

      const teamSize = this.room.getTeamSize(player.board)
      const maxTeamSize = getMaxTeamSize(
        player.experienceManager.level,
        this.state.specialGameRule
      )
      if (teamSize < maxTeamSize) {
        const numberOfPokemonsToMove = maxTeamSize - teamSize
        for (let i = 0; i < numberOfPokemonsToMove; i++) {
          const pokemon = schemaValues(player.board)
            .filter((p) => isOnBench(p) && p.canBePlaced)
            .sort((a, b) => a.positionX - b.positionX)[0]
          if (pokemon) {
            const coordinates = getFirstAvailablePositionOnBoard(
              player.board,
              pokemon.types.has(Synergy.DARK) && pokemon.range === 1
                ? 3
                : pokemon.range
            )

            if (coordinates) {
              pokemon.positionX = coordinates[0]
              pokemon.positionY = coordinates[1]
              changePokemonPosition(
                pokemon,
                coordinates[0],
                coordinates[1],
                player,
                this.state
              )
            }
          }
        }
        if (numberOfPokemonsToMove > 0) {
          player.updateSynergies()
          player.boardSize = this.room.getTeamSize(player.board)
        }
      }
    })
  }

  stopPickingPhase() {
    this.state.players.forEach((player) => {
      // auto pick choices if player did not choose in time
      player.choices
        .filter(
          (choice) =>
            choice.type === "addPick" ||
            choice.type === "item" ||
            choice.type === "unique"
        )
        .forEach((choice) => {
          const randomPick = randomBetween(
            0,
            choice.pokemons
              ? choice.pokemons.length - 1
              : choice.items.length - 1
          )
          this.room.pickChoice(player.id, choice.id, randomPick, true)
        })
    })
  }

  stopFightingPhase() {
    const isPVE = this.state.stageLevel in PVEStages

    this.state.simulations.forEach((simulation) => {
      if (!simulation.finished) {
        simulation.onFinish()
      }
      simulation.stop()
    })

    this.computeAchievements()
    this.checkDeath()
    const isGameFinished = this.checkEndGame()

    if (!isGameFinished) {
      this.state.stageLevel += 1
      this.room.setMetadata({ stageLevel: this.state.stageLevel })
      this.computeIncome(isPVE, this.state.specialGameRule)
      this.state.players.forEach((player: Player) => {
        player.wanderers.clear()
        if (player.alive) {
          // Fake bots XP bar
          if (player.isBot) {
            player.experienceManager.level = max(9)(
              Math.round(this.state.stageLevel / 2)
            )
          }

          // Give PVE rewards to players
          if (isPVE && player.history.at(-1)?.result === BattleResult.WIN) {
            while (player.pveRewards.length > 0) {
              const reward = player.pveRewards.pop()!
              player.items.push(reward)
            }

            if (player.pveRewardsPropositions.length > 0) {
              player.choices.push(
                new PlayerChoice({
                  type: "item",
                  items: schemaValues(player.pveRewardsPropositions)
                })
              )
              player.pveRewardsPropositions.clear()
            }
          }

          this.spawnBabyEggs(player, isPVE)

          // Update Pokémon that have special effects between stages
          player.board.forEach((pokemon, key) => {
            if (pokemon.evolutionRule) {
              if (pokemon.evolutionRule instanceof HatchEvolutionRule) {
                pokemon.evolutionRule.updateHatch(
                  pokemon,
                  player,
                  this.state.stageLevel
                )
              }
            }

            if (pokemon.action === PokemonActionState.TRAINING) {
              pokemon.addAttack(4)
              pokemon.addMaxHP(Math.ceil(0.1 * getPokemonData(pokemon.name).hp))
              pokemon.action = PokemonActionState.IDLE
            }
          })

          // Refreshes effects (Tapu Terrains, or if player lost Psychic 6 after Unown diseappeared)
          player.updateSynergies()

          // Refreshes shop
          if (!player.isBot) {
            if (!player.shopLocked) {
              if (player.shop.every((p) => Unowns.includes(p))) {
                // player stayed on unown shop and did nothing, so we remove its free roll
                player.shopFreeRolls -= 1
              }

              this.state.shop.assignShop(player, false, this.state)
            } else {
              this.state.shop.refillShop(player, this.state)
              player.shopLocked = false
            }
          }
        }
      })
      // Update Bots after unown deletion so unown in bot boards are not deleted
      this.state.botManager.updateBots()
    }
  }

  stopTownPhase() {
    this.room.miniGame.stop(this.room.state)
    this.state.players.forEach((player: Player) => {
      player.wanderers.clear()
    })
  }

  initializeTownPhase() {
    this.state.phase = GamePhaseState.TOWN
    this.room.miniGame.initialize(this.state, this.room)

    const nbPlayersAlive = schemaValues(this.state.players).filter(
      (p) => p.alive
    ).length

    let minigamePhaseDuration = ITEM_CAROUSEL_BASE_DURATION
    if (PortalCarouselStages.includes(this.state.stageLevel)) {
      minigamePhaseDuration = PORTAL_CAROUSEL_BASE_DURATION
    } else if (this.state.stageLevel !== ItemCarouselStages[0]) {
      minigamePhaseDuration += nbPlayersAlive * 2000
    }
    if (this.state.townEncounter != null) {
      minigamePhaseDuration += 5000
    }
    this.state.time = minigamePhaseDuration

    this.state.players.forEach((player: Player) => {
      if (player.alive) {
        const itemsToSell = player.items.filter((item) =>
          isIn(ItemsSoldAtTown, item)
        )
        let totalMoneyGained = 0
        itemsToSell.forEach((item) => {
          player.money += ItemSellPricesAtTown[item] ?? 0
          totalMoneyGained += ItemSellPricesAtTown[item] ?? 0
          removeInArray<Item>(player.items, item)
        })
        if (totalMoneyGained > 0) {
          const client = this.room.clients.find(
            (cli) => cli.auth.uid === player.id
          )
          client?.send(Transfer.PLAYER_INCOME, totalMoneyGained)
        }
      }
    })
  }

  initializeFightingPhase() {
    this.state.simulations.clear()
    this.state.phase = GamePhaseState.FIGHT
    this.state.time = FIGHTING_PHASE_DURATION
    this.state.roundTime = Math.round(this.state.time / 1000)
    this.state.players.forEach((player: Player) => {
      if (player.alive) {
        player.registerPlayedPokemons()
      }
    })

    const node = this.state.mapNodes.get(this.state.currentNodeId)
    const snapshot = this.state.encounterSnapshot

    if (snapshot) {
      // Snapshot-based encounter (champion/E4/saved teams): full Player reconstruction
      const opponentPlayer = reconstructTeamAsPlayer(snapshot, this.state)

      if (this.state.encounterCrownedAt && this.state.difficultyMode < 2) {
        const elapsedMs = Date.now() - new Date(this.state.encounterCrownedAt).getTime()
        const isEasy = this.state.difficultyMode === 0
        const hpDecay = Math.floor(elapsedMs / ((isEasy ? 2.5 : 5) * 60 * 1000))
        const ppPenalty = Math.floor(elapsedMs / ((isEasy ? 5 : 10) * 60 * 1000))
        if (hpDecay > 0 || ppPenalty > 0) {
          opponentPlayer.board.forEach((pokemon) => {
            if (pokemon.positionY <= 0) return
            if (hpDecay > 0 && pokemon.hp > 50) {
              const reduction = Math.min(hpDecay, pokemon.hp - 50)
              if (reduction > 0) pokemon.addMaxHP(-reduction)
            }
            if (ppPenalty > 0) pokemon.maxPP = pokemon.maxPP + ppPenalty
          })
        }
        this.state.encounterCrownedAt = null
      }

      this.state.players.forEach((player: Player) => {
        if (player.alive) {
          player.opponentId = opponentPlayer.id
          player.opponentName = this.state.encounterName || snapshot.name
          player.opponentAvatar = snapshot.avatar
          player.opponentTitle = (node?.nodeType === MapNodeType.ELITE_FOUR ? "ELITE FOUR"
            : node?.nodeType === MapNodeType.CHAMPION ? "CHAMPION"
            : "TRAINER") as any
          player.team = Team.BLUE_TEAM

          const weather = getWeather(player, opponentPlayer, opponentPlayer.board)
          const simulation = new Simulation(
            crypto.randomUUID(),
            this.room,
            player,
            opponentPlayer,
            this.state.stageLevel,
            weather,
            false
          )
          player.simulationId = simulation.id
          this.state.simulations.set(simulation.id, simulation)
          simulation.start()
        }
      })
      this.state.encounterSnapshot = null
    } else if (this.state.spireEncounterBoard.length > 0) {
      // String-encoded encounter (wild/gym/elite/boss): existing reconstruction
      const board: [Pkm, number, number][] = []
      const encounterItems: Item[][] = []
      Array.from(this.state.spireEncounterBoard).forEach((entry: string) => {
        const parts = entry.split(",")
        board.push([parts[0] as Pkm, parseInt(parts[1]), parseInt(parts[2])])
        encounterItems.push(parts.slice(3) as Item[])
      })

      const encounter: SpireEncounter = {
        name: this.state.encounterName || node?.region || "Wild",
        avatar: board[0][0],
        board,
        items: encounterItems,
        bonusHP: this.state.encounterBonusHP || undefined,
        bonusAtk: this.state.encounterBonusAtk || undefined,
        bonusDef: this.state.encounterBonusDef || undefined,
        bonusSpeDef: this.state.encounterBonusSpeDef || undefined,
        bonusAP: this.state.encounterBonusAP || undefined
      }

      this.state.players.forEach((player: Player) => {
        if (player.alive) {
          player.opponentId = "pve"
          player.opponentName = encounter.name
          player.opponentAvatar = getAvatarString(
            PkmIndex[encounter.avatar],
            false
          )
          player.opponentTitle = (node?.nodeType === MapNodeType.GYM_LEADER ? "GYM LEADER"
            : node?.nodeType === MapNodeType.ELITE ? "ELITE"
            : node?.nodeType === MapNodeType.UNLOCK ? "UNLOCK"
            : node?.nodeType === MapNodeType.LEGENDARY_BOSS ? "BOSS"
            : "WILD") as any
          player.team = Team.BLUE_TEAM

          const pveBoard = PokemonFactory.makePveBoard(
            { board: encounter.board, name: encounter.name as any, avatar: encounter.avatar },
            false,
            null
          )
          const pvePokemons = Array.from(pveBoard.values())
          if (encounter.items) {
            encounter.items.forEach((itemList, i) => {
              if (pvePokemons[i] && itemList.length > 0) {
                itemList.forEach((item) => pvePokemons[i].items.add(item))
              }
            })
          }
          if (encounter.bonusHP || encounter.bonusAtk || encounter.bonusDef || encounter.bonusSpeDef || encounter.bonusAP || this.state.encounterBonusPP) {
            pvePokemons.forEach((pkm) => {
              if (encounter.bonusHP) pkm.addMaxHP(encounter.bonusHP)
              if (encounter.bonusAtk) pkm.addAttack(encounter.bonusAtk)
              if (encounter.bonusDef) pkm.addDefense(encounter.bonusDef)
              if (encounter.bonusSpeDef) pkm.addSpecialDefense(encounter.bonusSpeDef)
              if (encounter.bonusAP) pkm.addAbilityPower(encounter.bonusAP)
              if (this.state.encounterBonusPP) pkm.maxPP += this.state.encounterBonusPP
            })
          }
          if (this.state.challengeItem && node?.nodeType === MapNodeType.WILD_BATTLE) {
            pvePokemons.forEach((pkm) => {
              pkm.items.add(this.state.challengeItem as Item)
            })
          }
          const pveEffects = new Effects()
          const pveBonusSynergies = new Map<Synergy, number>()
          if (this.state.encounterInventory.length > 0) {
            Array.from(this.state.encounterInventory).forEach((item) => {
              const synType = SynergyGivenByGem[item as SynergyGem]
              if (synType) {
                pveBonusSynergies.set(synType, (pveBonusSynergies.get(synType) ?? 0) + 1)
              }
            })
          }
          const pveSynergies = new Synergies(
            computeSynergies(Array.from(pveBoard.values()), pveBonusSynergies.size > 0 ? pveBonusSynergies : undefined)
          )
          pveEffects.update(pveSynergies, pveBoard)
          const pveEffectsSet = new Set<EffectEnum>()
          pveEffects.forEach((e) => pveEffectsSet.add(e))

          cookDishesForPveBoard(pveBoard, pveSynergies)

          const weather = getWeather(player, null, pveBoard)
          const simulation = new Simulation(
            crypto.randomUUID(),
            this.room,
            player,
            { id: "pve", board: pveBoard },
            this.state.stageLevel,
            weather,
            false,
            pveEffectsSet
          )
          player.simulationId = simulation.id
          this.state.simulations.set(simulation.id, simulation)
          simulation.start()
        }
      })
    } else {
      const matchups = selectMatchups(this.state)
      this.state.simulationPaused = true // 2 seconds pause for portal transition animation

      matchups.forEach((matchup) => {
        const { bluePlayer, redPlayer, ghost } = matchup
        const weather = getWeather(
          bluePlayer,
          redPlayer,
          redPlayer.board,
          ghost
        )
        const simulationId = crypto.randomUUID()

        bluePlayer.simulationId = simulationId
        bluePlayer.team = Team.BLUE_TEAM
        bluePlayer.opponents.set(
          redPlayer.id,
          (bluePlayer.opponents.get(redPlayer.id) ?? 0) + 1
        )
        bluePlayer.opponentId = redPlayer.id
        bluePlayer.opponentName = matchup.ghost
          ? `Ghost of ${redPlayer.name}`
          : redPlayer.name
        bluePlayer.opponentAvatar = redPlayer.avatar
        bluePlayer.opponentTitle = redPlayer.title ?? ""

        if (!matchup.ghost) {
          redPlayer.simulationId = simulationId
          redPlayer.team = Team.RED_TEAM
          redPlayer.opponents.set(
            bluePlayer.id,
            (redPlayer.opponents.get(bluePlayer.id) ?? 0) + 1
          )
          redPlayer.opponentId = bluePlayer.id
          redPlayer.opponentName = bluePlayer.name
          redPlayer.opponentAvatar = bluePlayer.avatar
          redPlayer.opponentTitle = bluePlayer.title ?? ""
        }

        const simulation = new Simulation(
          simulationId,
          this.room,
          bluePlayer,
          redPlayer,
          this.state.stageLevel,
          weather,
          matchup.ghost
        )

        this.state.simulations.set(simulation.id, simulation)
        setTimeout(() => {
          this.state.simulationPaused = false
          simulation.start()
        }, 2500) // 2 seconds for portal transition animation, 500 ms for latency
      })
    }

    if (this.state.specialGameRule === SpecialGameRule.UNOWN_SPELL) {
      this.state.simulations.forEach((simulation) => {
        const unown = pickRandomIn(UnownsForScribble)
        ;[simulation.bluePlayer, simulation.redPlayer].forEach((player) => {
          if (
            !player ||
            (simulation.isGhostBattle && player === simulation.redPlayer)
          )
            return
          const wanderer = player.spawnWanderingPokemon({
            pkm: unown,
            shiny: false,
            type: WandererType.UNOWN_SPELL,
            behavior: WandererBehavior.SPECTATE
          })
          this.clock.setTimeout(() => {
            player.wanderers.delete(wanderer.id)
            if (simulation.finished) return
            const caster = new PokemonEntity(
              PokemonFactory.createPokemonFromName(unown),
              9,
              2,
              player.team,
              simulation
            )
            castAbility(caster.skill, caster, simulation.board, null, false)
          }, 10000)
        })
      })
    }
  }

  spawnWanderingPokemons() {
    return // wandering NPCs disabled — visual-only feature that causes duplicate lag

    const isPVE = this.state.stageLevel in PVEStages

    this.state.players.forEach((player: Player) => {
      if (player.alive && !player.isBot) {
        const client = this.room.clients.find(
          (cli) => cli.auth.uid === player.id
        )
        if (!client) return

        if (chance(UNOWN_ENCOUNTER_CHANCE)) {
          player.spawnWanderingPokemon({
            pkm: pickRandomIn(Unowns),
            shiny: chance(SHINY_UNOWN_ENCOUNTER_CHANCE),
            type: WandererType.UNOWN,
            behavior: WandererBehavior.RUN_THROUGH,
            delay: Math.round((5 + 15 * Math.random()) * 1000)
          })
        }

        if (this.state.outlawStage != null) {
          if (this.state.stageLevel === this.state.outlawStage) {
            player.spawnWanderingPokemon({
              pkm: Pkm.DROWZEE,
              shiny: false,
              type: WandererType.OUTLAW,
              behavior: WandererBehavior.RUN_THROUGH,
              delay: Math.round((5 + 15 * Math.random()) * 1000)
            })
          } else if (this.state.stageLevel < this.state.outlawStage) {
            const magnezoneChance = chance(this.state.stageLevel * 0.04)
            if (magnezoneChance) {
              player.spawnWanderingPokemon({
                pkm: Pkm.MAGNEZONE,
                shiny: false,
                type: WandererType.DIALOG,
                behavior: WandererBehavior.RUN_THROUGH,
                delay: Math.round((5 + 15 * Math.random()) * 1000)
              })
            } else {
              for (let i = 0; i < randomBetween(1, 3); i++) {
                player.spawnWanderingPokemon({
                  pkm: Pkm.MAGNEMITE,
                  shiny: false,
                  type: WandererType.DIALOG,
                  behavior: WandererBehavior.RUN_THROUGH,
                  delay: Math.round((5 + 15 * Math.random()) * 1000)
                })
              }
            }
          } else if (this.state.stageLevel > this.state.outlawStage) {
            removeInArray(player.items, Item.WANTED_NOTICE)
          }
        }

        if (
          isPVE &&
          this.state.specialGameRule === SpecialGameRule.GOTTA_CATCH_EM_ALL
        ) {
          const nbPokemonsToSpawn = Math.ceil(this.state.stageLevel / 2)
          for (let i = 0; i < nbPokemonsToSpawn; i++) {
            const pkm = this.state.shop.pickPokemon(
              player,
              this.state,
              -1,
              true
            )
            player.spawnWanderingPokemon({
              pkm,
              type: WandererType.CATCHABLE,
              behavior: WandererBehavior.RUN_THROUGH,
              delay: 4000 + i * 400
            })
          }
        }
      }
    })
  }

  spawnBabyEggs(player: Player, isPVE: boolean) {
    const hasBabyActive =
      player.effects.has(EffectEnum.HATCHER) ||
      player.effects.has(EffectEnum.BREEDER) ||
      player.effects.has(EffectEnum.GOLDEN_EGGS)
    const hasLostLastBattle =
      player.history.at(-1)?.result === BattleResult.DEFEAT
    const eggsOnBench = schemaValues(player.board).filter(
      (p) => p.name === Pkm.EGG
    )
    const nbOfGoldenEggsOnBench = eggsOnBench.filter((p) => p.shiny).length
    let nbEggsFound = 0
    let goldenEggFound = false

    if (hasLostLastBattle && hasBabyActive) {
      const EGG_CHANCE = 0.1
      const GOLDEN_EGG_CHANCE = 0.05
      const playerEggChanceStacked = player.eggChance
      const playerGoldenEggChanceStacked = player.goldenEggChance
      const babies = schemaValues(player.board).filter(
        (p) => !isOnBench(p) && p.types.has(Synergy.BABY)
      )

      for (const baby of babies) {
        if (
          player.effects.has(EffectEnum.GOLDEN_EGGS) &&
          nbOfGoldenEggsOnBench === 0 &&
          chance(GOLDEN_EGG_CHANCE, baby)
        ) {
          nbEggsFound++
          goldenEggFound = true
        } else if (chance(EGG_CHANCE, baby)) {
          nbEggsFound++
        }
        if (player.effects.has(EffectEnum.GOLDEN_EGGS) && !goldenEggFound) {
          player.goldenEggChance += max(0.1)(
            Math.pow(GOLDEN_EGG_CHANCE, 1 - baby.luck / 200)
          )
        } else if (
          player.effects.has(EffectEnum.HATCHER) &&
          nbEggsFound === 0
        ) {
          player.eggChance += max(0.2)(
            Math.pow(EGG_CHANCE, 1 - baby.luck / 100)
          )
        }
      }

      // Second chance with chance stacked after lose streaks
      if (
        nbEggsFound === 0 &&
        (player.effects.has(EffectEnum.BREEDER) ||
          player.effects.has(EffectEnum.GOLDEN_EGGS) ||
          chance(playerEggChanceStacked))
      ) {
        nbEggsFound = 1 // baby >= 5 guarantees at least 1 egg after a defeat
      }
      if (
        goldenEggFound === false &&
        player.effects.has(EffectEnum.GOLDEN_EGGS) &&
        nbOfGoldenEggsOnBench === 0 &&
        chance(playerGoldenEggChanceStacked)
      ) {
        goldenEggFound = true
      }
    } else if (!isPVE) {
      // winning a PvP fight resets the stacked egg chance
      player.eggChance = 0
      player.goldenEggChance = 0
    }

    if (
      this.state.specialGameRule === SpecialGameRule.OMELETTE_COOK &&
      [2, 3, 4].includes(this.state.stageLevel)
    ) {
      nbEggsFound = 1
    }

    for (let i = 0; i < nbEggsFound; i++) {
      if (getFreeSpaceOnBench(player.board) === 0) continue
      const isGoldenEgg =
        goldenEggFound && i === 0 && nbOfGoldenEggsOnBench === 0
      giveRandomEgg(player, isGoldenEgg)
      if (player.effects.has(EffectEnum.HATCHER)) {
        player.eggChance = 0 // getting an egg resets the stacked egg chance
      }
      if (player.effects.has(EffectEnum.GOLDEN_EGGS) && isGoldenEgg) {
        player.goldenEggChance = 0 // getting a golden egg resets the stacked egg chance
      }
    }
  }
}

export class OnOverwriteBoardCommand extends Command<GameRoom> {
  execute({
    playerId,
    board
  }: {
    playerId: string
    board: IDetailledPokemon[]
  }) {
    const player = this.room.state.players.get(playerId)
    if (!player || player.role !== Role.ADMIN) return
    player.board.clear()
    board.forEach((p) => {
      const pokemon = PokemonFactory.createPokemonFromName(p.name, p)
      pokemon.positionX = p.x
      pokemon.positionY = p.y
      p.items.forEach((item) => pokemon.items.add(item))
      player.board.set(pokemon.id, pokemon)
    })
    player.updateSynergies()
    player.boardSize = this.room.getTeamSize(player.board)
  }
}

function changePokemonPosition(
  pokemon: Pokemon,
  x: number,
  y: number,
  player: Player,
  state: GameState
) {
  pokemon.onChangePosition(x, y, player, state)
  if (y === 0 && pokemon.tm && TMPerAbility.has(pokemon.tm)) {
    player.items.push(TMPerAbility.get(pokemon.tm)!)
    pokemon.tm = Ability.DEFAULT
    const { skill: baseSkill, pp: baseMaxPP } = getPokemonData(pokemon.name)
    pokemon.skill = baseSkill
    pokemon.maxPP = baseMaxPP
  }
}

function cookDishesForPveBoard(
  board: MapSchema<Pokemon>,
  synergies: Synergies
) {
  const gourmetCount = synergies.get(Synergy.GOURMET) ?? 0
  if (gourmetCount < 3) return

  const gourmetLevel = getSynergyStep(synergies, Synergy.GOURMET)
  const nbHats = gourmetCount >= 5 ? 2 : 1
  const boardPokemon = Array.from(board.values()).filter((p) => !isOnBench(p))
  const gourmetPokemon = boardPokemon.filter((p) => p.types.has(Synergy.GOURMET))
  gourmetPokemon.sort((a, b) => getUnitScore(b) - getUnitScore(a))

  const chefs = gourmetPokemon.slice(0, nbHats)
  for (const chef of chefs) {
    chef.items.add(Item.CHEF_HAT)
  }

  const nbDishes = [0, 1, 2, 2][gourmetLevel] ?? 2
  for (const chef of chefs) {
    let dish = DishByPkm[chef.name]
    if (chef.items.has(Item.COOKING_POT)) {
      dish = Item.HEARTY_STEW
    } else if (
      chef.name.startsWith("ARCEUS") ||
      chef.name === Pkm.KECLEON ||
      chef.items.has(Item.GOURMET_MEMORY)
    ) {
      dish = Item.SANDWICH
    }
    if (!dish || nbDishes <= 0) continue

    let dishes = Array.from({ length: nbDishes }, () => dish!)
    if (dish === Item.BERRIES) {
      dishes = pickNRandomIn(
        NonSpecialBerries.filter((i) => !chef.items.has(i)),
        nbDishes
      )
    }
    if (dish === Item.MUSHROOMS) {
      dishes = Array.from(
        { length: nbDishes },
        () =>
          randomWeighted({
            [Item.TINY_MUSHROOM]: 77,
            [Item.BIG_MUSHROOM]: 20,
            [Item.BALM_MUSHROOM]: 3
          }) ?? Item.TINY_MUSHROOM
      )
    }
    if (dish === Item.SWEETS) {
      dishes = pickNRandomIn(Sweets, nbDishes)
    }

    for (let dish of dishes) {
      if (isIn(DishesGoingToInventory, dish)) continue
      let candidates = boardPokemon.filter(
        (p) =>
          p.canEat &&
          !p.dishes.has(dish) &&
          distanceC(
            chef.positionX,
            chef.positionY,
            p.positionX,
            p.positionY
          ) === 1
      )
      if (dish === Item.HERBA_MYSTICA) {
        candidates = candidates.filter((p) =>
          HerbaMysticas.every((herba) => !p.dishes.has(herba))
        )
      }
      candidates.sort((a, b) => getUnitScore(b) - getUnitScore(a))
      const target = candidates[0] ?? chef
      if (!target.canEat) continue
      if (dish === Item.HERBA_MYSTICA) {
        const flavors: Item[] = []
        if (target.types.has(Synergy.FAIRY)) flavors.push(Item.HERBA_MYSTICA_SWEET)
        if (target.types.has(Synergy.PSYCHIC)) flavors.push(Item.HERBA_MYSTICA_SPICY)
        if (target.types.has(Synergy.ELECTRIC)) flavors.push(Item.HERBA_MYSTICA_SOUR)
        if (target.types.has(Synergy.GRASS)) flavors.push(Item.HERBA_MYSTICA_BITTER)
        if (flavors.length === 0) flavors.push(Item.HERBA_MYSTICA_SALTY)
        dish = pickRandomIn(flavors)
      }
      target.dishes.add(dish)
    }
  }
}
