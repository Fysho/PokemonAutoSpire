# PokemonAutoSpire - AI Development Guide

## What This Project Is

PokemonAutoSpire is a single-player roguelike mod of [Pokemon Auto Chess](https://github.com/keldaanCommunity/pokemonAutoChess). It combines PAC's auto-battler mechanics (synergies, items, abilities, board placement) with Slay the Spire-style roguelike progression (branching map, permadeath, act-based progression).

The original PAC codebase is in `pokemonAutoChess/`. All modifications live within that directory. Colyseus runs as the game server with Firebase for authentication and MongoDB for persistent data storage.

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
| Pokemon sell price | `app/models/shop.ts` → `getSellPrice()` (1★=3g, 2★=6g, 3★=10g) |
| Mystery events | `app/models/spire-events.ts` |
| Passive item effects | `app/core/relic-effects.ts` → `PASSIVE_ITEMS`, helper functions |
| Gold rewards | `spire-encounters.ts` → `getGoldReward()` |
| HP damage on loss | `game-commands.ts` → `stopSpireFightingPhase()` |
| Map UI | `app/public/src/pages/component/game/game-map.tsx` |
| Opponent synergies | `app/public/src/pages/component/game/game-opponent-synergies.tsx` |
| Game page layout | `app/public/src/pages/game.tsx` |
| Start Fight button | `app/public/src/pages/game.tsx` (centered button at bottom: 170px during PICK phase) |
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
- Each act ends with a Legendary Boss (random from pool per act)

### Map Node Types
- **Wild Battle**: Regional encounters with synergy icons. In Acts 2-3, encounters focus on one synergy from the region.
- **Gym Leader**: Dynamically generated from `GYM_LEADER_POKEMON` map (18 synergy types). Floors 6/12/18 guaranteed, 9/15 at 40%. No synergy repeats per act. Act 2 biases unique Pokemon, Act 3 includes legendaries.
- **Elite**: Floors 8/13/17 (50% chance). Themed encounters with act-specific tiers.
- **PokeMart**: Walk-around shop. 6 Pokemon + 6 items + 2 eggs (Acts 1-2, 12g each). Ditto 3x weighted.
- **Pokemon Center**: Floor 10 + Floor 19 guaranteed, ~10% random. Choose: item component | Ditto | Dojo ticket (instant stats).
- **Mystery Encounter**: Random event with 2-3 choices.
- **Legendary Boss**: Floor 20 of each act. Boss randomly selected from act pool.

### Boss Encounters
- **Act 1** (3 options): Mewtwo & Mew, Tower Duo (Lugia + Ho-Oh), Lake Guardians (Azelf, Mesprit, Uxie)
- **Act 2** (3 options): Weather Trio, Legendary Birds, Beasts & Blade (Raikou, Entei, Suicune, Zacian)
- **Act 3** (1 option): Weather Trio (harder stats)

### Economy
- Gold from battles: Wild 2+act, Elite 3+act*2, Gym 5+act*3, Boss 11+act*4
- Loss penalty: 1/3 of win gold
- Pokemon sell: 1★=3g, 2★=6g, 3★=10g
- Shop prices: Pokemon scale by rarity (Common 2g → Ultra 24g, +6g/star). Items: tickets 2g, berries 4g, components 6g, crafted 10g. Eggs 12g.
- No interest/streak system

### Post-Fight Rewards
- **Wild wins** (4 choices): 2-3 Pokemon + 1-2 item components. 33% chance one option is Ditto.
- **Wild losses** (3 choices): 1-2 Pokemon + 1-2 item components. No Ditto.
- **Elite wins**: Encounter-specific themed Pokemon with items
- **Elite losses**: Standard wild loss rewards
- **Gym wins**: Synergy gem (auto-applied) + choose one of: crafted item, Pokemon + component, or tool
- **Gym losses**: Standard wild loss rewards
- **Boss wins**: Choose 1 of 3 shiny items. No Pokemon offered.
- Auto-transitions to MAP when all choices picked

### Starter Selection
- Pick 1 of 3 first-stage starters (Bulbasaur, Charmander, etc.), each paired with a random item component
- Map hidden until starter is picked

## New Files (Spire-Specific)

### Server-Side
| File | Purpose |
|---|---|
| `app/core/map-generator.ts` | StS-style branching maps: 20 floors/act, 3-5 nodes/floor, no-crossing edges. Gyms on floors 6/12/18 (guaranteed) + 9/15 (40%). Elites on 8/13/17 (50%). Centers on 10/19. Boss on 20. |
| `app/core/relic-effects.ts` | 15 passive items (PASSIVE_ITEMS list). Helpers: `getRelicBonusGold()`, `getRelicPostBattleHeal()`, `getRelicDamageReduction()`, `getRelicPokemonOfferCount()`, `getRelicBonusXP()`, `getRelicRestHealBonus()`, `getRandomItemChoices()` |
| `app/models/colyseus-models/map-node.ts` | `MapNode` (id, type, x, y, region, gymLeaderSynergy, eliteEncounterIndex, displayName) and `MapEdge` schemas. `MapNodeType` enum. |
| `app/models/spire-encounters.ts` | Regional wild encounters via `getRegionalWildEncounter()` with difficulty scaling (`getDifficultyConfig()`). Dynamic gym generation via `generateGymEncounter()` with 18 synergy types and `GYM_LEADER_POKEMON` map. Elite encounter templates with act-specific tiers. Multiple boss options per act via `LEGENDARY_BOSSES` arrays. `getGoldReward()`. |
| `app/models/spire-events.ts` | Mystery encounter templates with choices. `getRandomEvent()`, `getEventItems()`, `getEventBerries()` |
| `app/models/spire-shops.ts` | 6 Pokemon + 2 eggs (Acts 1-2, 12g) + 6 items. Ditto weighted 3x. Pricing: `RARITY_BASE_PRICE` + `STAR_BONUS_PRICE`. `generateShopItems(act)` |

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
- `onSelectMapNode()`: Sets player.map to region for tilemap, sets spireEncounterBoard, generates gym encounters dynamically via `generateGymEncounter()`
- `initializeShopPhase()`: Calls `miniGame.initialize(state, room, true)` (skipEncounters=true) then `initializeShopCarousel()`
- `initializeRestPhase()`: Sets up 3 choices (item component/ditto/dojo ticket by act) via spireEvent state fields
- `initializeRewardPhase()`: Gold + passive item effects (bonus gold, heal, XP). Wild: 4 choices on win (2-3 Pokemon + items, 33% Ditto), 3 on loss (1-2 Pokemon + items). Elite: themed rewards on win, wild-loss on loss. Gym: synergy gem + choose crafted item/Pokemon+component/tool. Boss: 3 shiny items only (no Pokemon). Act transition on boss win.
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

## Database & Authentication

### Overview

- **Firebase Auth**: Handles user accounts (Google sign-in, email/password). Each user gets a unique Firebase `uid`.
- **MongoDB Atlas**: Stores persistent data (run history, user profiles, Elite 4 teams). Free tier on AWS `us-east-1`.
- **Guest mode**: Players can skip sign-in and play as `"local-player"` — no data is saved.

### Credentials

All credentials live in `pokemonAutoChess/.env` (gitignored). See `.env-example` for the template.

| Variable | Source |
|---|---|
| `MONGO_URI` | MongoDB Atlas → Connect → Drivers. Must end with `/dev` database name. |
| `FIREBASE_API_KEY` through `FIREBASE_APP_ID` | Firebase Console → Project Settings → Web app config |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase Console → Project Settings → Service accounts → Generate private key JSON |

### Server Initialization (`app/index.ts`)

Startup order:
1. `dotenv.config()` loads `.env`
2. `firebase-admin` initializes with service account credentials
3. `mongoose.connect(MONGO_URI)` connects to MongoDB
4. Colyseus server starts on port 9000

### Authentication Flow

```
Browser                          Server
  │                                │
  ├─ / (Auth page)                 │
  │  ├─ Firebase login UI          │
  │  │  (Google or Email)          │
  │  └─ "Play as Guest" button     │
  │                                │
  ├─ /lobby (SpireLobby)           │
  │  └─ "Start Run" →             │
  │     client.create("game", {    │
  │       idToken,  ◄── Firebase token (or undefined for guests)
  │       odToken,  ◄── Firebase uid (or "local-player")
  │       ...                      │
  │     })                         │
  │                                │
  │                          ┌─────┤
  │                          │ game-room.ts onAuth()
  │                          │  if idToken:
  │                          │    admin.auth().verifyIdToken(idToken)
  │                          │    admin.auth().getUser(uid)
  │                          │  else:
  │                          │    accept as guest
  │                          └─────┤
  │                                │
  ├─ /game                         │
```

### Key Files

| File | Role |
|---|---|
| `.env` | All credentials (gitignored) |
| `app/index.ts` | dotenv, mongoose connect, firebase-admin init |
| `app/config/server/firebase.ts` | `FIREBASE_CONFIG` object (client-side, from env vars) |
| `app/rooms/game-room.ts` → `onAuth()` | Verifies Firebase ID tokens, falls back to guest |
| `app/public/src/network.ts` | Firebase client SDK init, `getIdToken()`, `authenticateUser()` guest fallback |
| `app/public/src/pages/auth.tsx` | Login page with StyledFirebaseAuth + "Play as Guest" |
| `app/public/src/pages/component/auth/login.tsx` | Firebase login UI (Google + Email providers) |
| `app/public/src/pages/component/auth/styled-firebase-auth.tsx` | FirebaseUI wrapper component |
| `app/public/src/pages/component/profile/account-tab.tsx` | Account tab: shows signed-in status, sign out button |
| `app/models/mongo-models/user-metadata.ts` | Mongoose schema for user profiles (PAC original, available for use) |

### Client Routing

| Route | Page | Auth Required |
|---|---|---|
| `/` | Auth (login page) | No |
| `/lobby` | SpireLobby (difficulty select, start run) | Redirects to `/` if no uid |
| `/game` | Game (active run) | Joined via room creation |

### esbuild & Environment Variables

`esbuild.js` loads `.env` via dotenv and injects Firebase config as `process.env.*` defines into the client bundle. The client never sees `MONGO_URI`, `FIREBASE_PRIVATE_KEY`, or other server-only secrets — only the 6 public Firebase config values are injected.

### MongoDB Collections

| Collection | Model | Purpose |
|---|---|---|
| `botv2` | `app/models/mongo-models/bot-v2.ts` | Bot team data (PAC original) |
| `usermetadatas` | `app/models/mongo-models/user-metadata.ts` | User profiles keyed by Firebase uid |

### Adding New Persistent Data

To store new data in MongoDB:
1. Create a Mongoose schema in `app/models/mongo-models/`
2. Import and use it in server-side code (rooms, commands)
3. No client-side changes needed — the client talks to the server via Colyseus messages, not directly to MongoDB

### Guest vs Signed-In Behavior

| Feature | Guest | Signed In |
|---|---|---|
| Play runs | Yes | Yes |
| uid | `"local-player"` | Firebase uid |
| Save run history | No | Yes (when implemented) |
| Account tab | Shows "Sign In" button | Shows name, email, sign out |

## Known Issues / Incomplete Features

1. **Run history**: MongoDB is connected but run results are not yet saved. Needs a new Mongoose model and save logic in `game-room.ts` on run end.
2. **Elite 4 teams by difficulty**: Not yet implemented. Needs a collection to store winning teams and a UI to display them.
3. **Battle stat passive items**: Muscle Band (+ATK), Charcoal (+AP), etc. are defined but not applied during battle initialization. Only gold/heal/XP/damage-reduction passives work.
4. **Balance**: Gold, encounter difficulty, HP damage need playtesting.
5. **Act transition UI**: No "Act Complete" overlay — map regenerates silently.
6. **Meta-progression**: No unlocks between runs.
7. **Difficulty modes**: No ascension system.

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
