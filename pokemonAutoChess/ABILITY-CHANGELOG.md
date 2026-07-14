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


### 2026-07-13 — Reduce Soft-Boiled AP scaling

**Ability**: SOFT_BOILED
**Type**: scaling change
**Before**: The team-wide shield used full AP scaling (`apBoost = 1`).
**After**: The shield uses half AP scaling (`apBoost = 0.5`). Flat shield values remain 20/40/80 by star level.
**Affected Pokemon**: Happiny, Chansey, Blissey
**Rationale**: Reduces high-AP shield amplification without changing the ability's base shield or status cleanse.
**Files changed**:
- `app/core/abilities/abilities.ts` — `SoftBoiledStrategy` shield scaling 1→0.5.
- `app/public/dist/client/locales/en/translation.json` — Added `SP=0.5` to the English ability tooltip.
- `app/public/src/pages/spire-lobby.tsx` — Added the change to PAC Diversions.

### 2026-07-13 — Reduce Glutton dish and Chef HP gains

**Ability**: GLUTTON (passive)
**Type**: scaling change
**Before**: +5 max HP per berry, +10 per dish, and +15 when cooking as a Chef.
**After**: +5 max HP per berry, +5 per dish, and +10 when cooking as a Chef.
**Affected Pokemon**: Munchlax, Snorlax
**Rationale**: Further reduces permanent HP stacking from repeatable Gourmet triggers while leaving the berry gain unchanged.
**Files changed**:
- `app/core/simulation.ts` — Dish consumption: 10→5.
- `app/core/effects/items.ts` — Chef cooking: 15→10.
- `app/public/dist/client/locales/en/translation.json` — Updated the English Glutton tooltip.
- `app/public/src/pages/spire-lobby.tsx` — Updated the PAC Diversions values.

### 2026-06-03 — Plasma Flash flash-count cap (runaway-command fix)

**Ability**: PLASMA_FLASH
**Type**: mechanic change (bug fix)
**Before**: Flash count = `4 + pokemon.count.ult`, uncapped. `count.ult` increments on every cast, so over a long fight it grows without bound and each cast queues `4 + count.ult` `DelayedCommand`s spread across `100ms * i`. The queue filled faster than it drained, flooding `pokemon.commands` (confirmed in production: ROTOM_DRONE generating 200–260+ "pending commands" warnings), leaking memory and risking OOM — the same failure mode as the Skeledirge / Torch Song fix below.
**After**: Flash count hard-capped at 20 — `Math.min(20, 4 + pokemon.count.ult)` — bounding the command queue regardless of how many times the unit has ulted. Per-flash damage (20), animation, and 100ms stagger are unchanged.
**Affected Pokemon**: Rotom Drone (Rotom line)
**Rationale**: Bug — unbounded command-queue growth threatened the production server. Byte-identical to upstream PAC; masked there by short PvP rounds, exposed by Spire's longer single-player fights (high-HP bosses let `count.ult` ramp into the hundreds).
**Files changed**:
- `app/core/abilities/abilities.ts` — `PlasmaFlashStrategy`: capped `flashCount` at 20 via `Math.min`.

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

### 2026-06-06 — Raise Decorate (Rainbow Swirl) PP buff 30 → 50

**Ability**: DECORATE
**Type**: scaling change
**Before**: Alcremie Rainbow Swirl's Decorate granted `addPP(30)` to the strongest nearby ally (down from the upstream 60).
**After**: Grants `addPP(50)`. Still below the upstream default of 60, and the PP gain still does not scale with AP (`apBoost = 0`, see the PP-battery entry below — unchanged).
**Affected Pokemon**: Milcery / Alcremie Rainbow Swirl.
**Rationale**: The 30 nerf was a touch too harsh; bumped to 50 to make the Rainbow Swirl PP-battery build more viable while keeping it under upstream.
**Files changed**:
- `app/core/abilities/abilities.ts` — `DecorateStrategy` ALCREMIE_RAINBOW_SWIRL branch `addPP(30)` → `addPP(50)`.
- `app/public/src/pages/spire-lobby.tsx` — Updated both PAC Diversions entries (Items + Pokemon) to "60 to 50".

### 2026-06-03 — Remove AP scaling from PP-battery abilities

