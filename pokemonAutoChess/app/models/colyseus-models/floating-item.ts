import { Schema, type } from "@colyseus/schema"
import { IFloatingItem } from "../../types"
import { Item } from "../../types/enum/Item"

export class FloatingItem extends Schema implements IFloatingItem {
  @type("string") id: string
  @type("string") name: Item
  @type("number") x: number
  @type("number") y: number
  @type("string") avatarId: string = ""
  @type("uint8") price: number = 0
  @type("string") pokemonName: string = ""
  index: number

  constructor(name: Item, x: number, y: number, index: number, price: number = 0, pokemonName: string = "") {
    super()
    this.id = crypto.randomUUID()
    this.name = name
    this.x = x
    this.y = y
    this.index = index
    this.price = price
    this.pokemonName = pokemonName
  }
}
