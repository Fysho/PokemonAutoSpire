# Synergy Changelog

All synergy balance changes for Pokemon Auto Spire, tracked from the PAC v6.9 baseline.

---

## Baseline (PAC v6.9 — unchanged)

### Synergy Triggers (activation thresholds)

| Synergy | Triggers |
|---|---|
| NORMAL | 3 / 5 / 7 / 9 |
| GRASS | 3 / 5 / 7 / 9 |
| FIRE | 2 / 4 / 6 / 8 |
| WATER | 3 / 6 / 9 |
| ELECTRIC | 3 / 5 / 7 |
| FIGHTING | 2 / 4 / 6 / 8 |
| PSYCHIC | 3 / 5 / 7 |
| DARK | 3 / 5 / 7 |
| STEEL | 2 / 4 / 6 / 8 |
| GROUND | 2 / 4 / 6 / 8 |
| POISON | 3 / 5 / 7 |
| DRAGON | 3 / 5 / 7 |
| FIELD | 3 / 6 / 9 |
| MONSTER | 2 / 4 / 6 / 8 |
| HUMAN | 2 / 4 / 6 |
| AQUATIC | 2 / 4 / 6 / 8 |
| BUG | 2 / 4 / 6 / 8 |
| FLYING | 2 / 4 / 6 / 8 |
| FLORA | 3 / 4 / 5 / 6 |
| ROCK | 2 / 4 / 6 |
| GHOST | 2 / 4 / 6 / 8 |
| FAIRY | 2 / 4 / 6 / 8 |
| ICE | 2 / 4 / 6 / 8 |
| FOSSIL | 2 / 4 / 6 |
| SOUND | 2 / 4 / 6 |
| ARTIFICIAL | 2 / 4 / 6 |
| BABY | 3 / 5 / 7 |
| LIGHT | 2 / 3 / 4 / 5 |
| WILD | 2 / 4 / 6 / 9 |
| AMORPHOUS | 3 / 5 / 7 |
| GOURMET | 3 / 4 / 5 |

### Synergy Effects (tier names)

| Synergy | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|
| NORMAL | Stamina | Strength | Endure | Pure Power |
| GRASS | Ingrain | Growth | Spore | Overgrow |
| FIRE | Flame Body | Wildfire | Blaze | Desolate Land |
| WATER | Rain Dance | Drizzle | — | Primordial Sea |
| ELECTRIC | Rising Voltage | Power Surge | Supercharged | — |
| FIGHTING | Guts | Sturdy | Defiant | Coaching |
| PSYCHIC | Precognition | Aura | Transcendence | — |
| DARK | Hone Claws | Assurance | Beat Up | — |
| STEEL | Steel Surge | Steel Spike | Corkscrew Crash | Max Meltdown |
| GROUND | Tiller | Digger | Driller | Deep Miner |
| POISON | Poisonous | Venomous | Toxic | — |
| DRAGON | Dragon Energy | Dragon Scales | Dragon Dance | — |
| FIELD | Bulk Up | Rage | Anger Point | — |
| MONSTER | Pursuit | Brutal Swing | Power Trip | Merciless |
| HUMAN | Meditate | Focus Energy | Calm Mind | — |
| AQUATIC | Swift Swim | Hydration | Water Veil | Surge Surfer |
| BUG | Cocoon | Infestation | Horde | Heart of the Swarm |
| FLYING | Tailwind | Feather Dance | Max Airstream | Skydive |
| FLORA | Cottonweed | Flycatcher | Fragrant | Flower Power |
| ROCK | Battle Armor | Mountain Resistance | Diamond Storm | — |
| GHOST | Curse of Vulnerability | Curse of Weakness | Curse of Torment | Curse of Fate |
| FAIRY | Aromatic Mist | Fairy Wind | Strange Steam | Moon Force |
| ICE | Chilly | Frosty | Freezing | Sheer Cold |
| FOSSIL | Ancient Power | Elder Power | Forgotten Power | — |
| SOUND | Largo | Allegro | Presto | — |
| ARTIFICIAL | Dubious Disc | Link Cable | Google Specs | — |
| BABY | Hatcher | Breeder | Golden Eggs | — |
| LIGHT | Shining Ray | Light Pulse | Eternal Light | Max Illumination |
| WILD | Quick Feet | Run Away | Hustle | Berserk |
| AMORPHOUS | Fluid | Shapeless | Ethereal | — |
| GOURMET | Appetizer | Lunch Break | Banquet | — |

