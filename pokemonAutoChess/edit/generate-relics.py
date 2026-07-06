#!/usr/bin/env python3
"""Generate app/core/relics.ts from the relic PNGs.

Reads every *.png in app/public/src/assets/relics/ and emits the Relic enum +
RELICS registry. Each relic id == its PNG filename (so the HUD/wiki <img> path
resolves). Display names are prettified from the filename. A rarity is assigned
with a fixed seed (gentle weighting ~35/30/22/13 common/uncommon/rare/epic) so
the result is RANDOM-looking but STABLE across regenerations.

Run from the pokemonAutoChess/ dir:
    python3 edit/generate-relics.py
"""
import random
import re
from pathlib import Path

ASSET_DIR = Path("app/public/src/assets/relics")
OUT = Path("app/core/relics.ts")
SEED = 20240608

# (Rarity enum member, cumulative threshold). Gentle weighting.
RARITY_BUCKETS = [
    ("COMMON", 0.35),
    ("UNCOMMON", 0.65),
    ("RARE", 0.87),
    ("EPIC", 1.00),
]


def enum_key(relic_id: str) -> str:
    key = re.sub(r"\W", "_", relic_id)
    if re.match(r"\d", key):
        key = "_" + key
    return key


# Hand-corrected display names for ids that camelCase splitting mangles
# (glued connector words, possessives, etc). Keyed by exact png filename stem.
NAME_OVERRIDES = {
    "ArtofWar": "Art of War",
    "BagofMarbles": "Bag of Marbles",
    "BagofPreparation": "Bag of Preparation",
    "Captain_wheel": "Captain's Wheel",
    "CharonsAshes": "Charon's Ashes",
    "DollysMirror": "Dolly's Mirror",
    "Du-VuDoll": "Du-Vu Doll",
    "FaceOfCleric": "Face of Cleric",
    "LeesWaffle": "Lee's Waffle",
    "MarkofPain": "Mark of Pain",
    "MarkoftheBloom": "Mark of the Bloom",
    "MeatontheBone": "Meat on the Bone",
    "NeowsBlessing": "Neow's Blessing",
    "NilrysCodex": "Nilry's Codex",
    "NlothsGift": "N'loth's Gift",
    "NlothsMask": "N'loth's Mask",
    "PandorasBox": "Pandora's Box",
    "PhilosophersStone": "Philosopher's Stone",
    "RingoftheSerpent": "Ring of the Serpent",
    "RingoftheSnake": "Ring of the Snake",
    "ThreadandNeedle": "Thread and Needle",
}


# Implemented relics: (effect description, implemented=True). Keyed by png stem.
# Everything not listed defaults to ("no effect", False). The 6 class starting
# relics (see app/core/relic-battle-effects.ts) are wired into combat and only
# affect the player's Pokémon whose types match that class's synergies.
# Descriptions use UPPERCASE synergy/stat tokens (FIELD, ATK, ...) so the client's
# addIconsToDescription() renders them as icons, the way synergy-stone item text does.
EFFECT_OVERRIDES = {
    "BurningBlood": (
        "Your FIELD NORMAL WILD ELECTRIC FIRE Pokémon gain +1 ATK each time they attack.",
        True,
    ),
    "RingoftheSnake": (
        "Your BUG POISON GRASS FLORA FAIRY Pokémon heal 1% of their max HP every second.",
        True,
    ),
    "CrackedCore": (
        "Your HUMAN FIGHTING PSYCHIC LIGHT ELECTRIC Pokémon gain 2 PP every second.",
        True,
    ),
    "PureWater-0": (
        "Your DARK GHOST PSYCHIC FIRE LIGHT Pokémon gain 2 AP every second.",
        True,
    ),
    "Captain_wheel": (
        "Your WATER AQUATIC ICE FLYING SOUND Pokémon gain +5% attack speed and 5% dodge.",
        True,
    ),
    "FossilizedHelix": (
        "Your GROUND ROCK FOSSIL MONSTER STEEL Pokémon start each battle with a shield equal to 10% of their max HP.",
        True,
    ),
    # Silent-exclusive relics (see CLASS_EXCLUSIVE_RELICS in spire-classes.ts)
    "HappyFlower": (
        "Kills by your FLORA Pokémon each grant 1 mulch stack.",
        True,
    ),
    "Mango": (
        "You have twice as many berry trees and they grow twice as fast.",
        True,
    ),
    "OddMushroom": (
        "Maximum POISON stacks are doubled for poison inflicted by your Pokémon.",
        True,
    ),
    "RingoftheSerpent": (
        "Your strongest BUG Pokémon's battle clone also copies its items.",
        True,
    ),
    "Violet_lotus": (
        "Your FAIRY Pokémon heal adjacent allies for 1% of their max HP every second.",
        True,
    ),
    # General (classless) reward relics.
    "DollysMirror": (
        "A Ditto always appears among the rewards for winning a wild battle.",
        True,
    ),
    "OldCoin": (
        "Gain 40 GOLD the moment you obtain this relic.",
        True,
    ),
    "BagofPreparation": (
        "You can place 1 additional Pokémon on your board.",
        True,
    ),
    "NilrysCodex": (
        "Gain 4 extra experience each time you win a fight.",
        True,
    ),
    "GoldenIdol": (
        "Gain 50% more GOLD from winning fights.",
        True,
    ),
    "Matryoshka": (
        "Pokémon of the same evolution family each count separately toward synergies.",
        True,
    ),
}


