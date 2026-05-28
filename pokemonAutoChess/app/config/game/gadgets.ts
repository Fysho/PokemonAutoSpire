export const GADGETS_NAMES = [
  "trainer_card",
  "bag",
  "team_planner",
  "jukebox",
  "certificate",
  "palette",
  "synergy_wheel",
  "pokeguesser",
  "tier_list_maker"
] as const

export type GadgetName = (typeof GADGETS_NAMES)[number]

export type Gadget = {
  name: GadgetName
  icon: string
  levelRequired: number
  disabled?: boolean
}

export const GADGETS: Record<GadgetName, Gadget> = {
  trainer_card: {
    name: "trainer_card",
    icon: "profile",
    levelRequired: 0
  },
  bag: {
    name: "bag",
    icon: "school-bag",
    levelRequired: 0
  },
  team_planner: {
    name: "team_planner",
    icon: "team-builder",
    levelRequired: 0
  },
  jukebox: {
    name: "jukebox",
    icon: "compact-disc",
    levelRequired: 0
  },
  palette: {
    name: "palette",
    icon: "palette",
    levelRequired: 0
  },
  certificate: {
    name: "certificate",
    icon: "certificate",
    levelRequired: 0
  },
  synergy_wheel: {
    name: "synergy_wheel",
    icon: "synergy-wheel",
    levelRequired: 0
  },
  pokeguesser: {
    name: "pokeguesser",
    icon: "pokeguesser",
    levelRequired: 0
  },
  tier_list_maker: {
    name: "tier_list_maker",
    icon: "tier-list",
    levelRequired: 0
  }
} as const

export const GADGETS_UNLOCKED_BY_LEVEL: Record<number, Gadget> =
  Object.fromEntries(
    Object.values(GADGETS).map((gadget) => [gadget.levelRequired, gadget])
  ) as Record<number, Gadget>
