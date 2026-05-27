# PokemonAutoSpire - AI Development Guide

## What This Project Is

PokemonAutoSpire is a single-player roguelike mod of [Pokemon Auto Chess](https://github.com/keldaanCommunity/pokemonAutoChess). It combines PAC's auto-battler mechanics (synergies, items, abilities, board placement) with Slay the Spire-style roguelike progression (branching map, permadeath, act-based progression).

The original PAC codebase is in `pokemonAutoChess/`. All modifications live within that directory. Colyseus runs as the game server with Firebase for authentication and MongoDB for persistent data storage.

## Upstream PAC Reference (`pac-upstream/`)

An unmodified copy of the original Pokemon Auto Chess v6.9 source code is available at `pac-upstream/` (gitignored, `master` branch, commit `01c2ebe`). Use this to understand how the original PAC implements features like authentication, lobby rooms, database models, and game logic before adapting them for Auto Spire.

**IMPORTANT: Never edit files in `pac-upstream/`. It is a read-only reference.**

Useful for:
- Seeing how PAC originally handles auth (`pac-upstream/app/rooms/custom-lobby-room.ts`, `preparation-room.ts`)
- Understanding original MongoDB models (`pac-upstream/app/models/mongo-models/`)
- Comparing modified files against their originals: `diff pokemonAutoChess/app/some-file.ts pac-upstream/app/some-file.ts`
- Finding PAC features to restore or adapt

When a new PAC version releases (e.g. 6.10), the upgrade workflow is:
1. Clone the new version into a second folder (e.g. `pac-upstream-6.10`)
2. Diff against `pac-upstream/` to see what changed upstream
3. Apply relevant changes (bug fixes, new Pokemon, balance) to `pokemonAutoChess/`
4. Replace `pac-upstream/` with the new version after merging

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
| Elite encounters (handcrafted) | `spire-encounters.ts` → `ELITE_ENCOUNTERS_BY_ACT` (6/7/6 per act), `getEliteEncounter()` |
| Unlock encounters (proc-gen) | `spire-encounters.ts` → `UNLOCK_ENCOUNTERS_BY_ACT` (Act 1: hatch, Act 2: unique, Act 3: legendary), `getUnlockEncounter()` |
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
| Starter selection & reroll | `app/rooms/game-room.ts` → `startGame()`, `REROLL_STARTER` handler |
| Home Town (region choice) | `user-metadata.ts` (DB), `spire-lobby.tsx` (UI), `app.config.ts` (API), `team-snapshot.ts` (region field), `game-commands.ts` (E4/Champion map) |
| Run history / stats | `app/services/run-save.ts` → `saveRunHistory()`, `incrementRunStarted()`, `incrementRunEnd()` |
| Champion/E4 data | `app/services/champion-data.ts` → `loadChampionData()`, `promoteNewChampion()` |
| Discord announcements | `app/services/discord.ts` → `discordService.announceNewChampion()` |
| Difficulty balancing | `spire-encounters.ts` → `addHardModeItems()`, `applyHardBossBoost()`, `adjustEncounterItems()` |
| Dojo ticket tier | `game-commands.ts` → `getDojoTicket()` |
| Lobby UI | `app/public/src/pages/spire-lobby.tsx` |
| Profile / run history UI | `app/public/src/pages/component/profile/player-box.tsx`, `game-history.tsx` |
| API endpoints | `app/app.config.ts` |
| Admin cheats (game) | `game-room.ts` (`SKIP_TO_ACT`, `GIVE_MEWTWO`, `RESET_CHAMPION`), `game.tsx` (button panel, right side). Gated by `Role.ADMIN` on both server and client. |
| Colyseus monitor | `app/app.config.ts` → `/colyseus` route with basic auth. Requires `MONITOR_PASSWORD` env var. |

## Game Design Summary

### Run Structure
- **3 acts**, 20 floors each (60 total floors)
- 3-5 nodes per floor with branching paths (no crossing edges)
- Each act ends with a Legendary Boss (random from pool per act)

### Map Node Types
- **Wild Battle**: Regional encounters with synergy icons. In Acts 2-3, encounters focus on one synergy from the region.
- **Gym Leader**: Dynamically generated from `GYM_LEADER_POKEMON` map (18 synergy types). Floors 6/12/18 guaranteed, 9/15 at 40%. No synergy repeats per act. Act 2 biases unique Pokemon, Act 3 includes legendaries.
- **Elite**: Floors 4/8/11/13/17 (variable chance). Handcrafted themed encounters (19 total across acts). Faint red outline on map to distinguish from Unlock nodes.
- **Unlock**: Same floors as Elite (50/50 split). Proc-gen encounters that reward a specific Pokemon. Act 1: hatch mon eggs (12 families), Act 2: unique Pokemon, Act 3: legendary Pokemon.
- **PokeMart**: Walk-around shop. 6 Pokemon + 6 items + 2 eggs (Acts 1-2, 12g each). Ditto 3x weighted.
- **Pokemon Center**: Floor 10 + Floor 19 guaranteed, ~10% random. Choose: item component | Ditto | Dojo ticket (instant stats).
- **Mystery Encounter**: Random event with 2-3 choices.
- **Legendary Boss**: Floor 20 of each act. Boss randomly selected from act pool.

### Boss Encounters
- **Act 1** (3 options): Mewtwo & Mew, Tower Duo (Lugia + Ho-Oh), Lake Guardians (Azelf, Mesprit, Uxie)
- **Act 2** (3 options): Weather Trio, Legendary Birds, Beasts & Blade (Raikou, Entei, Suicune, Zacian)
- **Act 3** (1 option): Weather Trio (harder stats)

### Economy
- Gold from battles: Wild 2+act, Elite/Unlock 3+act*2, Gym 5+act*3, Boss 11+act*4
- Loss penalty: 1/3 of win gold
- Pokemon sell: 1★=3g, 2★=6g, 3★=10g
- Shop prices: Pokemon scale by rarity (Common 2g → Ultra 24g, +6g/star). Items: tickets 2g, berries 4g, components 6g, crafted 10g. Eggs 12g.
- No interest/streak system

### Post-Fight Rewards
- **Wild wins** (4 choices): 2-3 Pokemon + 1-2 item components. 33% chance one option is Ditto.
- **Wild losses** (3 choices): 1-2 Pokemon + 1-2 item components. No Ditto.
- **Elite wins**: Encounter-specific themed Pokemon with items
- **Elite losses**: Standard wild loss rewards
- **Unlock wins**: Single reward — the specific Pokemon shown on the node. Hatch mons (Act 1) are given as eggs.
- **Unlock losses**: Standard wild loss rewards
- **Gym wins**: Synergy gem (auto-applied) + choose one of: crafted item, Pokemon + component, or tool
- **Gym losses**: Standard wild loss rewards
- **Boss wins**: Choose 1 of 3 shiny items. No Pokemon offered.
- Auto-transitions to MAP when all choices picked

### Starter Selection
- Pick 1 of 3 random first-stage Pokemon, each paired with a random item component
- Infinite free rerolls via "Reroll" button — regenerates all 3 Pokemon + items each time
- Reroll is server-side (`REROLL_STARTER` message in `game-room.ts`), replaces the starter `PlayerChoice`
- Map hidden until starter is picked

### Home Town (Region Choice)
- Purely cosmetic — sets the tilemap background, no gameplay effect
- Player picks from all 145 DungeonPMDO regions + "Default (Town)" in lobby dropdown
- Saved to `spireRegion` field on UserMetadata in MongoDB, also cached in localStorage
- On run start, `startGame()` loads `spireRegion` from DB and sets `player.map` (tilemap shown during starter selection)
- When a player wins the champion fight, their current `spireRegion` is baked into the `TeamSnapshot.region` field in the champion data JSON file
- When another player fights that E4/Champion, their `player.map` is set to the snapshot's region (the defeated champion's home town at the time they won)
- Old champion/E4 entries without a region field gracefully default to "town"
- API: `GET /api/spire-region/:uid` and `PUT /api/spire-region/:uid` with `{ region: string }` body