**Abilities**: FAIRY_WIND, DECORATE, MISTY_SURGE, FORECAST, IVY_CUDGEL, AFTER_YOU, TERRAIN_PULSE, SPITE
**Type**: scaling change
**Before**: The PP granted to allies scaled with the caster's AP — `apBoost` of `1` (full) for MISTY_SURGE, FORECAST, IVY_CUDGEL, AFTER_YOU, TERRAIN_PULSE, SPITE, and `0.5` (half) for FAIRY_WIND and DECORATE. High-AP support units could dump huge PP onto carries.
**After**: All eight pass `apBoost = 0` to `addPP(...)`, so the PP granted is the flat base value regardless of the caster's AP. Only the PP-granting effect changed; co-located heals/shields/buffs/damage keep their existing AP scaling.
**Affected Pokemon**: Flabébé/Floette/Florges (Fairy Wind), Milcery/Alcremie Rainbow Swirl (Decorate), Tapu Fini (Misty Surge), Castform Rain (Forecast), Ogerpon Wellspring (Ivy Cudgel), Indeedee Male (After You), Smoliv/Dolliv/Arboliva (Terrain Pulse), Yamask/Cofagrigus (Spite).
**Rationale**: AP-scaled PP batteries made AP-stacked support snowball ally cast frequency too hard; flat PP keeps them useful as enablers without runaway scaling. Note: SOAK (Poliwag line, Tatsugiri) and the DRUMMER passive (Grookey line) already granted flat PP and were unchanged.
**Files changed**:
- `app/core/abilities/abilities.ts` — set the `apBoost` arg to `0` on the ally `addPP(...)` call in the 8 ability strategies above.

### 2026-06-06 — Torch Song: restore per-flame AP buff (keep the cap)

**Ability**: TORCH_SONG
**Type**: mechanic change
**Before**: Flame count hard-capped at 20, **and** the AP buff applied once per cast (flat `[1,2,3]`) — both introduced by the 2026-06-01 runaway-feedback fix.
**After**: The AP buff is back to **once per flame** (upstream behavior), restored inside the per-flame `DelayedCommand`. The 20-flame cap is **kept** — and the cap alone is what bounds the command queue, so per-flame AP can no longer run away (at most 20 commands queued per cast regardless of AP).
**Affected Pokemon**: Skeledirge (Charcadet line)
**Rationale**: The once-per-cast change was a belt-and-suspenders addition to the cap; with the cap confirmed sufficient, reverting to per-flame AP brings the ability's high-AP scaling back in line with upstream while staying OOM-safe.
**Files changed**:
- `app/core/abilities/abilities.ts` — `TorchSongStrategy`: moved `addAbilityPower(apGainPerFlame, …)` back into the per-flame `DelayedCommand`; removed the pre-loop once-per-cast `addAbilityPower`; `Math.min(20, …)` flame cap retained.
- `app/public/src/pages/spire-lobby.tsx`, `CLAUDE.md`, `AI-MEMORY-LEAKS.md` — Updated the Torch Song description to reflect cap-only as the OOM fix.

### 2026-06-01 — Torch Song runaway-feedback fix

**Ability**: TORCH_SONG
**Type**: mechanic change (bug fix)
**Before**: Flame count scaled with AP (`4 * (1 + AP/100) * critPower`, uncapped) **and** each flame granted the caster AP via `addAbilityPower`. This created a positive feedback loop — more AP → more flames → more AP — so AP compounded geometrically every cast and flame count grew into the hundreds/thousands. Each flame pushes a `DelayedCommand` onto `pokemon.commands`, which grew faster than it drained, pinning the server event loop and leaking memory (confirmed in production: Skeledirge the sole source of `pokemon-state.ts` "pending commands" warnings, 1500+ times).
**After**: (1) Flame count hard-capped at 20 — `Math.min(20, Math.round(...))` — bounding the command queue regardless of AP. (2) The AP buff is applied **once per cast** (flat `[1,2,3]` per the ability description) instead of once per flame, breaking the compounding. Per-flame damage, 30% burn chance, and `broadcastAbility` are unchanged.
**Affected Pokemon**: Skeledirge (Charcadet line)
**Rationale**: Bug — unbounded command-queue growth was taking down the production server. Byte-identical to upstream PAC; masked there by short PvP rounds, exposed by Spire's longer single-player fights and AP stacking.
**Files changed**:
- `app/core/abilities/abilities.ts` — `TorchSongStrategy`: capped `nbFlames` at 20; moved AP gain out of the per-flame `DelayedCommand` to a single pre-loop `addAbilityPower` call.

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