### Synergy Constants

| Constant | Values |
|---|---|
| Monster ATK buff per tier | 3 / 6 / 10 / 10 |
| Monster AP buff per tier | 10 / 20 / 30 / 30 |
| Monster Max HP buff factor per tier | 0.2 / 0.4 / 0.6 / 0.6 |
| Field heal per tier | 30 / 40 / 50 |
| Field speed buff per tier | 15 / 20 / 25 |

### Effect Mechanics Summary

| Synergy | Mechanic |
|---|---|
| NORMAL | Shield on fight start (15/+20/+25/+30) to self and adjacent allies. Tier 4: Scarf holders gain +30% base ATK and +30 AP. |
| FIRE | Gain ATK equal to synergy tier level per attack (1/2/3/4 ATK per hit). |
| ELECTRIC | Triple attack every Nth attack (4th/3rd/3rd). Tier 3: also drains 10 PP and charges cell battery. |
| FIGHTING | Knockback every 10th hit received. Knock target to far cell, deal ATK damage. |
| GROUND | DEF/SpDEF from hole level (1/2/3/3 per hole level). +ATK at max hole level (3/5/8/8). Tier 4: bonus DEF for fully dug rows, title at 3 complete rows. |
| MONSTER | On kill: +ATK (3/6/10/10), +AP (10/20/30/30), +MaxHP (20%/40%/60%/60% of target's MaxHP). |
| HUMAN | Lifesteal: 25% / 35% / 50% of damage dealt. |
| FIELD | On ally death: heal Field allies (30/40/50 HP) and speed boost (15/20/25). |
| SOUND | On ability cast: +ATK (2/1/1) and +Speed (0/5/5) and +PP (0/0/3) to all allies. Mega Launcher triples effect. |
| FLYING | Fly away at low HP (below 20% at T1-2, below 50% at T3-4). T3-4 can trigger twice. |
| GRASS | Tier 4 (Overgrow): +50 AP when below 30% HP (one-time trigger). |
| WILD | Tier 4 (Berserk): +40 Speed, +40% base ATK, +30 Shield when below 30% HP. Expires after 3s. |
| FAIRY | Wands granted to player. On-hit wand effects (see wand table). Each wand adds 20% special damage per attack. |

---

## Changes

<!-- 
Template for recording changes:

### YYYY-MM-DD — Change Title

**Synergy**: SYNERGY_NAME  
**Type**: trigger change | effect change | constant change | new synergy | removed synergy | pokemon type change  
**Before**: [what it was]  
**After**: [what it is now]  
**Rationale**: [why the change was made]  
**Files changed**:
- `path/to/file.ts` — description of change
-->

### 2026-05-27 — Fishing rods only proc after wild encounters

**Synergy**: AQUATIC (fishing rod items)
**Type**: effect change
**Before**: Fishing rods (Old Rod, Good Rod, Super Rod) fished a Pokemon onto the bench at the start of every non-PVE stage after stage 3.
**After**: Fishing rods only fish after Wild Battle encounters. They no longer proc after Elite, Unlock, Gym Leader, Legendary Boss, Elite Four, Champion, or Arceus fights.
**Rationale**: In Auto Spire's roguelike structure, fishing after every fight type was too strong. Restricting to wild encounters makes the Aquatic/fishing rod build a more deliberate choice tied to map pathing.
**Files changed**:
- `app/core/effects/items.ts` — Added `MapNodeType.WILD_BATTLE` check to `FishingRodEffect`

### 2026-05-27 — Remove Gourmet, Light, Artificial, Amorphous gyms

**Synergy**: GOURMET, LIGHT, ARTIFICIAL, AMORPHOUS
**Type**: gym pool change
**Before**: All 4 synergies had gym leader entries in `GYM_LEADER_POKEMON` and `GYM_LEADER_NAMES`, making them possible gym encounters.
**After**: These 4 synergies are commented out in `GYM_LEADER_POKEMON` and `GYM_LEADER_NAMES` (kept for easy re-enable). Gym synergy count drops from 31 to 27.
**Rationale**: These synergies don't make compelling gym themes — they either have too few Pokemon to build interesting encounters or don't translate well to a gym leader fantasy.
**Files changed**:
- `app/models/spire-encounters.ts` — Commented out GOURMET, LIGHT, ARTIFICIAL, AMORPHOUS entries in `GYM_LEADER_POKEMON` and `GYM_LEADER_NAMES`

### 2026-05-27 — Halve Amorphous synergy bonuses

**Synergy**: AMORPHOUS
**Type**: constant change
**Before**: Speed per active synergy: 1 / 3 / 6. HP per active synergy: 3 / 6 / 12.
**After**: Speed per active synergy: 1 / 2 / 3. HP per active synergy: 2 / 3 / 6.
**Rationale**: Amorphous scaling was too strong in runs with many active synergies, giving excessive free stats.
**Files changed**:
- `app/core/simulation.ts` — Halved speedFactor and hpFactor arrays (rounded up)
- `app/public/dist/client/locales/en/translation.json` — Updated FLUID, SHAPELESS, ETHEREAL effect descriptions

### 2026-05-27 — Enable Baby synergy eggs in Spire

**Synergy**: BABY
**Type**: effect change
**Before**: Baby synergy eggs never spawned in Spire because `stopSpireFightingPhase()` didn't call `spawnBabyEggs()`. The original PAC code intentionally skipped egg spawning on PVE rounds, but Auto Spire is entirely PVE.
**After**: Baby eggs now spawn after any lost fight in Spire (all encounter types). Pity timer resets on wins. Behavior matches original PAC PvP loss rules: 10% egg chance per Baby on board, 5% golden egg chance at tier 3, stacking pity on misses, guaranteed egg at tier 2+.
**Rationale**: Baby synergy was non-functional in Spire's all-PVE context. Enabling it makes the synergy a viable build option.
**Files changed**:
- `app/rooms/commands/game-commands.ts` — Added `this.spawnBabyEggs(player, false)` call in `stopSpireFightingPhase()`

### 2026-05-28 — Halve Tea dish PP gain

**Synergy**: GOURMET (dish: TEA)
**Type**: effect change
**Before**: Tea granted 80 PP at the start of the next fight.
**After**: Tea grants 40 PP at the start of the next fight.
**Rationale**: 80 PP on spawn was too strong — many Pokemon could cast their ability immediately or near-immediately.
**Files changed**:
- `app/core/dishes.ts` — `TEA` OnSpawnEffect: `addPP(80)` → `addPP(40)`
- `app/public/dist/client/locales/*/translation.json` — Updated TEA description in all locales

### 2026-05-28 — Halve Smoked Filet dish stat gains (keep HP cost)

**Synergy**: GOURMET (dish: SMOKED_FILET)
**Type**: effect change
**Before**: Permanently lose 5 max HP to gain 5 ATK and 10 AP.
**After**: Permanently lose 5 max HP to gain 3 ATK and 5 AP.
**Rationale**: The stat-for-HP trade was too efficient. Halving the gains (rounded up) while keeping the full HP cost makes it a riskier trade-off.
**Files changed**:
- `app/core/dishes.ts` — `SMOKED_FILET` OnDishConsumedEffect: ATK `5→3`, AP `10→5`, HP loss unchanged at `-5`
- `app/public/dist/client/locales/*/translation.json` — Updated SMOKED_FILET description in all locales