## New Files (Spire-Specific)

### Server-Side
| File | Purpose |
|---|---|
| `app/core/map-generator.ts` | StS-style branching maps: 20 floors/act, 3-5 nodes/floor, no-crossing edges. Gyms on floors 6/12/18 (guaranteed) + 9/15 (40%). Elites on 8/13/17 (50%). Centers on 10/19. Boss on 20. |
| `app/core/relic-effects.ts` | 15 passive items (PASSIVE_ITEMS list). Helpers: `getRelicBonusGold()`, `getRelicPostBattleHeal()`, `getRelicDamageReduction()`, `getRelicPokemonOfferCount()`, `getRelicBonusXP()`, `getRelicRestHealBonus()`, `getRandomItemChoices()` |
| `app/models/colyseus-models/map-node.ts` | `MapNode` (id, type, x, y, region, gymLeaderSynergy, eliteEncounterIndex, displayName) and `MapEdge` schemas. `MapNodeType` enum (includes ELITE and UNLOCK). |
| `app/models/spire-encounters.ts` | Regional wild encounters via `getRegionalWildEncounter()` with difficulty scaling (`getDifficultyConfig()`). Dynamic gym generation via `generateGymEncounter()` with 18 synergy types and `GYM_LEADER_POKEMON` map. Elite encounter templates with act-specific tiers. Multiple boss options per act via `LEGENDARY_BOSSES` arrays. `getGoldReward()`. |
| `app/models/spire-events.ts` | Mystery encounter templates with choices. `getRandomEvent()`, `getEventItems()`, `getEventBerries()` |
| `app/models/spire-shops.ts` | 6 Pokemon + 2 eggs (Acts 1-2, 12g) + 6 items. Ditto weighted 3x. Pricing: `RARITY_BASE_PRICE` + `STAR_BONUS_PRICE`. `generateShopItems(act)` |
| `app/models/mongo-models/run-history.ts` | Mongoose model for completed run history. Stores: odToken, time, act, floor, difficulty, HP, arceusDamage, victory, team Pokemon with items. |
| `app/models/mongo-models/saved-run.ts` | Mongoose model for save/resume. Stores full game state snapshot for mid-run persistence. |
| `app/services/run-save.ts` | Save/load/delete runs, run history recording, player stat counters (`incrementRunStarted`, `incrementRunEnd`, `saveRunHistory`, `getRunHistory`). |
| `app/services/team-snapshot.ts` | Universal team save/load. `TeamSnapshot` captures full team state (board+bench, items, stats, shiny, emotion, dishes, TMs, inventory, ground holes, light position, optional region). `snapshotPlayerTeam()` serializes a Player — uses `pokemon._cookedDishes` fallback to capture dishes that were consumed during the fight. `reconstructTeamAsPlayer()` creates a real opponent Player for champion/E4 fights — sets `team=RED_TEAM`, computes synergies/effects directly bypassing `updateSynergies()` side effects, restores dishes to `pokemon.dishes` so they're visible during PICK. `encodeSnapshotForClient()` encodes board preview strings including dishes alongside items. |
| `app/services/champion-data.ts` | Elite Four & Champion persistence per difficulty using `TeamSnapshot` format (includes bench + Home Town region). JSON files (`champion-data.json`, `-easy`, `-hard`). `loadChampionData()`, `promoteNewChampion()`. Legacy format auto-migration. |

