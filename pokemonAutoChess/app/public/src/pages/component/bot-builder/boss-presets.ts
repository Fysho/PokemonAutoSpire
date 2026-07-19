import { Item } from "../../../../../types/enum/Item"
import { Pkm } from "../../../../../types/enum/Pokemon"

export interface BossPreset {
  name: string
  act: 1 | 2 | 3
  icon: Pkm
  board: [Pkm, number, number][]
  items: Item[][]
  bonus: Record<string, number>
}

// Exact copies of the built-in LEGENDARY_BOSSES encounters. Their reward
// switches load in "default" mode in the designer, preserving the live
// signature-item rules and difficulty-aware Shiny/Tool choices.
export const BOSS_PRESETS: BossPreset[] = [
  {
    name: "Mewtwo & Mew",
    act: 1,
    icon: Pkm.MEWTWO,
    board: [
      [Pkm.MEWTWO, 4, 3],
      [Pkm.MEW, 2, 2]
    ],
    items: [[Item.CHOICE_SPECS], [Item.SHELL_BELL]],
    bonus: { bonusHP: 100, bonusAtk: 5, bonusAP: 20 }
  },
  {
    name: "Tower Duo",
    act: 1,
    icon: Pkm.LUGIA,
    board: [
      [Pkm.LUGIA, 3, 3],
      [Pkm.HO_OH, 5, 3]
    ],
    items: [[Item.AQUA_EGG], [Item.SHELL_BELL]],
    bonus: { bonusHP: 100, bonusAtk: 5, bonusAP: 20 }
  },
  {
    name: "Lake Guardians",
    act: 1,
    icon: Pkm.AZELF,
    board: [
      [Pkm.AZELF, 2, 2],
      [Pkm.MESPRIT, 4, 3],
      [Pkm.UXIE, 6, 2]
    ],
    items: [[Item.CHOICE_SPECS], [Item.SOUL_DEW], [Item.POWER_LENS]],
    bonus: { bonusHP: 100, bonusAtk: 5, bonusAP: 20 }
  },
  {
    name: "Weather Trio",
    act: 2,
    icon: Pkm.MEGA_RAYQUAZA,
    board: [
      [Pkm.PRIMAL_GROUDON, 2, 2],
      [Pkm.PRIMAL_KYOGRE, 6, 2],
      [Pkm.MEGA_RAYQUAZA, 4, 3]
    ],
    items: [
      [Item.RED_ORB, Item.ROCKY_HELMET, Item.ASSAULT_VEST],
      [Item.BLUE_ORB, Item.SHELL_BELL, Item.POWER_LENS],
      [Item.GREEN_ORB, Item.SCOPE_LENS, Item.RAZOR_FANG]
    ],
    bonus: { bonusHP: 200, bonusAtk: 10, bonusAP: 40 }
  },
  {
    name: "Legendary Birds",
    act: 2,
    icon: Pkm.ARTICUNO,
    board: [
      [Pkm.ARTICUNO, 2, 3],
      [Pkm.ZAPDOS, 4, 3],
      [Pkm.MOLTRES, 6, 3]
    ],
    items: [
      [Item.ICY_ROCK, Item.SHELL_BELL],
      [Item.CHOICE_SPECS, Item.WIDE_LENS],
      [Item.FLAME_ORB, Item.SACRED_ASH]
    ],
    bonus: { bonusHP: 200, bonusAtk: 10, bonusAP: 40 }
  },
  {
    name: "Beasts & Blade",
    act: 2,
    icon: Pkm.ZACIAN_CROWNED,
    board: [
      [Pkm.RAIKOU, 2, 2],
      [Pkm.ENTEI, 4, 1],
      [Pkm.SUICUNE, 6, 2],
      [Pkm.ZACIAN_CROWNED, 4, 3]
    ],
    items: [
      [Item.CHOICE_SPECS, Item.WIDE_LENS],
      [Item.FLAME_ORB, Item.ASSAULT_VEST],
      [Item.STAR_DUST, Item.SHELL_BELL],
      [Item.RUSTED_SWORD, Item.RAZOR_CLAW]
    ],
    bonus: { bonusHP: 200, bonusAtk: 10, bonusAP: 40 }
  },
  {
    name: "Weather Trio",
    act: 3,
    icon: Pkm.MEGA_RAYQUAZA,
    board: [
      [Pkm.PRIMAL_GROUDON, 2, 2],
      [Pkm.PRIMAL_KYOGRE, 6, 2],
      [Pkm.MEGA_RAYQUAZA, 4, 3]
    ],
    items: [
      [Item.RED_ORB, Item.ROCKY_HELMET, Item.ASSAULT_VEST],
      [Item.BLUE_ORB, Item.SHELL_BELL, Item.POWER_LENS],
      [Item.GREEN_ORB, Item.SCOPE_LENS, Item.RAZOR_FANG]
    ],
    bonus: { bonusHP: 1200, bonusAtk: 15, bonusAP: 50 }
  },
  {
    name: "Creation Trio",
    act: 3,
    icon: Pkm.GIRATINA,
    board: [
      [Pkm.DIALGA, 2, 3],
      [Pkm.PALKIA, 6, 3],
      [Pkm.ORIGIN_GIRATINA, 4, 2]
    ],
    items: [
      [Item.METAL_COAT, Item.ASSAULT_VEST, Item.ROCKY_HELMET],
      [Item.MYSTIC_WATER, Item.CHOICE_SPECS, Item.POWER_LENS],
      [Item.REAPER_CLOTH, Item.SCOPE_LENS, Item.SHELL_BELL]
    ],
    bonus: { bonusHP: 1200, bonusAtk: 15, bonusAP: 50, bonusPP: 100 }
  }
]
