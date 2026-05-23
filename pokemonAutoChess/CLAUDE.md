# PokemonAutoSpire - AI Development Guide

## What This Project Is

PokemonAutoSpire is a single-player roguelike mod of [Pokemon Auto Chess](https://github.com/keldaanCommunity/pokemonAutoChess). It combines PAC's auto-battler mechanics (synergies, items, abilities, board placement) with Slay the Spire-style roguelike progression (branching map, permadeath, act-based progression).

The original PAC codebase is in `pokemonAutoChess/`. All modifications live within that directory. Colyseus runs locally as an embedded server — Firebase auth and MongoDB are stripped.

## How to Run

```bash
cd pokemonAutoChess
node esbuild.js          # Build client (outputs to app/public/dist/client/)
npx ts-node-dev --transpile-only ./app/index.ts   # Start server on port 9000
# Open http://localhost:9000 in browser
```

## Architecture Overview

```
CLIENT (Phaser 4 + React + Redux)          SERVER (Node.js + Colyseus)
├── Phaser game scene renders board         ├── GameRoom manages game state
├── React overlays for UI (map, shop, etc)  ├── OnUpdateCommand ticks game loop
├── Redux stores game state for React       ├── OnUpdatePhaseCommand drives phases
├── Colyseus SDK syncs state from server    ├── Simulation runs auto-battles
└── network.ts handles connection           └── MiniGame handles shop carousel
```

### Phase State Machine

```
MAP → [player clicks node] → PICK → [Start Fight button] → FIGHT → REWARD → MAP
                              ↑                                       ↑
                         SHOP (walk-around carousel, gold pricing)    Auto-transition when
                         REST (Pokemon Center: heal/ditto/dojo)      all choices picked
                         EVENT (mystery encounter choices)
```

Phases: `PICK` (0), `FIGHT` (1), `TOWN` (2 - legacy unused), `MAP` (3), `SHOP` (4), `REST` (5), `EVENT` (6), `REWARD` (7)

The phase state machine lives in `OnUpdatePhaseCommand.execute()` in `app/rooms/commands/game-commands.ts`.

### Key Modification Points

| What you want to change | Where to look |
|---|---|
| Phase transitions | `game-commands.ts` → `OnUpdatePhaseCommand.execute()` |
| Battle encounters (wild) | `app/models/spire-encounters.ts` → `getRegionalWildEncounter()` |
| Encounter difficulty scaling | `spire-encounters.ts` → `getDifficultyConfig()` |
| Elite encounters | `spire-encounters.ts` → `ELITE_ENCOUNTERS` array (18 encounters) |
| Gym leaders (early/late) | `spire-encounters.ts` → `EARLY_GYM_LEADERS` / `LATE_GYM_LEADERS` |
| Legendary bosses | `spire-encounters.ts` → `LEGENDARY_BOSSES` |
| Map generation | `app/core/map-generator.ts` → `generateActMap()`, `assignNodeType()` |
| Map layout (floors, nodes per floor) | `map-generator.ts` → `FLOORS_PER_ACT`, `MIN/MAX_NODES_PER_FLOOR` |
| Shop contents/pricing | `app/models/spire-shops.ts` → `generateShopItems()`, `RARITY_BASE_PRICE` |
| Pokemon sell price | `app/models/shop.ts` → `getSellPrice()` (currently always returns 1) |
| Mystery events | `app/models/spire-events.ts` |
| Passive item effects | `app/core/relic-effects.ts` → `PASSIVE_ITEMS`, helper functions |
| Gold rewards | `spire-encounters.ts` → `getGoldReward()` |
| HP damage on loss | `game-commands.ts` → `stopSpireFightingPhase()` |
| Map UI | `app/public/src/pages/component/game/game-map.tsx` |
| Opponent synergies | `app/public/src/pages/component/game/game-opponent-synergies.tsx` |
| Game page layout | `app/public/src/pages/game.tsx` |
| Start Fight button | `app/public/src/pages/component/game/game-experience.tsx` |
| Board rendering/modes | `app/public/src/game/components/board-manager.ts` |
| Phase rendering in Phaser | `app/public/src/game/scenes/game-scene.ts` → `updatePhase()` |
| Room creation & lifecycle | `app/rooms/game-room.ts` |
| State schema (synced fields) | `app/rooms/states/game-state.ts` |
| Player schema | `app/models/colyseus-models/player.ts` |
| Starter selection | `app/rooms/game-room.ts` → `startGame()` |

## Game Design Summary

### Run Structure
- **3 acts**, 20 floors each (60 total floors)
- 3-5 nodes per floor with branching paths (no crossing edges)
- Each act ends with a Legendary Boss (Mewtwo → Lugia+Ho-Oh → Weather Trio)

### Map Node Types
- **Wild Battle**: Regional encounters with synergy icons. Enemy Pokemon from region's synergy types. Background tilemap changes to region.
- **Gym Leader**: Floor 9 = easy (2-3 unevolved), Floor 18 = hard (3-4 evolved). Awards synergy gem + item choice.
- **Elite**: Floors 8/13/17. Themed encounters (18 total: Eeveelutions, Rotom forms, etc.). Win = special Pokemon, Lose = regular Pokemon.
- **PokeMart**: Walk-around shop carousel. 6 Pokemon + 6 items. Gold pricing (aggressive scaling).
- **Pokemon Center**: Floor 10 + Floor 19 guaranteed, ~10% random. Choose: Heal 30 HP | Ditto + item | Dojo ticket.
- **Mystery Encounter**: Random event with 2-3 choices.
- **Legendary Boss**: Floor 20 of each act. Awards gold (shiny) items.

### Economy
- Gold from battles: Wild 4+2*act, Elite 8+4*act, Gym 12+4*act, Boss 24+6*act
- Pokemon sell for 1 gold (flat)
- Shop prices: Pokemon scale by rarity (Common 2g → Ultra 24g, +6g/star). Items: components 4g, crafted 10g, tickets 2g, berries 4g.
- No interest/streak system

### Post-Fight Rewards
- **Wild wins**: Choose 1 of 3 Pokemon (each paired with random item component) + Ditto option (no item). Picking Ditto = no item bonus.
- **Wild losses**: Choose 1 of 3 random Pokemon (no items)
- **Elite wins**: Choose from the encounter's special Pokemon (with items)
- **Elite losses**: Choose from regular random Pokemon
- **Gym wins**: Synergy gem (auto-applied to bonusSynergies) + item choice from passive pool
- **Boss wins**: Gold/shiny item choice (Dynamax Band, Rare Candy, etc.)
- Auto-transitions to MAP when all choices picked

### Starter Selection
- Pick 1 of 3 first-stage starters (Bulbasaur, Charmander, etc.), each paired with a random item component
- Map hidden until starter is picked

## New Files (Spire-Specific)

### Server-Side
| File | Purpose |
|---|---|
| `app/core/map-generator.ts` | StS-style branching maps: 20 floors/act, 3-5 nodes/floor, no-crossing edges, fixed gym/elite/center/boss floors |
| `app/core/relic-effects.ts` | 15 passive items (PASSIVE_ITEMS list). Helpers: `getRelicBonusGold()`, `getRelicPostBattleHeal()`, `getRelicDamageReduction()`, `getRelicPokemonOfferCount()`, `getRelicBonusXP()`, `getRelicRestHealBonus()`, `getRandomItemChoices()` |
| `app/models/colyseus-models/map-node.ts` | `MapNode` (id, type, x, y, region, gymLeaderIndex, gymLeaderIsEarly, gymLeaderSynergy, eliteEncounterIndex) and `MapEdge` schemas. `MapNodeType` enum. |
| `app/models/spire-encounters.ts` | Regional wild encounters via `getRegionalWildEncounter()` with difficulty scaling (`getDifficultyConfig()`). 8 early + 8 late gym leaders. 18 elite encounter templates with 3 tiers. 3 legendary bosses. `getGoldReward()`. |
| `app/models/spire-events.ts` | Mystery encounter templates with choices. `getRandomEvent()`, `getEventItems()`, `getEventBerries()` |
| `app/models/spire-shops.ts` | Always 6 Pokemon + 6 items. Ditto weighted 3x. Pricing: `RARITY_BASE_PRICE` + `STAR_BONUS_PRICE`. `generateShopItems(act)` |

### Client-Side
| File | Purpose |
|---|---|
| `game-map.tsx` | SVG map with synergy icons (triangle layout for wild), gem icons (gym), pokeball (mart), unown-qm (mystery), chansey (center). Non-crossing edges. |
| `game-reward.tsx` | Shows "Continue to Map" button only when no choices remain (auto-transition handles most cases) |
| `game-rest.tsx` | Pokemon Center: 3 choices using event-style UI (heal/ditto+item/dojo ticket). Uses `game-choice.css` styling. |
| `game-event.tsx` | Mystery encounter choice buttons |
| `game-relic-bar.tsx` | Shows passive items from `player.items` filtered by `PASSIVE_ITEMS` list. Item icons with tooltips. |
| `game-run-end.tsx` | Victory/defeat screen with stats and "New Run" button |
| `game-opponent-synergies.tsx` | Enemy synergies panel during PICK/FIGHT. Computes from `spireEncounterBoard`. Uses `useEffect` on phase/stageLevel. |
| `game-experience.tsx` | Modified to include "Start Fight" button (red bubbly) next to level-up button during PICK phase |

## Key Modified Files

### `app/rooms/game-room.ts`
- `onAuth()`: Mock user (no Firebase)
- `onCreate()`: Player with defaults (no MongoDB)
- `startGame()`: Generates map, pushes starter choice (3 first-stage starters + paired items). Debug Mewtwos commented out.
- `pickChoice()`: When picking Ditto, skips paired item. Auto-transitions to MAP when REWARD choices exhausted.
- `SELECT_MAP_NODE`, `SKIP_REWARD`, `REROLL_REWARD` message handlers
- Event/rest choices handled via `choiceId === "event"` / `choiceId === "rest"`

### `app/rooms/commands/game-commands.ts`
- `OnUpdatePhaseCommand.execute()`: Full state machine (MAP/PICK/FIGHT/REWARD/SHOP/REST/EVENT)
- `onSelectMapNode()`: Sets player.map to region for tilemap, sets spireEncounterBoard, uses early/late gym leader functions
- `initializeShopPhase()`: Calls `miniGame.initialize(state, room, true)` (skipEncounters=true) then `initializeShopCarousel()`
- `initializeRestPhase()`: Sets up 3 choices (heal/ditto+item/dojo ticket by act) via spireEvent state fields
- `initializeRewardPhase()`: Gold + passive item effects (bonus gold, heal, XP). Pokemon picks with paired items. Ditto as 4th option for wild. Elite: special Pokemon on win, regular on loss. Gym: synergy gem + item choice. Boss: gold items + act transition.
- `stopSpireFightingPhase()`: HP damage with passive item reduction. Cleans up simulations.
- `initializeMapPhase()`: Clears encounter board, avatars, floating items. Resets player.map to "town".
- `initializePickingPhase()`: Clears avatars/floatingItems. Infinite timer.
- `OnUpdateCommand`: MiniGame physics update runs during SHOP phase
- AdditionalPicksStages logic removed (no more forced add-pick rounds)

### `app/rooms/states/game-state.ts`
Synced fields: `currentAct`, `currentFloor`, `mapNodes`, `mapEdges`, `currentNodeId`, `runHP`, `runComplete`, `runFailed`, `spireEncounterBoard`, `encounterDifficulty`, `spireEventName`, `spireEventDescription`, `spireEventChoiceLabels`, `spireEventChoiceDescs`

### `app/core/mini-game.ts`
- `shopMode` flag, `initializeShopCarousel()` with static positioning (radius 200x160)
- Shop collision: multi-buy with gold deduction, item removed after purchase, no avatar lock
- `initialize(state, room, skipEncounters)`: skipEncounters=true prevents PAC town encounters bleeding into shops
- `stop()`: Early return in shop mode (prevents EGG_FOR_SELL triggering giveRandomEgg)
- No carousel rotation in shop mode, 0 retention delay for avatars

### `app/models/colyseus-models/map-node.ts`
Fields: `region`, `gymLeaderIndex`, `gymLeaderIsEarly`, `gymLeaderSynergy`, `eliteEncounterIndex`

### `app/models/colyseus-models/floating-item.ts`
Added `price` (uint8) and `pokemonName` (string) for shop carousel

### `app/models/shop.ts`
`getSellPrice()` always returns 1 (original logic preserved but unreachable)

### `app/public/src/game/game-container.ts`
- `player.items` onAdd/onRemove listeners for item inventory updates
- `player.listen("map")` for tilemap loading on region change (preloads + setMap)

### `app/public/src/game/scenes/game-scene.ts`
- Movement input allowed during SHOP phase (not just TOWN)
- MinigameManager update runs during SHOP phase
- TOWN phase handler disabled

### `app/public/src/game/components/board-manager.ts`
- `BoardMode.MAP`, `BoardMode.REWARD` added
- Enemy preview from `spireEncounterBoard` only (PVEStages fallback removed)
- SHOP phase uses `minigameMode()`, TOWN removed from constructor

### `app/public/src/game/components/floating-item-container.ts`
- Price label (gold text) above items
- Pokemon portrait for Pokemon shop items (via PkmIndex lookup)
- Pokemon name text below

## Reused Systems (Unchanged from PAC)

- **Battle simulation**: `app/core/simulation.ts`
- **Pokemon entities**: `app/core/pokemon-entity.ts`
- **Abilities**: `app/core/abilities/` (200+)
- **Effects**: `app/core/effects/` (item, passive, synergy)
- **Synergies**: 32 types with tiered bonuses
- **Items**: 333+ items with crafting recipes
- **Evolution**: `app/core/evolution-rules.ts`
- **Pokemon data**: `app/models/precomputed/`
- **Board grid**: 8x8 drag-drop
- **Pokemon sprites**: All animation and rendering
- **Level-up**: Gold → XP → team size

## Known Issues / Incomplete Features

1. **Save/Load**: Not implemented. Runs must be completed in one session.
2. **Battle stat passive items**: Muscle Band (+ATK), Charcoal (+AP), etc. are defined but not applied during battle initialization. Only gold/heal/XP/damage-reduction passives work.
3. **Balance**: Gold, encounter difficulty, HP damage need playtesting.
4. **Act transition UI**: No "Act Complete" overlay — map regenerates silently.
5. **Meta-progression**: No unlocks between runs.
6. **Difficulty modes**: No ascension system.

## How Colyseus State Sync Works

Server modifies schema objects → Colyseus broadcasts to clients → Client listeners in `game-container.ts` and `game.tsx` dispatch to Redux or update Phaser.

**Adding synced state:**
1. Add `@type("...")` field to Schema class (e.g., `game-state.ts`)
2. Add `$state.listen("fieldName", callback)` in `game.tsx`
3. Add Redux action in `GameStore.ts` if React components need it

**Adding new messages:**
1. Add to `Transfer` enum in `app/types/index.ts`
2. Add `this.onMessage(Transfer.X, handler)` in `game-room.ts` → `onCreate()`
3. Send from client via `rooms.game?.send(Transfer.X, data)`

**Important Colyseus gotcha:** `MapSchema.onChange` fires when existing elements change, but `onAdd`/`onRemove` are needed for push/pop. React components reading Colyseus state directly won't re-render — use Redux dispatch or React state triggered by Colyseus listeners.

## Build Notes

- **Client**: esbuild from `app/public/src/index.tsx`. Dead code exists but isn't bundled.
- **Server**: `ts-node-dev --transpile-only` (no type checking).
- **Page title**: Set in `app/views/index.html` ("Pokemon: Auto Spire")
- **Type checking**: `npx tsc --noEmit` shows errors in dead code files — harmless.