### Client-Side
| File | Purpose |
|---|---|
| `game-map.tsx` | SVG map with synergy icons (triangle layout for wild), gem icons (gym), pokeball (mart), unown-qm (mystery), chansey (center). Non-crossing edges. Background image from PAC poster `assets/posters/hd/6.6.png` at 20% opacity. |
| `game-reward.tsx` | Shows "Continue to Map" button only when no choices remain (auto-transition handles most cases) |
| `game-rest.tsx` | Pokemon Center: 3 choices using event-style UI (heal/ditto+item/dojo ticket). Uses `game-choice.css` styling. |
| `game-event.tsx` | Mystery encounter choice buttons |
| `game-relic-bar.tsx` | Shows passive items from `player.items` filtered by `PASSIVE_ITEMS` list. Item icons with tooltips. |
| `game-run-end.tsx` | Victory/defeat screen with stats and "New Run" button |
| `game-opponent-synergies.tsx` | Enemy synergies panel during PICK/FIGHT. Uses server-computed `encounterSynergies` for snapshot encounters (champion/E4 — includes Dragon double-types etc.), falls back to client-side computation for other encounters. |
| `game-opponent-items.tsx` | Shows opponent inventory items (gems, relics) during PICK/FIGHT. Reads from `encounterInventory` synced state. |
| `game-experience.tsx` | Modified to include "Start Fight" button (red bubbly) next to level-up button during PICK phase |

