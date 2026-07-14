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
  type TreasureBoxReward
} from "../../config"
import BotManager from "../../core/bot-manager"
import Simulation from "../../core/simulation"
import { FloatingItem } from "../../models/colyseus-models/floating-item"
import { MapEdge, MapNode } from "../../models/colyseus-models/map-node"
import Player from "../../models/colyseus-models/player"
import { PokemonAvatarModel } from "../../models/colyseus-models/pokemon-avatar"
import { Portal, SynergySymbol } from "../../models/colyseus-models/portal"
import Shop from "../../models/shop"
import type { SpireEncounter } from "../../models/spire-encounters"
import type { ShopItem } from "../../models/spire-shops"
import type { SpireEliteDesignData } from "../../services/elite-design"
import type { TeamSnapshot } from "../../services/team-snapshot"
import type { EloRank } from "../../types/enum/EloRank"
import { GameMode, GamePhaseState } from "../../types/enum/Game"
import type { Item } from "../../types/enum/Item"
import type { Pkm } from "../../types/enum/Pokemon"
import { SpecialGameRule } from "../../types/enum/SpecialGameRule"
import type { TownEncounter } from "../../types/enum/TownEncounter"
import { Weather } from "../../types/enum/Weather"
import {
  counterRandom,
  hashStringToUint32,
  pickRandomIn,
  withRandomSource
} from "../../utils/random"
export interface PendingRunEncounter {
  nodeId: string
  encounter: SpireEncounter
  snapshot: TeamSnapshot | null
  crownedAt: string | null
  eliteDesign: SpireEliteDesignData | null
}

export interface PersistedShopItem extends ShopItem {
  claimed?: boolean
}

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
  // One-shot guards for the Act-4/5 "finale" fights. Set true the moment the
  // Champion / Arceus fight STARTS and persisted in the saved run, so a mid-fight
  // quit can't resume back into the fight and retry it (save-scumming the Arceus
  // damage leaderboard or the champion fight). championChallenged is reset once the
  // champion fight resolves; arceusChallenged ends the run. See resumeGame's forfeit.
  @type("boolean") championChallenged: boolean = false
  @type("boolean") arceusChallenged: boolean = false
  @type("boolean") isEndless: boolean = false
  // Spire mode: a third run mode (alongside classic + endless). 16-floor acts,
  // class + starting relic, relic rewards, ends at Act 3 (no Elite Four/Arceus),
  // its own difficulty curve. `spireClass` is the chosen SpireClass id.
  @type("boolean") isSpire: boolean = false
  @type("string") spireClass: string = ""
  // Tutorial mode: a fully-scripted single-act run (normal-mode ruleset) with a
  // fixed map and guided dialog at each stage. Never saved/resumed, never counted
  // toward stats/leaderboards. Gated by `isTutorial`.
  @type("boolean") isTutorial: boolean = false
  // Elite Designer test sandbox: true while both teams are staged on the board in a
  // preview (PICK) and waiting for the player to press "Begin" to start the fight.
  @type("boolean") eliteTestAwaitingBegin: boolean = false
  @type("float32") gameSpeed: number = 1
  @type(["string"]) spireEncounterBoard = new ArraySchema<string>()
  @type("uint16") encounterDifficulty: number = 0
  @type("uint8") encounterPokemonCount: number = 0
  @type("uint8") encounterTotalStars: number = 0
  @type("uint8") encounterTotalItems: number = 0
  @type("string") encounterName: string = ""
  @type("string") encounterAvatar: string = ""
  @type(["string"]) encounterInventory = new ArraySchema<string>()
  // Gold the snapshot opponent (Elite Four / Champion / async) held — shown to the
  // player and used by gold-scaling effects on the reconstructed team. 0 for PVE.
  @type("uint16") encounterMoney: number = 0
  @type("uint16") encounterBonusHP: number = 0
  @type("uint8") encounterBonusAtk: number = 0
  @type("uint8") encounterBonusDef: number = 0
  @type("uint8") encounterBonusSpeDef: number = 0
  @type("uint8") encounterBonusAP: number = 0
  @type("uint8") encounterBonusPP: number = 0
  challengeItem: string = ""
  // Unique id for this run (assigned at start, preserved across resume). Used by
  // the save layer to fence stale writes: a backward save is only blocked when it
  // belongs to the SAME run; a different run (e.g. a freshly started one) may take
  // over the save slot. Plain field — not synced to clients.
  runId: string = ""
  // Counter-based RNG state for deterministic run progression. Combat never
  // enters withRunRng(), so its randomness remains independent and unchanged.
  runRngSeed = 0
  runRngCounter = 0
  // Exact materializations that must survive room reconstruction.
  pendingEncounter: PendingRunEncounter | null = null
  eliteDesignAssignments = new Map<string, SpireEliteDesignData>()
  spireShopItems: PersistedShopItem[] = []
  // Exactly-once guard for the post-battle transaction.
  postBattleEffectsNodeId = ""
  spireEventResolved = false
  encounterSnapshot: TeamSnapshot | null = null
  encounterCrownedAt: string | null = null
  // The combat node the player is currently picking/fighting, set on node select
  // and cleared once the fight resolves (reward/map phase). Persisted in the save
  // so a mid-PICK/FIGHT disconnect resumes back into that fight instead of being
  // stranded on the map with the node already consumed (hard-locks on the floor-20
  // boss, which has no successor node). Non-synced — server/persistence only.
  pendingFightNodeId: string = ""
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

  initializeRunRng(runId = this.runId) {
    this.runRngSeed = hashStringToUint32(runId)
    this.runRngCounter = 0
  }

  nextRunRandom(): number {
    const value = counterRandom(this.runRngSeed, this.runRngCounter)
    this.runRngCounter = (this.runRngCounter + 1) >>> 0
    return value
  }

  withRunRng<T>(operation: () => T): T {
    return withRandomSource(() => this.nextRunRandom(), operation)
  }

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