# The 6 class starting relics — their own "CLASS" rarity, grouped separately in
# the wiki (see app/core/spire-classes.ts). Their combat effects live in
# app/core/relic-battle-effects.ts.
CLASS_RELICS = {
    "BurningBlood",
    "RingoftheSnake",
    "CrackedCore",
    "PureWater-0",
    "Captain_wheel",
    "FossilizedHelix",
}


# Non-class relics are all COMMON, except these few that are pinned to RARE.
# (Per design: flatten the relic pool — every non-class relic is common unless
# explicitly promoted here.)
RARE_RELICS = {
    "BagofPreparation",  # +1 max unit space
    "Matryoshka",        # same-family units each count for synergies
}


def pretty(relic_id: str) -> str:
    if relic_id in NAME_OVERRIDES:
        return NAME_OVERRIDES[relic_id]
    s = re.sub(r"[-_]?\d+$", "", relic_id)       # drop trailing "-0"/"2" variant tags
    s = s.replace("_", " ").replace("-", " ")
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", s)   # camelCase -> spaced
    s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", s)
    s = re.sub(r"\s+", " ", s).strip()
    return " ".join(w[:1].upper() + w[1:] for w in s.split(" "))


def pick_rarity(rng: random.Random) -> str:
    r = rng.random()
    for name, threshold in RARITY_BUCKETS:
        if r < threshold:
            return name
    return RARITY_BUCKETS[-1][0]