## Key Modified Files

### `app/rooms/game-room.ts`
- `onAuth()`: Verifies Firebase ID tokens via `admin.auth().verifyIdToken()`, creates UserMetadata document on first game (upsert), falls back to guest mode for players without `idToken`
- `onCreate()`: Player with defaults, accepts `resume` flag for save/load
- `startGame()`: Generates map, pushes starter choice (3 first-stage starters + paired items). Debug Mewtwos commented out.
- `pickChoice()`: When picking Ditto, skips paired item. Auto-transitions to MAP when REWARD choices exhausted.
- `spawnOnBench()`: Creates Pokemon on bench. Calls `pokemon.onAcquired(player)` to trigger lifecycle hooks (e.g., Deoxys gets Meteorite, Rotom gets Rotom Catalog). Used by all reward pick paths (wild, elite, unlock, gym).
- `SELECT_MAP_NODE`, `SKIP_REWARD`, `REROLL_REWARD` message handlers
- Event/rest choices handled via `choiceId === "event"` / `choiceId === "rest"`

### `app/rooms/commands/game-commands.ts`
- `OnUpdatePhaseCommand.execute()`: Full state machine (MAP/PICK/FIGHT/REWARD/SHOP/REST/EVENT)
- `onSelectMapNode()`: Sets player.map to region for tilemap, sets spireEncounterBoard, generates gym encounters dynamically via `generateGymEncounter()`
- `initializeShopPhase()`: Calls `miniGame.initialize(state, room, true)` (skipEncounters=true) then `initializeShopCarousel()`
- `initializeRestPhase()`: Sets up 3 choices (item component/ditto/dojo ticket by act) via spireEvent state fields
- `initializeRewardPhase()`: Gold + passive item effects (bonus gold, heal, XP). Wild: 4 choices on win (2-3 Pokemon + items, 33% Ditto), 3 on loss (1-2 Pokemon + items). Elite: themed rewards on win, wild-loss on loss. Gym: synergy gem + choose crafted item/Pokemon+component/tool. Boss: 3 shiny items only (no Pokemon). Act transition on boss win.
- `initializeFightingPhase()`: For PVE encounters, calls `cookDishesForPveBoard()` after computing synergies — auto-distributes Chef Hats and cooks dishes for PVE boards with Gourmet synergy (1 hat at count ≥3, 2 hats at count ≥5).
- `cookDishesForPveBoard()`: Standalone function. Checks Gourmet synergy count on PVE board, distributes Chef Hats to strongest Gourmet Pokemon, synchronously cooks dishes using same adjacency/priority logic as `chefCookEffect` in `items.ts`.
- `stopSpireFightingPhase()`: HP damage with passive item reduction. Cleans up simulations. On death: deletes saved run, saves run history, increments stats.
- `endArceusFight()`: Ends Arceus boss fight, records damage dealt. Deletes save, saves history, increments stats.
- `endChampionFight()`: Ends champion fight, promotes winner to champion data. Deletes save, saves history, increments stats.
- `checkRunDeath()`: Triggers when runHP <= 0 outside fight phase. Deletes save, saves history, increments stats.
- `getDojoTicket()`: Returns difficulty-adjusted dojo ticket tier.
- `initializeMapPhase()`: Clears encounter board, avatars, floating items. Resets player.map to "town".
- `initializePickingPhase()`: Clears avatars/floatingItems. Infinite timer.
- `OnUpdateCommand`: MiniGame physics update runs during SHOP phase
- AdditionalPicksStages logic removed (no more forced add-pick rounds)

### `app/rooms/states/game-state.ts`
Synced fields: `currentAct`, `currentFloor`, `mapNodes`, `mapEdges`, `currentNodeId`, `runHP`, `runComplete`, `runFailed`, `spireEncounterBoard`, `encounterDifficulty`, `encounterBonusHP`, `encounterBonusAtk`, `encounterBonusDef`, `encounterBonusSpeDef`, `encounterBonusAP`, `encounterBonusPP`, `encounterSynergies`, `gameSpeed` (float32), `arceusDamageDealt`, `spireEventName`, `spireEventDescription`, `spireEventChoiceLabels`, `spireEventChoiceDescs`

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

