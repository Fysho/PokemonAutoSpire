import { Schema, type } from "@colyseus/schema"

export enum MapNodeType {
  WILD_BATTLE = "WILD_BATTLE",
  GYM_LEADER = "GYM_LEADER",
  ELITE = "ELITE",
  POKEMART = "POKEMART",
  POKEMON_CENTER = "POKEMON_CENTER",
  MYSTERY_ENCOUNTER = "MYSTERY_ENCOUNTER",
  LEGENDARY_BOSS = "LEGENDARY_BOSS"
}

export class MapNode extends Schema {
  @type("string") id: string
  @type("string") nodeType: MapNodeType
  @type("uint8") x: number
  @type("uint8") y: number
  @type("uint8") act: number
  @type("uint8") floor: number
  @type("boolean") visited: boolean = false
  @type("boolean") available: boolean = false
  @type("string") encounterKey: string = ""
  @type("string") region: string = ""
  @type("int8") gymLeaderIndex: number = -1
  @type("boolean") gymLeaderIsEarly: boolean = true
  @type("string") gymLeaderSynergy: string = ""
  @type("int8") eliteEncounterIndex: number = -1

  constructor(
    id: string,
    nodeType: MapNodeType,
    x: number,
    y: number,
    act: number,
    floor: number,
    encounterKey: string = "",
    region: string = ""
  ) {
    super()
    this.id = id
    this.nodeType = nodeType
    this.x = x
    this.y = y
    this.act = act
    this.floor = floor
    this.encounterKey = encounterKey
    this.region = region
  }
}

export class MapEdge extends Schema {
  @type("string") from: string
  @type("string") to: string

  constructor(from: string, to: string) {
    super()
    this.from = from
    this.to = to
  }
}
