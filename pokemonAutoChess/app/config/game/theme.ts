import { Title } from "../../types"
import type { IUserMetadataUnpacked } from "../../types/interfaces/UserMetadata"
import { invertKeysValues, values } from "../../utils/object"
import { GADGETS } from "./gadgets"

export const THEMES = [
  "pasdefault",
  "fishspick",
  "default",
  "super",
  "lilac",
  "rainbow",
  "unown",
  "origin",
  "umbra",
  "autumn",
  "redsea",
  "zengarden",
  "deerling"
] as const

export type Theme = (typeof THEMES)[number]

export const VIDEO_BG_THEMES: Theme[] = [
  "pasdefault",
  "fishspick",
  "umbra",
  "autumn",
  "redsea",
  "zengarden",
  "deerling"
]

export const TITLE_BY_THEME = {
  unown: Title.ARCHEOLOGIST,
  rainbow: Title.HARLEQUIN,
  autumn: Title.POKEMON_RANGER,
  umbra: Title.DELINQUENT,
  redsea: Title.FISHERMAN,
  origin: Title.MUSEUM_DIRECTOR,
  zengarden: Title.NATURAL,
  deerling: Title.AMATEUR
} satisfies Partial<Record<Theme, Title>>

export const THEME_BY_TITLE = invertKeysValues(TITLE_BY_THEME)

export const TITLES_UNLOCKING_THEMES = values(TITLE_BY_THEME)
export type TitleUnlockingTheme = (typeof TITLES_UNLOCKING_THEMES)[number]

export function isThemeUnlocked(
  theme: Theme,
  profile: IUserMetadataUnpacked
): boolean {
  // Spire (single-player): no title progression, so every theme is always available.
  // Upstream gated themes behind TITLE_BY_THEME titles + a palette level requirement.
  return profile.level >= GADGETS.palette.levelRequired
}