- **Battle simulation**: `app/core/simulation.ts` (modified: `start()` now processes dishes for PVE opponents via `refToBoardPokemon`, guards `player` access for PVE in `applyDishEffects`)
- **Pokemon entities**: `app/core/pokemon-entity.ts`
- **Abilities**: `app/core/abilities/` (200+)
- **Effects**: `app/core/effects/` (item, passive, synergy). `chefCookEffect` in `items.ts` records dishes to `pokemon._cookedDishes` for snapshot preservation.
- **Dishes**: `app/core/dishes.ts` — `DishByPkm` maps Pokemon to their dish type. RICE effect guards `player` access for PVE safety.
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
| `usermetadatas` | `app/models/mongo-models/user-metadata.ts` | User profiles keyed by Firebase uid. Includes `spireStats` with per-difficulty counters (runsStarted, wins, champion, arceusDamage) and `spireRegion` (Home Town choice, default "town"). Created via upsert on first game. |
| `runhistories` | `app/models/mongo-models/run-history.ts` | Completed run results with team, items, act/floor, damage, victory flag. Queried for profile run history display. |
| `savedruns` | `app/models/mongo-models/saved-run.ts` | Active save slots for run resume. One per player (upsert). Deleted on run end. |

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
| Save/resume runs | No | Yes |
| Run history | No | Yes (saved to MongoDB on run end) |
| Player stats | No | Yes (per-difficulty counters) |
| Account tab | Shows "Sign In" button | Shows name, email, sign out |
| Admin cheats | No | Yes, if `role: "ADMIN"` in UserMetadata |

### Admin Role System

- Player roles are stored in `usermetadatas.role` (MongoDB). Default is `BASIC`.
- To grant admin: set `role: "ADMIN"` on the user's document in MongoDB Atlas (or via mongoose script).
- **Server**: `game-room.ts` `onCreate()` fetches role from DB when creating the Player object. Message handlers (`SKIP_TO_ACT`, `GIVE_MEWTWO`, `RESET_CHAMPION`) check `player.role !== Role.ADMIN`.
- **Client**: `game.tsx` fetches `/api/user-role/:uid` on mount, dispatches `setRole()` to Redux. Admin buttons render when `profile.role === Role.ADMIN`.
- Admin cheat buttons (right side panel in game): Test Victory, Skip to Act 1/2/3, Give Mewtwo (buffed, repeatable), Skip to Elite 4, Skip to Act 5, Reset E4/Champion.
- `MONITOR_PASSWORD` env var enables the Colyseus monitor dashboard at `/colyseus` (basic auth: admin / password).

## Discord Integration

### Overview

When a player becomes Champion (beats the champion fight), a rich embed is posted to a Discord channel announcing the new champion with a generated team image.

### How It Works

- **Bot client**: A Discord bot (`Client` with `GatewayIntentBits.Guilds`) is initialized at server startup from `DISCORD_BOT_TOKEN` and `DISCORD_CHAMPION_CHANNEL_ID` env vars. If either is missing, the feature is silently disabled.
- **Trigger**: `endChampionFight()` in `game-commands.ts` calls `discordService.announceNewChampion()` after `promoteNewChampion()`. The call is fire-and-forget (non-blocking).
- **Embed content**: Title shows who defeated whom and difficulty. Fields show the new Elite Four lineup, relics, and synergy gems.
- **Generated image**: A composite PNG is created server-side with jimp containing:
  - Centered "Champion {name}" header text (32px Open Sans white)
  - Pokemon portraits (60px, resized from 40px source) with held item icons (18px) overlaid bottom-right
  - Active synergy icons (30px, from pre-converted PNGs) with count numbers, sorted by count descending (matching the in-game synergy panel order)
  - Canvas is always wide enough for 10 Pokemon (654px min width)

### Key Files

