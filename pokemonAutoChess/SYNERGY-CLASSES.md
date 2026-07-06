# Synergy Classes (Spire-original design)

Spire groups the 31 PAC synergies into **6 combat classes** + **1 Colorless (universal) pool**.
Each class is a Slay-the-Spire-style "character" identity. Some synergies are shared across
two classes ("double-ups", marked †). Sizes are balanced at **5 synergies per class**.

## Class table

| StS Name | Class theme | Synergies |
|---|---|---|
| ⚔️ **The Ironclad** | Beasts | FIELD, NORMAL, WILD, ELECTRIC†, FIRE† |
| 🗡️ **The Silent** | Garden | BUG, POISON, GRASS, FLORA, FAIRY |
| 🤖 **The Defect** | Mind & Energy | HUMAN, FIGHTING, PSYCHIC†, LIGHT†, ELECTRIC† |
| 🧘 **The Watcher** | Dark | DARK, GHOST, PSYCHIC†, FIRE†, LIGHT† |
| 🌊 **The Drifter** | Sea & Sky | WATER, AQUATIC, ICE, FLYING, SOUND |
| ⛰️ **The Behemoth** | Earth Monsters | GROUND, ROCK, FOSSIL, MONSTER, STEEL |
| ⭐ **Colorless** | Universal | BABY, DRAGON, GOURMET, ARTIFICIAL, AMORPHOUS |

All 31 synergies are covered. 6 classes × 5 = 30 slots + 5 Colorless = 35 = 31 unique + 4 double-ups.

## Starting relics

Each class starts holding one relic (granted in `startGame` when `isSpire`). The 4 mapped
StS classes use their canonical StS starting relics; the 2 new classes use thematic picks.

| Class | Starting relic (`Relic` id) |
|---|---|
| The Ironclad | Burning Blood (`BurningBlood`) |
| The Silent | Ring of the Snake (`RingoftheSnake`) |
| The Defect | Cracked Core (`CrackedCore`) |
| The Watcher | Pure Water (`PureWater_0`) |
| The Drifter | Captain's Wheel (`Captain_wheel`) |
| The Behemoth | Fossilized Helix (`FossilizedHelix`) |

The relic's combat effect is scoped to that class's 5 synergies (see `relic-battle-effects.ts`).

## Double-ups (synergy in two classes)

| Synergy | Classes |
|---|---|
| **FIRE** | The Ironclad (Beasts) + The Watcher (Dark) |
| **ELECTRIC** | The Ironclad (Beasts) + The Defect (Mind & Energy) |
| **PSYCHIC** | The Defect (Mind & Energy) + The Watcher (Dark) |
| **LIGHT** | The Defect (Mind & Energy) + The Watcher (Dark) |

> Note: The Defect and The Watcher share **two** synergies (Psychic + Light), so those two
> pools overlap ~40%. If classes gate drafting, expect them to feel related.

## Why the StS names map this way

- **The Ironclad → Beasts**: raw strength / HP / aggression. Fire/Wild/Field are the brute-force frontline.
- **The Silent → Garden**: Silent *is* poison + evasion; Garden is Poison/Bug/Grass/Fairy. Near 1:1.
- **The Defect → Mind & Energy**: Defect channels Lightning/Frost/Dark/Plasma **orbs** + focus scaling = Electric/Psychic/Light energy.
- **The Watcher → Dark**: Watcher's light/dark duality (Calm ⇄ Wrath) + spirit = Dark/Ghost/Light/Psychic.
- **The Drifter (new) → Sea & Sky**: lone storm-nomad of tide and wind. Water/Ice/Flying/Sound, mobile and evasive.
- **The Behemoth (new) → Earth Monsters**: ancient stone titan. Ground/Rock/Fossil/Monster/Steel, immovable and crushing.

Name alternates considered: Drifter → The Tempest / The Mariner; Behemoth → The Colossus / The Warden.

## Universal / Colorless rationale

BABY, DRAGON, GOURMET, ARTIFICIAL, AMORPHOUS are **economy / flex / scaling** mechanics with no
combat identity (eggs, double-typing splash, dish economy, item generation, mana shuffle), so they're
draftable regardless of class — StS's "Colorless" pool.

## How the split was derived (methodology)

Grouping is **roster-overlap driven**, not playstyle driven: synergies that share many Pokémon belong
together. Computed from real co-occurrence across 1,149 type-rows in
`app/models/precomputed/pokemons-data.csv` (count of Pokémon carrying both synergies).

Strongest shared-roster edges that anchor the classes:
- Garden: Flora+Grass 29, Fairy+Flora 22, Bug+Poison 19
- Sea & Sky: Aquatic+Water 22, Aquatic+Ice 12, Aquatic+Flying 12
- Beasts/Ironclad: Field+Normal 24, Field+Fire 21, Electric+Field 14, Normal+Wild 12
- Mind & Energy/Defect: Human+Psychic 27, Fighting+Human 18, Light+Psychic 11, Electric+Light 14
- Earth Monsters/Behemoth: Monster+Rock 13, Fossil+Rock 11, Rock+Steel 9, Ground+Monster 14
- Dark/Watcher: Dark+Ghost 8, Ghost+Steel 7, Fire+Ghost 10, Fairy+Psychic 17 (bridge)

The design evolved from clean data clusters (3→4→5→6 nested splits) and was then hand-tuned for
even sizes and the desired StS-class flavor, with double-ups allowed to hit 5-per-class and bolster
the Mind & Energy / Dark pools.

## Source of truth (wired into code)

The synergy enum lives in `app/types/enum/Synergy.ts` (31 values). The class mapping is now
implemented in code in **two places that MUST be kept in sync**:

- **`app/core/spire-classes.ts`** — `SPIRE_CLASSES[class].synergies` + `.startingRelic`. The
  canonical class definition. Consumed by `game-room.ts` (via `require()`) to grant the starting
  relic and filter the starter pool to the class synergies, and by the lobby class-selection card.
- **`app/core/relic-battle-effects.ts`** — `RELIC_SYNERGIES[startingRelic]` mirrors the same 5
  synergies per class (kept decoupled because it's a *relic* effect, not a class effect). If a
  class's synergies change here, update `RELIC_SYNERGIES` too, or the starting relic will buff the
  wrong types.

Keep this doc in sync with both when the split changes.
