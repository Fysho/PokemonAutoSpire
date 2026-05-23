# PokemonAutoSpire - AI Development Guide

## What This Project Is

PokemonAutoSpire is a single-player roguelike mod of [Pokemon Auto Chess](https://github.com/keldaanCommunity/pokemonAutoChess). It combines PAC's auto-battler mechanics (synergies, items, abilities, board placement) with Slay the Spire-style roguelike progression (branching map, permadeath, relics, act-based progression).

The original PAC codebase is in `pokemonAutoChess/`. All modifications live within that directory. The original multiplayer infrastructure (Colyseus) is kept but runs locally as an embedded server — Firebase auth and MongoDB are stripped.

## How to Run

```bash
cd pokemonAutoChess
node esbuild.js          # Build client (outputs to app/public/dist/client/)
npx ts-node-dev --transpile-only ./app/index.ts   # Start server on port 9000
# Open http://localhost:9000 in browser
```

The client auto-connects to the local Colyseus server, creates a game room, and starts a run.

## Architecture Overview

```
CLIENT (Phaser 4 + React + Redux)          SERVER (Node.js + Colyseus)
├── Phaser game scene renders board         ├── GameRoom manages game state
├── React overlays for UI (map, shop, etc)  ├── OnUpdateCommand ticks game loop
├── Redux stores game state for React       ├── OnUpdatePhaseCommand drives phases
├── Colyseus SDK syncs state from server    ├── Simulation runs auto-battles
└── network.ts handles connection           └── MiniGame handles shop carousel
```

### Game Flow (Phase State Machine)

```
MAP → [player clicks node] → PICK → [player clicks Start Fight] → FIGHT → REWARD → MAP
                              ↑                                              ↑
                         SHOP (carousel walk-around)                    Pokemon pick + relic choice
                         REST (heal HP)
                         EVENT (mystery encounter choices)
```

Phases are defined in `GamePhaseState` enum (`app/types/enum/Game.ts`):
- `PICK` (0), `FIGHT` (1), `TOWN` (2 - legacy, unused), `MAP` (3), `SHOP` (4), `REST` (5), `EVENT` (6), `REWARD` (7)

The phase state machine lives in `OnUpdatePhaseCommand.execute()` in `app/rooms/commands/game-commands.ts` (~line 1070). This is the most critical function in the codebase.

### Key Modification Points

| What you want to change | Where to look |
|---|---|
| Phase transitions | `game-commands.ts` → `OnUpdatePhaseCommand.execute()` |
| Battle encounters | `app/models/spire-encounters.ts` |
| Map generation | `app/core/map-generator.ts` |
| Shop types/items | `app/models/spire-shops.ts` |
| Mystery events | `app/models/spire-events.ts` |
| Relic definitions & effects | `app/core/relic-effects.ts` |
| Gold/HP/damage tuning | `spire-encounters.ts` → `getGoldReward()`, `game-commands.ts` → `stopSpireFightingPhase()` |
| Map UI | `app/public/src/pages/component/game/game-map.tsx` |
| Game page layout | `app/public/src/pages/game.tsx` |
| Board rendering/modes | `app/public/src/game/components/board-manager.ts` |
| Phase rendering in Phaser | `app/public/src/game/scenes/game-scene.ts` → `updatePhase()` |
| Room creation & lifecycle | `app/rooms/game-room.ts` |
| State schema (synced fields) | `app/rooms/states/game-state.ts` |
| Player schema | `app/models/colyseus-models/player.ts` |

## New Files (Spire-Specific)

### Server-Side
| File | Purpose |
|---|---|
| `app/core/map-generator.ts` | Generates StS-style branching maps per act (15 floors, 2-4 paths, convergence points, boss at end) |
| `app/core/relic-effects.ts` | 15 relic definitions using real Item enum values. Helper functions: `getRelicBonusGold()`, `getRelicPostBattleHeal()`, `getRelicDamageReduction()`, etc. |
| `app/models/colyseus-models/map-node.ts` | `MapNode` and `MapEdge` Colyseus schema classes. `MapNodeType` enum: WILD_BATTLE, GYM_LEADER, POKEMART, POKEMON_CENTER, MYSTERY_ENCOUNTER, LEGENDARY_BOSS |
| `app/models/spire-encounters.ts` | Wild encounter templates (8 themes with 3 difficulty tiers), gym leader teams (6), legendary bosses (3). `getWildEncounter()`, `getGymLeaderEncounter()`, `getLegendaryBossEncounter()`, `getGoldReward()` |
| `app/models/spire-events.ts` | 6 mystery encounter templates with choices. `getRandomEvent()`, `getEventItems()` |
| `app/models/spire-shops.ts` | 5 shop types (Pokemon/Component/Item/RareItem/Mixed). `getShopTypeForAct()`, `generateShopItems()`. Shop type scales with act. |

### Client-Side
| File | Purpose |
|---|---|
| `app/public/src/pages/component/game/game-map.tsx` | SVG-based branching map UI. Renders nodes (colored by type), edges, click handlers. |
| `app/public/src/pages/component/game/game-reward.tsx` | Post-fight reward overlay with HP/gold display and "Continue to Map" button |
| `app/public/src/pages/component/game/game-rest.tsx` | Pokemon Center healing overlay |
| `app/public/src/pages/component/game/game-event.tsx` | Mystery encounter UI with choice buttons |
| `app/public/src/pages/component/game/game-relic-bar.tsx` | Horizontal relic bar at top of screen with item icons and tooltips |
| `app/public/src/pages/component/game/game-run-end.tsx` | Victory/defeat screen with run stats and "New Run" button |

## Modified Files (Key Changes from Original PAC)

### `app/app.config.ts`
Stripped from 1126 to ~160 lines. Removed Firebase auth, MongoDB, all REST API routes, lobby/preparation/after-game rooms. Only registers `game` room.

### `app/index.ts`
Stripped from 107 to 13 lines. Just starts the Colyseus server.

### `app/rooms/game-room.ts`
- `onAuth()`: Returns mock user (no Firebase)
- `onCreate()`: Creates player with hardcoded defaults (no MongoDB lookup)
- `startGame()`: Generates Act 1 map, pushes starter Pokemon choice, spawns 2 random commons
- `onDispose()`: Simplified (no elo/DB saves)
- Added `SELECT_MAP_NODE` and `SKIP_REWARD` message handlers
- `pickChoice()`: Modified to route relic items to `player.relics` instead of `player.items`

### `app/rooms/commands/game-commands.ts`
- `OnUpdatePhaseCommand.execute()`: Rewritten with new phase state machine (MAP/SHOP/REST/EVENT/REWARD)
- Added: `initializeMapPhase()`, `onSelectMapNode()`, `initializeShopPhase()`, `initializeRestPhase()`, `initializeEventPhase()`, `initializeRewardPhase()`, `stopSpireFightingPhase()`, `handleEventChoice()`, `syncRunHPToPlayers()`
- `initializePickingPhase()`: Timer set to infinite (player-controlled via Start Fight button)
- `initializeFightingPhase()`: Uses spire encounters from map node instead of `PVEStages`
- `OnUpdateCommand`: MiniGame update runs during SHOP phase too

### `app/rooms/states/game-state.ts`
Added synced fields: `currentAct`, `currentFloor`, `mapNodes`, `mapEdges`, `currentNodeId`, `runHP`, `runComplete`, `runFailed`, `spireEncounterBoard`, `spireEventName`, `spireEventDescription`, `spireEventChoiceLabels`, `spireEventChoiceDescs`. Initial phase changed to `MAP`.

### `app/models/colyseus-models/player.ts`
Added `@type(["string"]) relics` array for run-wide passive bonuses.

### `app/models/colyseus-models/floating-item.ts`
Added `@type("uint8") price` and `@type("string") pokemonName` fields for shop carousel items.

### `app/core/mini-game.ts`
- Added `shopMode` flag
- Added `initializeShopCarousel()`: Spawns shop items as static floating items with prices
- Modified collision handler: In shop mode, allows multi-buy with gold deduction, removes items after purchase, no avatar movement lock
- Disabled carousel rotation in shop mode
- Avatars get 0 retention delay in shop mode

### `app/public/src/game/scenes/game-scene.ts`
- `uid`: Set to `"local-player"` (no Firebase)
- `updatePhase()`: Handles MAP, SHOP, REST, EVENT, REWARD phases
- Movement input and minigame update allowed during SHOP phase (not just TOWN)

### `app/public/src/game/components/board-manager.ts`
- Added `BoardMode.MAP` and `BoardMode.REWARD`
- Constructor handles new phase states
- Enemy preview uses `spireEncounterBoard` state field instead of `PVEStages`

### `app/public/src/game/game-container.ts`
- Added `onAdd`/`onRemove` listeners for `player.items` (fixes items not appearing)

### `app/public/src/game/components/floating-item-container.ts`
- Constructor accepts `price` and `pokemonName` params
- Renders gold price text above items and Pokemon name below

### `app/public/src/pages/game.tsx`
- `SpireEntry` component in `index.tsx` auto-creates and joins game room
- Renders `GameMap`, `GameReward`, `GameRest`, `GameEvent`, `GameRunEnd`, `GameRelicBar` based on phase
- "Start Fight" button during PICK phase (top-right)
- "Leave Shop" button during SHOP phase
- State listeners for `runHP`, `currentAct`, `currentFloor`, `runComplete`, `runFailed`, `mapNodes`
- `mapVersion` counter forces React re-render when Colyseus MapSchema updates

### `app/public/src/network.ts`
- `authenticateUser()`: Mock user login (no Firebase)
- Stub exports for all removed multiplayer functions (prevents dead-code import errors)

### `app/public/src/pages/component/game/game-stage-info.tsx`
- Shows "Act X - Floor Y" + HP instead of "Stage N"
- Timer bar only during FIGHT phase
- Removed `StagePath` component

### `app/public/src/pages/component/game/game-money-info.tsx`
- Simplified to just show gold (removed interest/streak display)

## Reused Systems (Unchanged from PAC)

These work as-is and should not need modification:
- **Battle simulation**: `app/core/simulation.ts` — server-side auto-battle engine
- **Pokemon entities**: `app/core/pokemon-entity.ts` — stats, state machine, damage
- **Abilities**: `app/core/abilities/` — 200+ ability implementations
- **Effects**: `app/core/effects/` — item effects, passive effects, synergy effects
- **Synergies**: 32 synergy types with tiered bonuses
- **Items**: 333+ items with crafting recipes
- **Evolution**: `app/core/evolution-rules.ts` — count, item, condition, hatch evolution
- **Pokemon data**: `app/models/precomputed/` — all Pokemon stats, rarity, types
- **Board grid**: 8x8 drag-drop placement
- **Pokemon sprites**: All animation and rendering
- **Level-up system**: Gold → XP → team size

## Known Issues / Incomplete Features

1. **Relic effects partially wired**: Battle stat relics (Muscle Band +ATK, Charcoal +AP, etc.) are defined but not applied during battle initialization. Only gold/heal/XP/damage-reduction relics work.
2. **Mystery events**: Only 6 event templates. Item rewards from events may not always render properly due to phase timing.
3. **Save/Load**: Not implemented. Runs must be completed in one session. Plan: serialize GameState to localStorage.
4. **Pokemon shop items**: Use egg icon placeholder instead of actual Pokemon sprites in the carousel.
5. **Encounter variety**: Only 8 wild encounter templates. Need more for 45 total floors.
6. **Balance**: Gold rewards, encounter difficulty, relic power, and HP damage values need tuning through playtesting.
7. **Act transition UI**: No "Act Complete" overlay — map just regenerates silently.
8. **Meta-progression**: No unlocks between runs. Every run starts the same.
9. **Difficulty modes**: No ascension system or difficulty selection.

## How Colyseus State Sync Works

Server modifies schema objects (GameState, Player, MapNode, etc.) → Colyseus automatically broadcasts field changes to connected clients → Client listeners in `game-container.ts` and `game.tsx` receive changes → Dispatch to Redux store or update Phaser scene.

**Key pattern for adding synced state:**
1. Add `@type("...")` field to a Schema class (e.g., `game-state.ts`)
2. Add `$state.listen("fieldName", callback)` in `game.tsx`
3. Add Redux action in `GameStore.ts` if React components need it
4. Or use directly from `room.state.fieldName` in JSX

**Key pattern for adding new messages:**
1. Add to `Transfer` enum in `app/types/index.ts`
2. Add `this.onMessage(Transfer.X, handler)` in `game-room.ts` → `onCreate()`
3. Send from client via `rooms.game?.send(Transfer.X, data)`

## Build Notes

- **Client**: esbuild bundles from `app/public/src/index.tsx`. Only imports reachable from entry point are bundled. Dead code (lobby, preparation, after-game pages) exists but isn't bundled.
- **Server**: `ts-node-dev` with `--transpile-only` (no type checking). TypeScript errors in dead code files don't prevent server startup.
- **Type checking**: `npx tsc --noEmit` will show errors in dead code files that import removed functions from `network.ts`. These are harmless — the stub exports in `network.ts` satisfy esbuild but not tsc.