| File | Role |
|---|---|
| `app/services/discord.ts` | Discord webhook clients (bans, bots) + bot client for champion announcements. `generateTeamImage()` composites sprites. `computeSnapshotSynergies()` reconstructs synergies from a `TeamSnapshot`. |
| `app/rooms/commands/game-commands.ts` | `endChampionFight()` loads previous champion data, calls `promoteNewChampion()`, then `discordService.announceNewChampion()` with snapshot, difficulty, defeated champion name, and new E4 names. |
| `app/public/src/assets/types-png/` | Pre-converted PNG versions of synergy type icons (from SVGs in `types/`). Used by the image generator. |

### Environment Variables

| Variable | Purpose |
|---|---|
| `DISCORD_BOT_TOKEN` | Bot token from Discord Developer Portal → Bot → Reset Token |
| `DISCORD_CHAMPION_CHANNEL_ID` | Target channel ID (Developer Mode → right-click channel → Copy ID) |

### Asset Dependencies

- **Pokemon portraits**: `app/public/src/assets/portraits/{index}/Normal.png` (40x40, resized to 60x60)
- **Item icons**: `app/public/src/assets/item{tps}/{ITEM_NAME}.png` (90x90, resized to 18x18)
- **Synergy icons**: `app/public/src/assets/types-png/{SYNERGY}.png` (42x42, resized to 30x30)
- **Fonts**: Bundled with `@jimp/plugin-print` at `node_modules/@jimp/plugin-print/fonts/open-sans/`

### Existing Webhook Features (from upstream PAC)

The same `discord.ts` file also has webhook-based announcements for bans and bot approvals using `DISCORD_WEBHOOK_URL` and `DISCORD_BAN_WEBHOOK_URL`. These are separate from the champion bot integration.

## Known Issues / Incomplete Features

1. **Battle stat passive items**: Muscle Band (+ATK), Charcoal (+AP), etc. are defined but not applied during battle initialization. Only gold/heal/XP/damage-reduction passives work.
2. **Balance**: Gold, encounter difficulty, HP damage need playtesting.
3. **Act transition UI**: No "Act Complete" overlay — map regenerates silently.
4. **Meta-progression**: No unlocks between runs.
5. **Ascension system**: Ranks defined in lobby UI but all say "Coming soon". No gameplay modifiers implemented yet.
6. **Version number**: Displayed in two places — `auth.tsx` (login screen) and `spire-lobby.tsx` (lobby "Play" panel title). Must be updated manually in both.

## API Endpoints (`app/app.config.ts`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/saved-run/:uid` | GET | Fetch saved run summary for resume display |
| `/api/saved-run/:uid` | DELETE | Delete saved run (abandon) |
| `/api/run-history/:uid` | GET | Paginated run history (`?page=N`) |
| `/api/champion-data/:difficulty` | GET | Elite Four & Champion data (0/1/2) for lobby display |
| `/api/spire-region/:uid` | GET | Player's Home Town region choice (returns `{ region: string }`) |
| `/api/spire-region/:uid` | PUT | Save Home Town region (`{ region: string }` body) |
| `/api/spire-stats/:uid` | GET | Per-difficulty player stats (runs, wins, champion, arceus damage) |
| `/api/user-role/:uid` | GET | Returns `{ role }` from UserMetadata (used by client to show admin UI) |
| `/colyseus` | GET | Colyseus monitor dashboard (basic auth: admin / `MONITOR_PASSWORD` env var) |
| `/status` | GET | Server status: CCU (active game room clients), total accounts, version |
| `/titles` | GET | Returns `[]` (stub to prevent PAC client 404) |

## Difficulty Balancing

### Dojo Tickets by Difficulty
| Act | Easy | Normal | Hard |
|---|---|---|---|
| 1 | Silver | Bronze | Bronze |
| 2 | Silver | Silver | Silver |
| 3 | Gold | Gold | Silver |

### Hard Mode Extra Items (`addHardModeItems` in `spire-encounters.ts`)
Extra random item components added to each encounter Pokemon slot:
- Act 1: 0.5x team size
- Act 2: 1.25x team size
- Act 3: 1.75x team size

### Hard Mode Boss Boost (`applyHardBossBoost`)
Act 3 legendary bosses on hard get: +1 extra legendary Pokemon (random from Celebi/Jirachi/Victini/Manaphy/Shaymin/Phione) with Soul Dew, +200 HP, +5 ATK.

