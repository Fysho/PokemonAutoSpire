import {
  ArraySchema,
  MapSchema,
  Schema,
  SetSchema,
  type
} from "@colyseus/schema"
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  getTreasureBoxReward,
  StageDuration,
  TreasureBoxReward
} from "../../config"
import BotManager from "../../core/bot-manager"
import Simulation from "../../core/simulation"
import { FloatingItem } from "../../models/colyseus-models/floating-item"
import { MapEdge, MapNode } from "../../models/colyseus-models/map-node"
import Player from "../../models/colyseus-models/player"
import { PokemonAvatarModel } from "../../models/colyseus-models/pokemon-avatar"
import { Portal, SynergySymbol } from "../../models/colyseus-models/portal"
import Shop from "../../models/shop"
import { EloRank } from "../../types/enum/EloRank"
import { GameMode, GamePhaseState } from "../../types/enum/Game"
import { Item } from "../../types/enum/Item"
import { Pkm } from "../../types/enum/Pokemon"
import { SpecialGameRule } from "../../types/enum/SpecialGameRule"
import { TownEncounter } from "../../types/enum/TownEncounter"
import { Weather } from "../../types/enum/Weather"
import { TeamSnapshot } from "../../services/team-snapshot"
import { pickRandomIn } from "../../utils/random"

export default class GameState extends Schema {
  @type("string") afterGameId = ""
  @type("uint8") roundTime = StageDuration[0]
  @type("uint8") phase = GamePhaseState.MAP
  @type({ map: Player }) players = new MapSchema<Player>()
  @type({ map: PokemonAvatarModel }) avatars =
    new MapSchema<PokemonAvatarModel>()
  @type({ map: FloatingItem }) floatingItems = new MapSchema<FloatingItem>()
  @type({ map: Portal }) portals = new MapSchema<Portal>()
  @type({ map: SynergySymbol }) symbols = new MapSchema<SynergySymbol>()
  @type(["string"]) additionalPokemons = new ArraySchema<Pkm>()
  @type("uint8") stageLevel = 0
  @type("string") weather: Weather
  @type("boolean") shinyEncounter = false
  @type("boolean") noElo = false
  @type("string") gameMode: GameMode = GameMode.CUSTOM_LOBBY
  @type({ set: "string" }) spectators = new SetSchema<string>()
  @type({ map: Simulation }) simulations = new MapSchema<Simulation>()
  @type("uint8") lightX = 0
  @type("uint8") lightY = 0
  @type("string") specialGameRule: SpecialGameRule | null = null
  @type("string") townEncounter: TownEncounter | null = null

  // Spire fields
  @type("uint8") difficultyMode: number = 1 // 0=easy, 1=normal, 2=hard, 3=impossible
  @type("uint8") currentAct: number = 1
  @type("uint8") currentFloor: number = 0
  @type({ map: MapNode }) mapNodes = new MapSchema<MapNode>()
  @type([MapEdge]) mapEdges = new ArraySchema<MapEdge>()
  @type("string") currentNodeId: string = ""
  @type("int16") runHP: number = 100
  @type("boolean") runComplete: boolean = false
  @type("boolean") runFailed: boolean = false
  @type("boolean") eliteFourAvailable: boolean = false
  @type("float32") gameSpeed: number = 1
  @type(["string"]) spireEncounterBoard = new ArraySchema<string>()
  @type("uint16") encounterDifficulty: number = 0
  @type("uint8") encounterPokemonCount: number = 0
  @type("uint8") encounterTotalStars: number = 0
  @type("uint8") encounterTotalItems: number = 0
  @type("string") encounterName: string = ""
  @type(["string"]) encounterInventory = new ArraySchema<string>()
  @type("uint16") encounterBonusHP: number = 0
  @type("uint8") encounterBonusAtk: number = 0
  @type("uint8") encounterBonusDef: number = 0
  @type("uint8") encounterBonusSpeDef: number = 0
  @type("uint8") encounterBonusAP: number = 0
  @type("uint8") encounterBonusPP: number = 0
  challengeItem: string = ""
  encounterSnapshot: TeamSnapshot | null = null
  encounterCrownedAt: string | null = null
  @type(["uint8"]) encounterGroundHoles = new ArraySchema<number>()
  @type(["string"]) encounterSynergies = new ArraySchema<string>()
  @type("uint32") arceusDamageDealt: number = 0
  @type("boolean") isNewArceusRecord: boolean = false
  @type("uint32") previousArceusRecord: number = 0
  @type("string") previousArceusHolder: string = ""
  @type("string") spireEventName: string = ""
  @type("string") spireEventDescription: string = ""
  @type("string") spireEventPortrait: string = ""
  @type(["string"]) spireEventChoiceLabels = new ArraySchema<string>()
  @type(["string"]) spireEventChoiceDescs = new ArraySchema<string>()
  time = StageDuration[0] * 1000
  updatePhaseNeeded = false
  botManager: BotManager = new BotManager()
  shop: Shop = new Shop()
  simulationPaused = false
  gameFinished = false
  playerSpireRegion = "town"
  gameLoaded = false
  name: string
  startTime: number
  endTime: number | undefined = undefined
  preparationId: string
  townEncounters: Set<TownEncounter> = new Set<TownEncounter>()
  pveRewards: Item[] = []
  pveRewardsPropositions: Item[] = []
  minRank: EloRank | null = null
  maxRank: EloRank | null = null
  outlawStage: number | null = null
  treasureBoxRewardGiven: TreasureBoxReward = getTreasureBoxReward()

  constructor(
    preparationId: string,
    name: string,
    noElo: boolean,
    gameMode: GameMode,
    minRank: EloRank | null,
    maxRank: EloRank | null,
    specialGameRule: SpecialGameRule | null
  ) {
    super()
    this.preparationId = preparationId
    this.startTime = Date.now()
    this.name = name
    this.noElo = noElo
    this.gameMode = gameMode
    this.minRank = minRank
    this.maxRank = maxRank
    this.weather = Weather.NEUTRAL

    if (gameMode === GameMode.SCRIBBLE) {
      this.specialGameRule = pickRandomIn(Object.values(SpecialGameRule))
    } else {
      this.specialGameRule = specialGameRule
    }
  }
}
