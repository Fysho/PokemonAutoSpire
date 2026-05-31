# Pokemon Changelog

All Pokemon balance and data changes for Pokemon Auto Spire, tracked from the PAC v6.9 baseline.

Covers: stat changes, type/synergy assignments, rarity, evolution rules, passive abilities, cost, and pool additions/removals.

### Key files

| What | Where |
|---|---|
| Pokemon classes (stats, types, passives) | `app/models/colyseus-models/pokemon.ts` |
| Pokemon enum & index | `app/types/enum/Pokemon.ts` |
| Evolution rules | `app/core/evolution-rules.ts` |
| Precomputed data | `app/models/precomputed/` |
| Pokemon factory | `app/models/pokemon-factory.ts` |

---

## Changes

<!-- 
Template for recording changes:

### YYYY-MM-DD — Change Title

**Pokemon**: POKEMON_NAME (and evolutions if applicable)
**Type**: stat change | type change | rarity change | passive change | evolution change | new pokemon | removed pokemon | cost change
**Before**: [what it was]
**After**: [what it is now]
**Rationale**: [why the change was made]
**Files changed**:
- `path/to/file.ts` — description of change
-->

### 2026-05-31 — Fix: regional variant evolutions were impossible to obtain

**Pokemon**: All 3★ regional variant final forms reached by divergent evolution — HISUIAN_TYPHLOSION (Quilava), HISUI_SAMUROTT, HISUI_SLIGGOO, HISUI_AVALUGG, HISUIAN_LILLIGANT, ALOLAN_RAICHU, ALOLAN_MAROWAK, ALOLAN_EXEGGUTOR, GALARIAN_WEEZING, etc.
**Type**: evolution change (bug fix)
**Before**: Divergent evolutions check `player.regionalPokemons.includes(<variant>)` to decide whether to produce the regional form (e.g. Quilava → Hisuian Typhlosion in a Ghost region). Spire populated `regionalPokemons` via `getRegionalCandidates()` (the wild-reward helper), which caps at `maxStars` ≤ 2 and dedups by family. Every 3★ regional final form was silently filtered out, so the `includes()` check always failed and these variants could never be obtained — Quilava always became base Typhlosion regardless of region.
**After**: `Player.updateRegionalPool()` keeps the existing `getRegionalCandidates()` list (so the regional panel is unchanged — nothing is removed) and **additionally** appends the high-star (3★+) regional finals the star cap was dropping. Each appended final is gated by its own `isInRegion()` (so Hisuian Typhlosion stays Ghost-locked and never leaks into Fire/Field regions), family-deduped against the base list, and queried with `state=undefined` to bypass the additional-pick unlock gate (Spire has no forced add-pick rounds, so those Pokemon should always count as available). These finals now appear in `regionalPokemons`, so evolving the base line while in the matching region produces the regional variant. The 1★-non-variant shop-population gate (`addRegionalPokemon`) is unchanged (the appended finals are 3★, so they don't affect it).
**Rationale**: Regional variants were entirely unobtainable in Spire. The additive approach was chosen over replacing the pool with a raw `isInRegion()` filter because that replacement, while it also worked, shrank the regional panel ~30% (the stricter `isInRegion()` enforces the variant-in-original's-region exclusion and the add-pick gate that the old synergy-match ignored). Reachable in practice because the rolling shop is available during the PICK phase while `player.map` is set to the wild-battle's region — buy/merge the trio there and it evolves into the regional form.
**Files changed**:
- `app/models/colyseus-models/player.ts` — `updateRegionalPool()` now = `getRegionalCandidates()` + appended 3★+ `isInRegion()`-gated regional finals (state=undefined to skip the add-pick gate Spire doesn't use).

### 2026-05-31 — Make late-game evolutions reachable in a Spire run

**Pokemon**: COSMOG/COSMOEM, TANDEMAUS/MAUSHOLD_THREE/MAUSHOLD_FOUR, CHARCADET, ZACIAN
**Type**: evolution change
**Before**:
- Cosmog/Cosmoem evolved after 8 stacks (10 upstream), gaining +10 max HP per evolution of any other unit.
- Tandemaus → Maushold (3) → Maushold (4) evolved on fixed stage levels (`stageLevel >= 14` / `>= 20`), unreachable if the family was acquired late.
- Charcadet's Auspicious/Malicious Armor and Zacian's Rusted Sword were granted by upstream PvE stages (`pve-stages.ts` turn 14 "Mewtwo & Mew" / turn 24 "Legendary Birds") — a `getRewards` path that is never invoked in Spire mode, so the items were effectively unobtainable.

**After**:
- Cosmog/Cosmoem evolve after **3** stacks and gain **+30** max HP per evolution. Cosmoem's onAcquired HP compensation rescaled accordingly (−30 immediate proc, −90 for the 3×30 carried over from Cosmog).
- Tandemaus and Maushold (3) each evolve **5 fights after being acquired** via the new `TimerEvolutionRule` (hatch-style turn counter), 10 fights total from picking up Tandemaus.
- Charcadet's armor and Zacian's Rusted Sword are added to the player's **inventory** for **winning any act-end boss** (floor-20 Legendary Boss, or the floor-20 Endless async fight), so the player equips it themselves. Armor type still follows Psychic vs Ghost synergy.

**Rationale**: Cosmog (10→8 already, now 3), Tandemaus (fixed stage levels), and Charcadet/Zacian (dead PvE reward path) were all hard or impossible to evolve in a Spire run compared to upstream PAC's longer linear games.

**Files changed**:
- `app/core/evolution-rules.ts` — `+30` HP per evolution in `afterEvolve`; new `TimerEvolutionRule` class.
- `app/models/colyseus-models/pokemon.ts` — Cosmog/Cosmoem `stacksRequired = 3` + rescaled Cosmoem `onAcquired`; Tandemaus/Maushold (3) use `TimerEvolutionRule(5)`.
- `app/rooms/commands/game-commands.ts` — `grantBossSignatureItems()` helper, called on Legendary Boss and Endless floor-20 wins.
- `app/public/dist/client/locales/en/translation.json` — COSMOG/COSMOEM/FAMILY passive descriptions.
- `app/public/src/pages/spire-lobby.tsx` — PAC Diversions panel entries.

### 2026-05-28 — Add Ogerpon forms to Act 3 legendary unlock pool

**Pokemon**: OGERPON_WELLSPRING, OGERPON_HEARTHFLAME, OGERPON_CORNERSTONE
**Type**: pool change
**Before**: Only OGERPON_TEAL was in the Act 3 legendary unlock encounter list. The other 3 base forms were inaccessible from legendary encounters.
**After**: All 4 base Ogerpon forms (Teal, Wellspring, Hearthflame, Cornerstone) are now in the legendary unlock pool. Mask forms remain excluded by design.
**Rationale**: 3 of 4 Ogerpon forms were missing from the legendary encounter pool — unintentional omission.
**Files changed**:
- `app/models/spire-encounters.ts` — Added OGERPON_WELLSPRING, OGERPON_HEARTHFLAME, OGERPON_CORNERSTONE to `LEGENDARY_ELITE_ENCOUNTERS`