### Arceus (Act 5 Boss)
14 items, +5000 HP, +100 ATK, +40 DEF, +40 SpDEF, +300 AP. Arceus fight always ends in "defeat" — score is damage dealt.

### Game Speed
Cycles through 0.5x → 1x → 2x → 3x. State field is `float32`. Server validates allowed values in `GAME_SPEED` handler.

## Run End Paths

All run-ending paths must: (1) delete saved run, (2) save run history, (3) increment player stats. The 6 paths:

| Path | Location | victory | champion |
|---|---|---|---|
| Elite Four loss | `OnUpdatePhaseCommand` E4 branch | true | false |
| Arceus fight end | `endArceusFight()` | true | true |
| Champion fight end | `endChampionFight()` | true | !!winner |
| HP death (non-fight) | `checkRunDeath()` | false | false |
| Boss loss Act 3+ | `stopSpireFightingPhase()` boss branch | false | false |
| HP death (fight) | `stopSpireFightingPhase()` HP branch | false | false |

## Champion/E4 Opponent Reconstruction (Important Gotchas)

Champion and Elite Four opponents are saved player teams that fight as **real Player objects** (not the `{ id: "pve", board }` pattern used for wild/gym/elite/boss encounters). This enables full synergy behavior including ground holes, light spotlight, bench interactions, and Dragon double-types.

**Critical implementation details:**
- `reconstructTeamAsPlayer()` creates the opponent Player. It MUST set `player.team = Team.RED_TEAM` — synergy effects like `GroundHoleEffect` use `player.team` to flip board coordinates. Without it, hole lookups use wrong indices and return 0.
- Synergies/effects MUST be computed via `computeSynergies()` + `player.effects.update()` directly — NOT via `player.updateSynergies()`. The latter triggers side-effect methods (`updateScarves`, `updateArtificialItems`, `updateTms`, `updateFairyWands`, `updateWeatherRocks`, `updateFishingRods`) that add random junk items from the Player constructor's randomly-initialized fields, corrupting the opponent's state and potentially erroring before `effects.update()` runs.
- The opponent Player is temporary (not in `state.players`). It's passed directly to `new Simulation(...)` as the `redPlayer` parameter.
- Server-computed synergy counts are synced via `encounterSynergies` because client-side computation from encoded board strings misses Dragon double-types and other computed bonuses.
- Opponent ground holes are synced via `encounterGroundHoles` and rendered by `board-manager.ts renderOpponentGroundHoles()` on the opponent's board half.
- When selecting an E4/Champion node, `player.map` is set to the snapshot's `region` field (their Home Town) for the tilemap background. Falls back to default if region is missing or "town".

**Gourmet dish preservation:**
- Dishes are consumed (`pokemon.dishes.clear()`) during `Simulation.start()`, so by the time `snapshotPlayerTeam()` runs post-fight, `pokemon.dishes` is empty.
- Solution: `chefCookEffect` in `items.ts` records each assigned dish to `pokemon._cookedDishes` (non-schema runtime field). `snapshotPlayerTeam()` falls back to `_cookedDishes` when `dishes` is empty. `_cookedDishes` is reset at the start of each stage in `updatePlayerBetweenStages()`.
- `reconstructTeamAsPlayer()` restores dishes to `pokemon.dishes` (schema field) so they're visible to the client during PICK phase. `encodeSnapshotForClient()` includes dishes alongside items in the encoded board string for client-side rendering.
- `Simulation.start()` consumes the restored dishes normally, applying effects and clearing them.

**PVE Gourmet cooking:**
- PVE encounters use `{ id: "pve", board }` with no Player, so `OnStageStartEffect` (which includes `chefCookEffect`) never runs for them.
- `cookDishesForPveBoard()` in `game-commands.ts` handles this: checks Gourmet synergy count, distributes 1 Chef Hat (count ≥3) or 2 (count ≥5) to strongest Gourmet Pokemon, then synchronously cooks dishes using the same adjacency logic as `chefCookEffect`.
- `Simulation.start()` processes PVE dishes via `entity.refToBoardPokemon.dishes` in the `else` (no player) branch, applying effects and clearing dishes.

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

