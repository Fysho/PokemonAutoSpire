import { Schema, type } from "@colyseus/schema"
import { ExpTable, SpireExpTable } from "../../config"
import type { IExperienceManager } from "../../types"
import type { SpecialGameRule } from "../../types/enum/SpecialGameRule"

export default class ExperienceManager
  extends Schema
  implements IExperienceManager
{
  @type("uint8") level: number
  @type("uint16") experience: number
  @type("uint16") expNeeded: number
  @type("uint8") maxLevel: number
  // Runtime-only (not synced): selects Spire's level-up curve + level-1 start.
  isSpireMode = false

  constructor() {
    super()
    this.level = 2
    this.experience = 0
    this.expNeeded = ExpTable[2]
    this.maxLevel = 9
  }

  get table(): { [key: number]: number } {
    return this.isSpireMode ? SpireExpTable : ExpTable
  }

  // Switch to Spire's curve. Fresh runs start at level 1; on resume pass
  // resetLevel=false to keep the restored level.
  useSpireMode(resetLevel = true) {
    this.isSpireMode = true
    if (resetLevel) {
      this.level = 1
      this.experience = 0
    }
    this.expNeeded = this.table[this.level]
  }

  canLevelUp() {
    return this.level < this.maxLevel
  }

  addExperience(quantity: number) {
    let expToAdd = quantity
    while (this.checkForLevelUp(expToAdd)) {
      expToAdd -= this.table[this.level]
      this.level += 1
      this.expNeeded = this.table[this.level]
    }
  }

  checkForLevelUp(quantity: number) {
    if (
      this.experience + quantity >= this.table[this.level] &&
      this.level < this.maxLevel
    ) {
      return true
    } else {
      this.experience += quantity
      return false
    }
  }
}

export function getLevelUpCost(specialGameRule?: SpecialGameRule | null) {
  const cost = 4
  return cost
}
