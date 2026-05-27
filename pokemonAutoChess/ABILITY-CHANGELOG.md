# Ability Changelog

All ability balance and behavior changes for Pokemon Auto Spire, tracked from the PAC v6.9 baseline.

Covers: damage values, effect durations, scaling, targeting, cooldowns, and new/removed abilities.

### Key files

| What | Where |
|---|---|
| Ability implementations | `app/core/abilities/abilities.ts` |
| Ability enum | `app/types/enum/Ability.ts` |
| Ability assignment (per Pokemon) | `app/models/colyseus-models/pokemon.ts` (skill field) |
| Hidden Power variants | `app/core/abilities/hidden-power.ts` |

---

## Changes

<!-- 
Template for recording changes:

### YYYY-MM-DD — Change Title

**Ability**: ABILITY_NAME
**Type**: damage change | duration change | scaling change | targeting change | new ability | removed ability | cooldown change | mechanic change
**Before**: [what it was]
**After**: [what it is now]
**Affected Pokemon**: [which Pokemon use this ability]
**Rationale**: [why the change was made]
**Files changed**:
- `path/to/file.ts` — description of change
-->

### 2026-05-27 — Night Shade damage cap

**Ability**: NIGHT_SHADE
**Type**: damage change
**Before**: Damage = (25%/33%/50% of target maxHP) * (1 + 0.5*AP/100), no cap.
**After**: Same formula, capped at 150 damage.
**Affected Pokemon**: Misdreavus, Mismagius
**Rationale**: %-max-HP true damage scaled too high against tanky targets with no ceiling.
**Files changed**:
- `app/core/abilities/abilities.ts` — Added `Math.min(150, ...)` cap to `NightShadeStrategy`

### 2026-05-27 — Halve Glutton (Snorlax/Munchlax) passive HP gains

**Ability**: GLUTTON (passive)
**Type**: scaling change
**Before**: +10 HP per berry eaten, +30 HP from chef cooking, +20 HP on fight start.
**After**: +5 HP per berry eaten, +15 HP from chef cooking, +10 HP on fight start.
**Affected Pokemon**: Munchlax, Snorlax
**Rationale**: Permanent HP stacking was too strong, letting Snorlax reach excessively high HP totals over a run.
**Files changed**:
- `app/core/pokemon-entity.ts` — Berry eating: 10 → 5
- `app/core/effects/items.ts` — Chef cooking: 30 → 15
- `app/core/simulation.ts` — Fight start: 20 → 10