## Login Page (`auth.tsx`)

- Logo: `assets/ui/AutoSpire.png`
- Title: "Pokemon Auto Spire"
- Login via PAC's `StyledFirebaseAuth` component (Google + Email providers)
- "Play as Guest" button bypasses auth and uses mock `"local-player"` uid
- Footer: version (currently V1.3), fan credit line, PAC credit, upstream version note, Discord link
- Built on Pokemon Auto Chess v6.9 (`master@01c2ebe`)

## Map Visuals (`game-map.tsx`)

- Background: PAC poster `assets/posters/hd/6.6.png` (The Cove) at 20% opacity, `cover` sizing, stretches to full SVG height
- Dotted path lines: `#999` (unvisited), `#aaa` (visited), `#444` (missed)
- Border: `#999` to match path lines
- Other PAC posters available at `assets/posters/` (non-HD: 3.8–6.9) and `assets/posters/hd/` (HD: 6.2–6.9) for future per-act backgrounds

## Build Notes

- **Client changes** require rebuild: `node esbuild.js` then hard refresh browser (Cmd+Shift+R). This applies to anything in `app/public/src/`.
- **Server changes** auto-reload when running with `npx ts-node-dev --transpile-only` (anything else in `app/`).
- **Client**: esbuild from `app/public/src/index.tsx`. Dead code exists but isn't bundled.
- **Server**: `ts-node-dev --transpile-only` (no type checking).
- **Page title**: Set in `app/views/index.html` ("Pokemon: Auto Spire")
- **Type checking**: `npx tsc --noEmit` shows errors in dead code files — harmless.
- **Server (production)**: `esbuild` bundles `app/index.ts` into a single CJS file with `--define:import.meta.url` polyfill for ESM compatibility. The original `tsc` build fails due to 60+ pre-existing type errors in upstream PAC code — esbuild bypasses this same as local dev.

## Production Deployment

### Infrastructure

| Service | Role | Details |
|---|---|---|
| **DigitalOcean** | VPS | Basic droplet, 2 vCPU / 2GB RAM, US East (NYC), Ubuntu 24.04 |
| **Cloudflare** | CDN / Cache / DNS | Free tier. Proxies all traffic (orange cloud). Caches static assets. WebSockets pass through uncached. |
| **Caddy** | Reverse proxy + HTTPS | On VPS, ports 80/443 → localhost:9000. Auto-issues Let's Encrypt certs. |
| **PM2** | Process manager | Auto-restarts on crash, survives SSH disconnect, auto-starts on reboot. |
| **MongoDB Atlas** | Database | External. Free tier on AWS `us-east-1`. |
| **Firebase** | Auth | External, Google-hosted. |

- **Domain**: `pokemon-auto-spire.com` — DNS via Cloudflare, registrar is GoDaddy
- **SSL**: Cloudflare **Full (Strict)**. Caddy holds the origin Let's Encrypt cert.
- **Node version**: 24.11.1 (via nvm on VPS)

### VPS Setup (no Docker)

Node.js 24.11.1 (nvm), npm, PM2, Caddy, Git. MongoDB and Firebase are external.

### Deploy Flow

```bash
cd /srv/PokemonAutoSpire/pokemonAutoChess
git pull
npm install          # only if package.json changed
npm run build        # builds client + server via esbuild
pm2 restart colyseus
```

### PM2 Commands

```bash
pm2 start ecosystem.config.js --env production  # first time only
pm2 save && pm2 startup                          # persist across reboots
pm2 status                                       # check running
pm2 logs                                         # view logs
pm2 restart colyseus                             # restart server
pm2 monit                                        # CPU/memory monitor
```

### Cloudflare Notes

- Static assets cached automatically; WebSockets pass through uncached
- Cache status: DevTools → Network → `cf-cache-status` header (HIT/MISS/DYNAMIC)
- Traffic: Cloudflare dashboard → Analytics & Logs → Traffic
- Unique visitors counted by IP per day

### Cert Renewal

Caddy auto-renews. If blocked by Cloudflare:
1. DNS → Edit A record → grey cloud (DNS only)
2. `systemctl restart caddy` on VPS
3. Wait 30s, flip back to orange cloud (Proxied)