def main() -> int:
    ids = sorted(p.stem for p in ASSET_DIR.glob("*.png"))
    if not ids:
        print(f"no pngs in {ASSET_DIR}")
        return 1

    rng = random.Random(SEED)
    rows = []
    counts: dict[str, int] = {}
    keys_seen = {}
    for relic_id in ids:
        key = enum_key(relic_id)
        if key in keys_seen:
            print(f"WARNING: duplicate enum key {key} ({relic_id} vs {keys_seen[key]})")
        keys_seen[key] = relic_id
        # Rarity is now deterministic (no rng): the 6 class starters are CLASS,
        # a short pinned list is RARE, everything else is COMMON.
        if relic_id in CLASS_RELICS:
            rarity = "CLASS"
        elif relic_id in RARE_RELICS:
            rarity = "RARE"
        else:
            rarity = "COMMON"
        counts[rarity] = counts.get(rarity, 0) + 1
        rows.append((key, relic_id, pretty(relic_id), rarity))

    enum_lines = "\n".join(f"  {k} = {js(v)}," for k, v, _, _ in rows)

    def registry_line(k, relic_id, n, r):
        desc, implemented = EFFECT_OVERRIDES.get(relic_id, ("no effect", False))
        impl = "true" if implemented else "false"
        return (
            f"  [Relic.{k}]: {{ name: {js(n)}, description: {js(desc)}, "
            f"rarity: RelicRarity.{r}, implemented: {impl} }},"
        )

    registry_lines = "\n".join(
        registry_line(k, v, n, r) for k, v, n, r in rows
    )

    content = f"""import {{ ArraySchema }} from "@colyseus/schema"

/**
 * Spire Relics — run-wide passives, Slay-the-Spire style.
 *
 * AUTO-GENERATED by edit/generate-relics.py from the PNGs in
 * app/public/src/assets/relics/ — do not hand-edit the enum/registry; rerun the
 * generator after adding/removing relic art. (Display names + rarities are safe
 * to tweak by hand afterwards if you stop regenerating.)
 *
 * Each relic id MUST match its icon filename:
 *   app/public/src/assets/relics/<RELIC_ID>.png       (source)
 *   app/public/dist/client/assets/relics/<RELIC_ID>.png  (served)
 *
 * Relics live on `player.relics` (synced ArraySchema<string>, unique per run),
 * shown in the top-left HUD container and the Relics wiki tab. Rarity is the
 * relic-specific RelicRarity (4 random tiers + a CLASS tier for the 6 class
 * starting relics), with its own color + label maps below.
 *
 * NOTE: most relics have NO in-game effect yet (the helpers below are no-op
 * stubs); the 6 CLASS relics have combat effects in relic-battle-effects.ts.
 */
export enum Relic {{
{enum_lines}
}}

// Relic-only rarity scale (decoupled from the global Rarity enum). CLASS is the
// dedicated tier for the 6 class starting relics so they group separately.
export enum RelicRarity {{
  COMMON = "COMMON",
  UNCOMMON = "UNCOMMON",
  RARE = "RARE",
  EPIC = "EPIC",
  CLASS = "CLASS"
}}

export interface RelicData {{
  name: string
  /** Effect description shown in the HUD/wiki tooltip. "no effect" until designed. */
  description: string
  rarity: RelicRarity
  /** True once the relic's effect is wired into gameplay. Unimplemented relics
   *  render with a black outline (overriding the rarity color) in the HUD + wiki. */
  implemented: boolean
}}

export const RELICS: Record<Relic, RelicData> = {{
{registry_lines}
}}

export const ALL_RELICS: Relic[] = Object.values(Relic)

// Display order for the HUD/wiki: class relics first, then common -> epic.
export const RELIC_RARITIES: RelicRarity[] = [
  RelicRarity.CLASS,
  RelicRarity.COMMON,
  RelicRarity.UNCOMMON,
  RelicRarity.RARE,
  RelicRarity.EPIC
]

// Color per relic rarity (CSS var or hex). Base tiers reuse the global rarity
// palette; CLASS is gold. Used for the HUD tile border + wiki section color.
export const RELIC_RARITY_COLOR: Record<RelicRarity, string> = {{
  [RelicRarity.COMMON]: "var(--color-rarity-common)",
  [RelicRarity.UNCOMMON]: "var(--color-rarity-uncommon)",
  [RelicRarity.RARE]: "var(--color-rarity-rare)",
  [RelicRarity.EPIC]: "var(--color-rarity-epic)",
  [RelicRarity.CLASS]: "var(--color-rarity-legendary)"
}}

export const RELIC_RARITY_LABEL: Record<RelicRarity, string> = {{
  [RelicRarity.COMMON]: "Common",
  [RelicRarity.UNCOMMON]: "Uncommon",
  [RelicRarity.RARE]: "Rare",
  [RelicRarity.EPIC]: "Epic",
  [RelicRarity.CLASS]: "Class"
}}

export function isRelic(value: string): value is Relic {{
  return (ALL_RELICS as string[]).includes(value)
}}

export function getRelicRarity(relic: string): RelicRarity | undefined {{
  return RELICS[relic as Relic]?.rarity
}}

export function isRelicImplemented(relic: string): boolean {{
  return RELICS[relic as Relic]?.implemented === true
}}

// --- Effect helpers (one hook per effect). ---
// No relic grants any of these yet; they return neutral values so the reward /
// loss hooks in game-commands.ts stay wired and ready.

export function getRelicBonusGold(_relics: ArraySchema<string>): number {{
  return 0
}}

export function getRelicPostBattleHeal(
  _relics: ArraySchema<string>,
  _won: boolean
): number {{
  return 0
}}

export function getRelicDamageReduction(_relics: ArraySchema<string>): number {{
  return 0
}}
"""

    OUT.write_text(content)
    print(f"wrote {OUT} with {len(rows)} relics")
    order = [n for n, _ in RARITY_BUCKETS] + ["CLASS"]
    print("rarity counts: " + ", ".join(f"{n}={counts.get(n, 0)}" for n in order))
    return 0


def js(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


if __name__ == "__main__":
    raise SystemExit(main())
