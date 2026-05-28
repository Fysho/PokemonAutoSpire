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

### 2026-05-28 — Add Ogerpon forms to Act 3 legendary unlock pool

**Pokemon**: OGERPON_WELLSPRING, OGERPON_HEARTHFLAME, OGERPON_CORNERSTONE
**Type**: pool change
**Before**: Only OGERPON_TEAL was in the Act 3 legendary unlock encounter list. The other 3 base forms were inaccessible from legendary encounters.
**After**: All 4 base Ogerpon forms (Teal, Wellspring, Hearthflame, Cornerstone) are now in the legendary unlock pool. Mask forms remain excluded by design.
**Rationale**: 3 of 4 Ogerpon forms were missing from the legendary encounter pool — unintentional omission.
**Files changed**:
- `app/models/spire-encounters.ts` — Added OGERPON_WELLSPRING, OGERPON_HEARTHFLAME, OGERPON_CORNERSTONE to `LEGENDARY_ELITE_ENCOUNTERS`
