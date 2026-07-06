# PokemonAutoSpire - AI Development Guide

## What This Project Is

PokemonAutoSpire is a single-player roguelike mod of [Pokemon Auto Chess](https://github.com/keldaanCommunity/pokemonAutoChess). It combines PAC's auto-battler mechanics (synergies, items, abilities, board placement) with Slay the Spire-style roguelike progression (branching map, permadeath, act-based progression).

The original PAC codebase is in `pokemonAutoChess/`. All modifications live within that directory. Colyseus runs as the game server with Firebase for authentication and MongoDB for persistent data storage.

## Upstream PAC Reference (`pac-upstream/`)

An unmodified copy of the original Pokemon Auto Chess **v6.10.1** source code is available at `pac-upstream/` (gitignored, `ref-6.10.1` branch = `origin/prod`, commit `79505b1`). Use this to understand how the original PAC implements features like authentication, lobby rooms, database models, and game logic before adapting them for Auto Spire.

The clone retains full upstream history, so you can still diff against the **6.9** base Spire forked from (commit `01c2ebe`): `git -C pac-upstream diff 01c2ebe ref-6.10.1 -- <path>`.

**IMPORTANT: Never edit files in `pac-upstream/`. It is a read-only reference.**

> **Server stability:** memory-leak / OOM and runaway-loop incidents and the rules to avoid
> them (e.g. every `presence.subscribe` needs a matching `presence.unsubscribe` with the same
> handler in `onDispose`; never run unbounded/un-awaited async or DB work on the per-tick
> update loop; latch any per-tick threshold action so it can't re-fire) are documented in
> `AI-MEMORY-LEAKS.md`. Read it before touching room lifecycle or `OnUpdateCommand` code, or
> when diagnosing a production OOM or a "nobody can start a run" outage.

Useful for:
- Seeing how PAC originally handles auth (`pac-upstream/app/rooms/custom-lobby-room.ts`, `preparation-room.ts`)
- Understanding original MongoDB models (`pac-upstream/app/models/mongo-models/`)
- Comparing modified files against their originals: `diff pokemonAutoChess/app/some-file.ts pac-upstream/app/some-file.ts`
- Finding PAC features to restore or adapt

**Upgrading to a new PAC version** (the 6.9→6.10 upgrade is documented in detail in `MIGRATION-6.9-to-6.10.md`). The proven workflow: in `pac-upstream/`, fetch the new release; create a synthetic merge base by overlaying the current Spire `pokemonAutoChess/` files onto the old upstream base commit, then 3-way `git merge` the new release into it (gives real conflict markers against Spire's edits). Resolve conflicts (keep Spire's intentional single-player/balance divergences, take upstream bugfixes, union imports, deep-merge locale JSON to preserve Spire's custom translation keys), copy the merged tree back into `pokemonAutoChess/`, then `git checkout <new-version>` in `pac-upstream/` so it becomes the new read-only reference. The project expects `npx tsc --noEmit` to be clean (upstream is 0 errors), even though the build itself uses esbuild.

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
| Elite encounters | **ALL modes, acts 1-3: elites are approved Elite Design library entries** (`populateEliteDesignNodes()` in `game-room.ts` — runs after every map gen incl. `advanceEndlessAct`; see Known Issue #8). A bracket with no approved design converts the node to a wild encounter. In Classic the design board still passes through `adjustEncounterItems`+`addHardModeItems` (exported from `spire-encounters.ts`) so easy/hard/impossible item scaling applies. The hardcoded proc-gen pool (`ELITE_ENCOUNTERS_BY_ACT` (5/7/6 per act), `getEliteEncounter()`, `mainPokemon` + `validPicks` star budget) now serves only **Endless acts 4+** and the mid-population/Fisho2 fallbacks. |
| Unlock encounters (proc-gen) | `spire-encounters.ts` → `UNLOCK_ENCOUNTERS_BY_ACT` (Act 1: hatch, Act 2: unique, Act 3: legendary), `getUnlockEncounter()` |
| Gym leaders (early/late) | `spire-encounters.ts` → `EARLY_GYM_LEADERS` / `LATE_GYM_LEADERS` |
| Legendary bosses | `spire-encounters.ts` → `LEGENDARY_BOSSES` |
| Map generation | `app/core/map-generator.ts` → `generateActMap()`, `assignNodeType()` |
| Tutorial mode | `app/models/tutorial.ts` (fixed map + scripted encounters + dialog scripts), `map-generator.ts` `generateTutorialMap()`, `game-commands.ts` (`onSelectMapNode`/`initializeRewardPhase`/`initializeMapPhase`/boss-win branches), client `tutorial-dialog.tsx`. See "Tutorial Mode". |
| Map layout (floors, nodes per floor) | `map-generator.ts` → `FLOORS_PER_ACT`, `MIN/MAX_NODES_PER_FLOOR` |
| Shop contents/pricing | `app/models/spire-shops.ts` → `generateShopItems()`, `RARITY_BASE_PRICE` |
| Pokemon sell price | `app/models/shop.ts` → `getSellPrice()` (1★=3g, 2★=6g, 3★=10g) |
| Mystery events | `app/models/spire-events.ts` |
| Relics (run-wide passives) | `app/core/relics.ts` (AUTO-GENERATED by `edit/generate-relics.py`) → `Relic` enum, `RELICS` registry (name/description/rarity/implemented). Combat effects (`relic-battle-effects.ts`, hooked in `simulation.ts` `addPokemon`); non-combat effects wired at their mechanic site (see "Implemented Relics" — 17 implemented). Classes + per-class exclusivity (`CLASS_EXCLUSIVE_RELICS`): `app/core/spire-classes.ts`. Wiki tab: `wiki-relics.tsx`. HUD: `game-relic-container.tsx`. Full table: `RELICS.md`. |
| Spire classes (6 characters) | `app/core/spire-classes.ts` → `SpireClass` enum, `SPIRE_CLASSES` (synergies + startingRelic per class). Data only; not yet wired into runs. |
| Gold rewards | `spire-encounters.ts` → `getGoldReward()` |
| HP damage on loss | `game-commands.ts` → `stopSpireFightingPhase()` |
| Map UI | `app/public/src/pages/component/game/game-map.tsx` |
| Opponent synergies | `app/public/src/pages/component/game/game-opponent-synergies.tsx` |
| In-game HUD (top bar) | `game-stage-info.tsx` (+ `.css`, shared with the bottom bar) — identity/vs/HP/gold/team/weather/timer + Leave Game button. See "In-Game HUD". |
| In-game HUD (bottom bar) | `game-bottom-bar.tsx` — regional pokemon icon + rarity chips (left), XP widget (center), speed + map buttons (right). `game-shop.tsx` now only hosts the `toast-money`/`toast-life` containers. See "In-Game HUD". |
| Mobile / touch behavior | See "Mobile / Touch Support" — rotate overlay, canvas sizing, tap-to-pick + long-press details, `pointer.wasTouch` gotcha, coarse-pointer CSS gates. |
| Music / jukebox | `pages/utils/audio.ts` — `MusicMode` (`auto`\|`manual`\|`shuffle`, module state) + `loadAndPlayMusic()`. `auto` = region music follows `player.map` (the listener in `game.tsx`, gated on `getMusicMode() === "auto"`); a jukebox pick (`jukebox.tsx`) sets `manual` so Spire's constant map→"town" resets stop clobbering it back to Treasure Town; `shuffle` plays unlooped and chains a random track on `complete`. Jukebox has an Auto button to resume region music. |
| Game page layout | `app/public/src/pages/game.tsx` |
| Start Fight button | `app/public/src/pages/game.tsx` (centered button at bottom: 170px during PICK phase) |
| Board rendering/modes | `app/public/src/game/components/board-manager.ts` |
| Inventory item stacking | `items-container.ts` (groups duplicate player items into one icon), `item-container.ts` (`setStackCount`/`stackText` count badge), `game-scene.ts` (drag "ghost" so same-component crafting still works). See "Inventory Item Stacking". |
| Phase rendering in Phaser | `app/public/src/game/scenes/game-scene.ts` → `updatePhase()` |
| Room creation & lifecycle | `app/rooms/game-room.ts` |
| State schema (synced fields) | `app/rooms/states/game-state.ts` |
| Player schema | `app/models/colyseus-models/player.ts` — Added `gameState` ref, `addRunHP()`, `getRunHP()`. See "Player Health" section. |
| Starter selection & reroll | `app/rooms/game-room.ts` → `startGame()`, `REROLL_STARTER` handler |
| Home Town (region choice) | `user-metadata.ts` (DB), `spire-lobby.tsx` (UI), `app.config.ts` (API), `team-snapshot.ts` (region field), `game-commands.ts` (E4/Champion map) |
| Player name / avatar persistence | `spire-lobby.tsx` (load/save, DB source of truth), `app.config.ts` (`/api/player-name`, `/api/player-avatar`, `/api/player-search`), `user-metadata.ts` (`displayName`/`avatar`). See "Never Use Firebase/Google Real Names". |
| Run history / stats | `app/services/run-save.ts` → `saveRunHistory()`, `incrementRunStarted()`, `incrementRunEnd()` |
| Champion/E4 data | `app/services/champion-data.ts` → `loadChampionData()`, `promoteNewChampion()`. Tracks `championSince` timestamp and `longestReign` per difficulty. |
| Arceus damage leaderboard | `app/services/arceus-record.ts` → Top 5 per difficulty. JSON files (`arceus-record.json`, `-easy`, `-hard`). `checkAndUpdateArceusRecord()`, `getArceusLeaderboardForClient()`. |
| Leaderboard Manager (admin) | `app/services/leaderboard-admin.ts` (role-gated wipe/remove orchestration) + per-board removal helpers in `champion-data.ts` (`removeChampionLadderEntry`), `arceus-record.ts` (`removeArceusRecord`), `endless-record.ts` (`removeEndlessRecord`), `victory-record.ts` (`getVictoryRecordsForAdmin`/`removeVictoryRecord`/`resetVictoryRecords`). API: `/api/admin/leaderboard/wipe`, `/api/admin/leaderboard/remove`, `/api/admin/victory-records/:difficulty`. UI: `component/leaderboard-manager/leaderboard-manager.tsx` (sidebar tab below Elite Designer, admin-only). See "Leaderboard Manager". |
| Discord announcements | `app/services/discord.ts` → `discordService.announceNewChampion()`, `announceArceusRecord()`, `announceNewLongestReign()`. Bot also listens for admin commands in `DISCORD_ADMIN_CHANNEL_ID`. |
| Server announcements | `app/services/announcement.ts` → `broadcastAnnouncement()`. Discord `/announce` → SSE to lobby + Colyseus presence to game rooms. Popup in `spire-lobby.tsx` and `game.tsx`. |
| Endless mode on/off toggle | `app/services/endless-config.ts` (persisted flag) → Discord `/endless enable\|disable`. Server gate in `game-room.ts` `onCreate()`; `GET /api/endless-enabled` + disabled button/tooltip in `spire-lobby.tsx`. |
| Difficulty balancing | `spire-encounters.ts` → `addHardModeItems()`, `applyBossBoost()`, `adjustEncounterItems()`, `getStarBudgetOffset()` |
| Dojo ticket tier | `game-commands.ts` → `getDojoTicket()` |
| Lobby UI | `app/public/src/pages/spire-lobby.tsx` — 3 nav tabs: **Leaderboards** (left panel), Rooms (Play), Dev Notes + PAC Diversions. **Left panel** has an internal sub-tab toggle **[Leaderboards \| Live Runs]** (`boardTab` state, defaults Leaderboards): Leaderboards shows the 4 boards (`ChampionDisplay`/`ArceusRecordDisplay`/`EndlessLeaderboardDisplay`/`VictoryLeaderboardDisplay`); Live Runs shows the spectate list (sorts by stage default / difficulty, furthest-first; sort+filter persist via `SPIRE_RUN_SORT_BY`/`_SORT_ASC`/`_FILTER_DIFFICULTY`). **Play tab** holds difficulty buttons, a **Tutorial \| Endless** two-panel row (Tutorial is a layout-only placeholder — "Start Tutorial" button has no handler yet), name/avatar/Home Town, and the **Spire Mode** card at the bottom. The Spire Mode card is a single vertical flow: "Choose your class" subheading → a **horizontal-scroll row** of 6 selectable class cards from `ALL_SPIRE_CLASSES` (each `flex: 1 0 200px`, showing name/theme/synergy icons/starting relic; grow to fill on wide screens, scroll if narrow) → "Ascension Level" subheading with the rank dropdown+icon on the left and description on the right (ranks all "Coming soon", `ascensionIndex` not yet passed to the run) → "Enter the Spire" → `startSpireRun(class)` → `createRoom` with `isSpire: true` + `spireClass`. Server status (CCU/accounts) is admin-only. Patch popup on new major.minor version, hotfix badge on patch-only bumps. Name validation blocks "Player"/"Username"/empty. |
| Profile / run history UI | `app/public/src/pages/component/profile/player-box.tsx` (avatar fetched from `/api/player-avatar/:uid` — Redux `profile.avatar` is a hardcoded default in `network.ts`, never the saved one), `game-history.tsx` (per-run progress label derived from act/floor: Acts 1-3 → `Act X Floor Y`; Act 4 → `Elite Four N` for floors 1-4, `Champion` for floor 5; beating Act 3 without entering the E4 → `Victory`. Arceus is ignored — it caps to Act 4/floor 5 and never overwrites an earlier E4 record), `account-tab.tsx` (name+email behind click-to-reveal) |
| API endpoints | `app/app.config.ts` |
| Admin cheats (game) | `game-room.ts` (`SKIP_TO_ACT`, `GIVE_MEWTWO`, `GIVE_POKEMON`, `GIVE_ITEM`, `GIVE_RELIC`, `RESET_CHAMPION`, `ADMIN_TELEPORT_NODE`), `game.tsx` (button panel, right side; includes `AdminGivePokemon` + `AdminGiveItem` + `AdminGiveRelic` searchable comboboxes), `game-map.tsx` (click any unvisited node). Gated by `Role.ADMIN` on both server and client. |
| Colyseus monitor | `app/app.config.ts` → `/colyseus` route with basic auth. Requires `MONITOR_PASSWORD` env var. |

## Game Design Summary

### Run Structure
- **3 acts**, 20 floors each (60 total floors)
- 3-5 nodes per floor with branching paths (no crossing edges)
- Each act ends with a Legendary Boss (random from pool per act)

### Map Node Types
- **Wild Battle**: Regional encounters with synergy icons. In Acts 2-3, encounters focus on one synergy from the region.
- **Gym Leader**: Dynamically generated from `GYM_LEADER_POKEMON` map (27 synergy types; Gourmet, Light, Artificial, Amorphous commented out). Floors 6/12/18 guaranteed, 9/15 at 40%. No synergy repeats per act. Act 2 biases unique Pokemon, Act 3 includes legendaries.
- **Elite**: Floors 4/8/11/13/17 (variable chance). Drawn from **approved Elite Design library entries** for the floor's bracket (`classicFloorToStageRange`: direct 20-floor mapping; act-1 floors ≤5 have NO elites — no act-1 "1-5" bracket exists and none should appear that early, so those nodes convert to wild); a bracket with no approved design converts the node to a wild battle. Faint red outline on map to distinguish from Unlock nodes.
- **Unlock**: Same floors as Elite (50/50 split). Proc-gen encounters that reward a specific Pokemon. Act 1: hatch mon eggs (13 families — `HATCH_BASES` in `spire-encounters.ts`; it's a hardcoded whitelist, NOT every `Rarity.HATCH` base, so a hatch mon missing from the list can never appear — that was the Sandile bug), Act 2: unique Pokemon, Act 3: legendary Pokemon.
- **PokeMart**: Walk-around shop. 6 Pokemon + 6 items + 2 eggs (Acts 1-2, 12g each). Ditto 3x weighted.
- **Pokemon Center**: Floor 10 + Floor 19 guaranteed, ~10% random. Choose: item component | Ditto | Dojo ticket (instant stats).
- **Mystery Encounter**: Random event with 2-4 choices. 11 encounters, each with a Pokemon portrait sprite (Kecleon default). No timeout — player must pick a choice.
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

> **Synergy gems contribute via `player.bonusSynergies`, not `player.items`.** A gem sitting in `player.items` does nothing for synergies on its own — `computeSynergies()` reads the count from `player.bonusSynergies`. So **every path that adds or removes a gem from inventory** must also mutate `bonusSynergies` (key = `SynergyGivenByGem[item]`) and call `player.updateSynergies()`. Add paths increment (gym reward, town carousel, Wanderer buried item, `pickChoice`, admin `GIVE_ITEM`); the sell path (`SELL_ITEM` in `game-room.ts`) decrements and deletes the key at 0. Forgetting this is why admin-given gems didn't count and sold gems didn't drop the synergy.

### Post-Fight Rewards
- **Wild wins** (4 choices): 2-3 Pokemon + 1-2 item components. 33% chance one option is Ditto.
- **Wild losses** (3 choices): 1-2 Pokemon + 1-2 item components. No Ditto.
- **Wild reward Pokemon star scaling** (`generateWildRewardPokemon()` in `spire-encounters.ts`): selection is **identical in every act** — one 1★ base form per region synergy (any rarity) + a 50% regional swap (forced to 1★ base candidates). A post-selection **upgrade pass** then offers some mons as their 2★ evolution: Act 1 never upgrades; Act 2 upgrades only COMMON/UNCOMMON mons; Act 3+ (incl. endless) upgrades any rarity. Each offered mon rolls independently at `REWARD_TWO_STAR_UPGRADE_CHANCE` (0.5). `get2StarForm()` resolves the evolution (prefers `.evolution`, falls back to a random branch from `.evolutions`, stays 1★ if the line has no 2★). Reward `act` is `state.currentAct`; **difficultyMode does not affect which reward Pokemon are offered** (only enemy encounters scale by difficulty — the sole difficulty-dependent reward is the Act 1-2 boss item pool, Tools vs ShinyItems).
- **Elite wins** (3 choices): Main pokemon + 2 from fight, each with item component. Reroll 1g (infinite). Pick 1.
- **Elite losses** (2 choices): 2 pokemon from the fight, no items. Pick 1.
- **Unlock wins**: Single reward — the specific Pokemon shown on the node. Hatch mons (Act 1) are given as eggs.
- **Unlock losses**: Standard wild loss rewards
- **Gym wins**: Synergy gem (auto-applied) + choose one of: crafted item, Pokemon + component, or tool. The offered Pokémon is an **evolved 2★ themed mon** of the gym's synergy (never a 1★ base form, never SPECIAL rarity) — `getGymLeaderBaseFormPokemon()` in `spire-encounters.ts` upgrades each 1★ roster member to its 2★ evolution and unions with any 2★ already in the roster, filtering out SPECIAL (the function name is legacy; it no longer returns base forms). Falls back to `Pkm.DITTO` only if a gym roster yields no eligible 2★ non-special mon.
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

## Endless Mode

### Overview
Separate game mode (`state.isEndless = true`) with infinite acts, async PvP fights, and uncapped difficulty scaling. No Elite Four or Arceus. Based on Normal difficulty.

### Map Layout (per act, 20 floors)
- **Floors 5, 10, 15**: 4 `ASYNC_FIGHT` nodes (choose 1 of 4 opponents)
- **Floor 20**: 4 `ASYNC_FIGHT` nodes (act-end boss replacement)
- **Floors 7, 17**: `GYM_LEADER` (guaranteed)
- **Floors 9, 19**: `POKEMON_CENTER` (guaranteed)
- **All other floors**: Standard random distribution (wild/elite/unlock/mystery/mart), no legendary bosses

### Async Fight System
- Players fight saved team snapshots from other players who reached the same stage
- **Storage**: MongoDB `asyncfightpools` collection, 100 entries per stage (FIFO), keyed by `act${N}-floor${M}`
- **Opponent selection**: 4 random from pool → fallback to previous stages recursively → Magikarp default
- **Team submission**: Player's team is saved to the pool when they reach an async fight floor (regardless of win/loss)
- **Fight reconstruction**: Uses `encounterSnapshot` path (same as Champion/E4 — full `reconstructTeamAsPlayer`)
- **Opponent display**: `node.displayName` = player name, `node.eliteAvatar` = avatar sprite index

### Difficulty Scaling (acts 4+)
- Base: Act 3 floor 20 config (8-9 pokemon, 3 items, EPIC/ULTRA rarity)
- Per act beyond 3: `+1 pokemonCount`, `+1 star budget`, `+1 maxItemsPerPokemon` every 2 acts
- No cap on pokemon count or items per pokemon — grows unbounded

### Rewards
- **Async fight floors 5/10/15**: Choose 1 of 3 random item components, reroll 1g. Gold: 3 + act*2.
- **Async fight floor 20** (act end): Choose 1 of 3 from ShinyItems+Tools pool, reroll 20g. Gold: 11 + act*4.
- Act transition always occurs after floor 20 (win or loss)

### Act 4+ Unlock Encounters
Hatch, unique, and legendary unlock pools are combined with equal chance (instead of act-specific pools).

### Elites in Endless
Acts 1-3 draw elites from the approved Elite Design library like every other mode (`populateEliteDesignNodes`, also called from `advanceEndlessAct`); acts 4+ keep the hardcoded proc-gen pool with uncapped scaling (the populate call self-gates to a no-op).

### Leaderboard
- Top 5 by furthest act/floor reached. JSON file: `endless-record.json`
- API: `GET /api/endless-record`
- Checked on run death (all death paths in `stopSpireFightingPhase`)

### Key Files
| File | Role |
|---|---|
| `app/models/mongo-models/async-fight-pool.ts` | Mongoose model for async fight FIFO pools |
| `app/services/async-fight-pool.ts` | Submit/retrieve opponents, recursive fallback |
| `app/services/endless-record.ts` | Top 5 leaderboard (JSON file) |
| `app/core/map-generator.ts` | `assignEndlessNodeType()` for endless floor layout |
| `app/rooms/game-room.ts` | `populateAsyncFightNodes()`, `asyncFightSnapshots` map |

### State Fields
- `state.isEndless` (`boolean`, synced) — gates all endless-specific logic
- `ISavedRunSummary.isEndless` — persisted in saved run for resume

### How to Start Endless Mode
Client sends `isEndless: true` in room creation options. Server forces `difficultyMode = 1` (Normal).

### Endless Admin Toggle (enable/disable)
Whether players may start *new* endless runs is gated by a global flag in `app/services/endless-config.ts` (`isEndlessEnabled()` / `setEndlessEnabled()`), persisted to `endless-config.json` (defaults to enabled). Admins flip it via the Discord `/endless enable|disable` command. Enforcement layers:
- **Server gate**: `game-room.ts` `onCreate()` throws on a new endless room when disabled, unless the creator is an admin (DB role lookup) — resuming an in-progress endless save is always allowed.
- **Client UI**: `spire-lobby.tsx` fetches `GET /api/endless-enabled` and, when disabled (and viewer isn't admin), greys out the "Start Endless" button with a hover tooltip (`.hometown-help-tooltip`; the Impossible button no longer uses this pattern — its unlock hint is a visible line below the scrollable difficulty row).

## Spire Mode

A **third run mode** (alongside Classic and Endless), built by parameterizing the shared run — NOT a fork. Gated by `state.isSpire` + `state.spireClass` (`game-state.ts`, synced); the lobby's class-selection card sends `isSpire`/`spireClass` (`spire-lobby.tsx` `createRoom`). Note `gameMode` is already PAC's lobby enum, so the discriminator is the `isSpire` boolean (mirrors the `isEndless` pattern), synced to Redux (`GameStore` `setIsSpire` + `game.tsx` listener). **Admin-only while in development**: the lobby card is hidden behind the `isAdmin` flag, and `game-room.ts` `onCreate` rejects a new `isSpire` room unless the creator's `UserMetadata.role` is ADMIN (same lookup pattern as the endless-disabled gate; resuming an existing spire save is always allowed).

Differences from Classic (everything else is reused):
- **16-floor acts** (`SPIRE_FLOORS_PER_ACT = 16`, `assignSpireNodeType` in `map-generator.ts`: boss 16, pre-boss heal 15, gyms 5/11 + 8@40%, elite/unlock floors one per quarter — 3/7/10/13, act 1 skips floor 3 (no act-1 "1-5" library bracket); each node on those floors rolls 45% elite / 25% unlock / 30% wild). `generateActMap` takes an `isSpire` param (threaded through `startGame`, `REROLL_MAP`, and the act-transition).
- **Ends at Act 3** — beating the Act 3 boss sets `runComplete` with `eliteFourAvailable = !isSpire`, so no Elite Four / Champion / Arceus.
- **Classes** (`spire-classes.ts`): you start holding your class's **starting relic** (granted in `startGame`), and your **starter offers are filtered to the class's 5 synergies** (`startGame`, falls back to the full pool if <5 match). Some relics' effects are synergy-scoped to the class (the 6 CLASS relics).
- **Levels & XP** — Spire starts at **level 1** on its OWN curve `SpireExpTable` (`config/game/experience.ts`: 2/6/10/16 then merges into classic 22/34/52/72; max level 9). `ExperienceManager.useSpireMode()` switches the curve (runtime `isSpireMode` flag → `table` getter; restored with `useSpireMode(false)` in `restoreRunToState`, keeping the saved level). Every fight offers a **claimable +1 XP reward row** (win or loss; an `"xp"` `PlayerChoice` the player clicks → `pickChoice` → `addExperience`). Gold buys XP 1:1; the encounter-rates chips (`game-rarity-percentage.tsx`, in the bottom bar via `game-bottom-bar.tsx` — see "In-Game HUD") reflect the level.
- **Independent difficulty** — `getSpireDifficultyConfig(act, floor)` in `spire-encounters.ts` (its OWN 16-floor curve so an act boss lands on floor 16/32/48 at boss scaling). `getDifficultyConfig(..., isSpire)` delegates to it; `isSpire` is threaded through the encounter functions (`getRegionalWildEncounter` / `generateGymEncounter` / `getEliteEncounter` / `getUnlockEncounter` / `generateLegendaryEliteEncounter`). Tune it freely without touching Normal. `difficultyMode` stays `1` for Spire (so `>= 2` hard-mode checks never fire).
- **Custom elites** — elite fights are drawn from the **approved** Elite Design library — since 2026-07 this applies to **ALL modes, acts 1-3**, not just Spire. `populateEliteDesignNodes()` (`game-room.ts`) runs after every map gen (start / reroll / act-transition / endless act advance / resume) and assigns a random approved design to each ELITE node; Spire's 16-floor act maps onto library brackets as quarters via `spireFloorToStageRange` (1-4→"1-5", 5-8→"6-10", 9-12→"11-15", 13-16→"16-20"); a bracket with no approved design converts the node to a normal wild encounter. The design's own win/loss reward pools drive the elite reward screen **in Spire only** (Pokémon + paired item granted together; `generateDesignRewardChoice` gates on `isSpire`) — classic/endless keep the classic elite reward flow (main + 2 fight mons + components) sourced from the design's board. See Known Issue #8 + `app/services/elite-design.ts`.
- **Relic rewards** — Spire **gym wins** offer gem / tool / **random un-held relic** (`game-commands.ts`). Relic options ride on `PlayerChoice.relics[]` and are granted in `pickChoice` (uniform, before the type-specific branches). This is the general relic-as-reward mechanism for future sources. The offered relic is filtered two ways: (1) **class exclusivity** — relics in `CLASS_EXCLUSIVE_RELICS` (`spire-classes.ts`) only appear for their class (the 6 class starters are each pinned to their own class, and the 5 Silent reward relics to SILENT); (2) **implemented-first** — `isRelicImplemented()` partitions the eligible pool so a no-effect/flavor relic is only offered once **every** implemented, class-eligible, un-held relic has been collected. ("Offered" = collected: declining an implemented relic keeps it in the priority pool, so it can re-appear — there is no offered-but-declined history yet.) Admin `GIVE_RELIC` bypasses both filters.
- **Rerolls = ticket items** — the free reroll buttons (wild/starter/elite/boss `REROLL_*` + Reroll Map) are hidden in Spire (`game-choice.tsx`, `game.tsx`); the server `REROLL_*` handlers stay intact. Instead, **reward-reroll tickets** (`Item.REROLL_TICKET` / `CLASS_REROLL_TICKET` / `UPGRADE_TICKET` / `ITEM_REROLL_TICKET` — see `RerollTickets`, unholdable consumables) drive it. On a Spire **wild**-reward screen (win **or** loss — both produce a `wildReward` choice and the regen preserves the win/loss shape; node must be a `WILD_BATTLE`) a button shows per held ticket → `Transfer.USE_REWARD_TICKET` → consumes 1 ticket + regenerates the offer (components included): basic = fresh region reroll; class = same rarity sharing a class synergy (ignores region); upgrade = one rarity higher keeping a region synergy (force-swap); **item = replaces the whole offer with item components only** — same option count, each a single random component, no Pokémon (`generateWildRewardChoice`'s `componentsOnlyCount` param). Logic: `rerollWildRewardClass` / `rerollWildRewardUpgrade` in `spire-encounters.ts`; `generateWildRewardChoice` takes an optional pokemon-pool override. ⚠️ The `USE_REWARD_TICKET` handler (`game-room.ts`) keeps the old offer in place, lets `generateWildRewardChoice` append the new one at the end, then `pop()`s it and **overwrites the old slot by index** (`player.choices[choiceIdx] = regenerated`) so the other reward rows (xp / ticket / berry) keep their place. It must NOT splice-insert mid-array: Colyseus `ArraySchema.splice` requires `insertCount <= deleteCount`, so a mid-array insert (deleteCount 0, insertCount 1) throws "insertCount must be equal or lower than deleteCount" and crashes the room. The reorder it prevents was the "berry shows weirdly" / wrong-`itemGrant`-row bug. Source: dropped post-fight (below) + admin Give Item.
- **Post-fight drops** — after **every** Spire fight (win or loss, all fight types), `initializeRewardPhase` adds claimable rows: the **+1 XP** row, **one ticket roll** (single random value: 40% `REROLL_TICKET` / 25% `CLASS_REROLL_TICKET` / 15% `ITEM_REROLL_TICKET` / 10% `UPGRADE_TICKET` / 10% nothing), and an **independent 30%** random **berry**. Tickets/berry use the **`"itemGrant"`** instant reward-row type (`PlayerChoice` with the item in `items[0]`; clicking it in `pickChoice` pushes the item to `player.items`). These count toward the REWARD→MAP completion like the other rows.
- **Persistence** — `isSpire`/`spireClass` are saved + restored (`saved-run.ts`, `run-save.ts` `restoreRunToState`).
- **Not yet**: ascension levels, Spire-specific scoring/leaderboard (intentionally deferred), in-game ticket/relic sources (only the class starter relic + gym relic exist), and verifying `player.relics` survives resume.

### Implemented Relics

17 of 179 relics have effects. The `CLASS_EXCLUSIVE_RELICS` set (6 CLASS starters + the 5 Silent reward relics) gates those relics to one class for *reward offers* (admin `GIVE_RELIC` ignores the gate); the 6 general reward relics below are offerable to any class. `RELICS.md` is the full generated table (regenerate after implementing one). The three wiring patterns: **type-scoped combat** effects go in `relic-battle-effects.ts` (added to `RELIC_SYNERGIES` + `RELIC_EFFECT_FACTORIES`, applied per-entity in `Simulation.addPokemon` to the player's BLUE team only); **non-combat** effects are wired directly at the mechanic site with a `player.relics.includes(Relic.X)` guard; **on-acquire** effects go in `GameRoom.grantRelic()` (the central relic-grant helper — see below). Class names below are the `CLASS_EXCLUSIVE_RELICS` gate; "—" = offerable to any class.

| Relic | Class | Rarity | Effect | Wired in |
|---|---|---|---|---|
| Burning Blood | Ironclad | CLASS | FIELD/NORMAL/WILD/ELECTRIC/FIRE: +1 ATK per attack | `relic-battle-effects.ts` (`OnAttackEffect`) |
| Ring of the Snake | Silent | CLASS | BUG/POISON/GRASS/FLORA/FAIRY: heal 1% maxHP/s | `relic-battle-effects.ts` (`PeriodicEffect`) |
| Cracked Core | Defect | CLASS | HUMAN/FIGHTING/PSYCHIC/LIGHT/ELECTRIC: +2 PP/s | `relic-battle-effects.ts` (`PeriodicEffect`) |
| Pure Water | Watcher | CLASS | DARK/GHOST/PSYCHIC/FIRE/LIGHT: +2 AP/s | `relic-battle-effects.ts` (`PeriodicEffect`) |
| Captain's Wheel | Drifter | CLASS | WATER/AQUATIC/ICE/FLYING/SOUND: +5% atkspeed +5% dodge on spawn | `relic-battle-effects.ts` (`OnSpawnEffect`) |
| Fossilized Helix | Behemoth | CLASS | GROUND/ROCK/FOSSIL/MONSTER/STEEL: shield = 10% maxHP on spawn | `relic-battle-effects.ts` (`OnSpawnEffect`) |
| Happy Flower | Silent | Common | FLORA kills grant 1 mulch stack | `relic-battle-effects.ts` (`OnKillEffect` → `player.collectMulch(1)`) |
| Violet Lotus | Silent | Common | FAIRY heal adjacent allies 1% maxHP/s (Green-Orb aura) | `relic-battle-effects.ts` (`PeriodicEffect`) |
| Mango | Silent | Common | 2× berry trees + 2× growth/fight | `game-commands.ts` stage-transition berry-tree loop (`min(slots, grassStep×2)` trees, +2 stages) |
| Odd Mushroom | Silent | Common | Holder's poison stacks to 2× the normal cap | `status.ts` `triggerPoison` (`origin.player?.relics?.includes` → `maxStacks *= 2`) |
| Ring of the Serpent | Silent | Common | Strongest BUG's battle clone copies its items | `synergies.ts` `cloneBugs` (`i === 0` branch copies `pokemonCloned.items` to the clone) |
| Dolly's Mirror | — | Common | Ditto always appears in a wild-win reward (was 33%) | `game-commands.ts` `generateWildRewardChoice` (`dittoChance = 1`) |
| Old Coin | — | Common | +40 gold the moment the relic is acquired | `game-room.ts` `grantRelic()` (on-acquire) |
| Bag of Preparation | — | Rare | +1 max board slot | `board.ts` `getMaxTeamSize()` (new optional `relics` arg; threaded to all 5 call sites incl. the 2 client ones) |
| Nilry's Codex | — | Common | +4 extra XP on a win (the claimable XP reward row) | `game-commands.ts` `initializeRewardPhase` (xp row value) |
| Golden Idol | — | Common | +50% gold from winning fights | `game-commands.ts` `initializeRewardPhase` (gold row value) |
| Matryoshka | — | Rare | same-family units each count separately for synergies | `player.ts` `updateSynergies()` (reuses `SpecialGameRule.FAMILY_OUTING` counting without setting the real game rule) |

**`GameRoom.grantRelic(player, relic, client?)`** is the central relic-grant helper (`game-room.ts`). All 3 grant paths route through it — reward pick (`pickChoice`), admin `GIVE_RELIC`, and the Spire class starter in `startGame`. It pushes the relic (unique per run) and fires on-acquire effects: **Old Coin** → `addMoney(40)` (+ a `PLAYER_INCOME` toast when a `client` is passed), **Matryoshka** → immediate `updateSynergies()` so the count updates without waiting for a board change.


## Tutorial Mode

A **fully-scripted, single-act guided run** that teaches the core mechanics. Built on the normal-mode ruleset (NOT spire/endless) and parameterized the same way the other modes are. Gated by `state.isTutorial` (`game-state.ts`, synced → Redux `setIsTutorial` + `game.tsx` listener). The lobby's **"Start Tutorial"** card (`spire-lobby.tsx`, next to Endless) calls `startTutorial()` → `createRoom(1,false,false,/*skipActiveCheck*/true,null,/*isTutorial*/true)`; `game-room.ts onCreate` sees `isTutorial`, sets `state.isTutorial = true` and pins `difficultyMode = 1`.

**Isolation guarantees** (a tutorial must never touch real progression): `autoSaveRun()` early-returns on `isTutorial` (never persists → not resumable, never clobbers the player's real save slot; it also early-returns on `isEliteTest` for the same reason — see Elite Designer), `incrementRunStarted` is skipped in `startGame`, and the boss-win path uses a dedicated `isTutorial` branch (sets `runComplete`, `eliteFourAvailable=false`, calls `markTutorialCompleted`) instead of the act-transition / `recordActThreeVictoryOnce` logic — so no stats / victory / run-history / leaderboard writes.

**Map** — `generateTutorialMap()` (`map-generator.ts`) builds a fixed map from `TUTORIAL_MAP` in `app/models/tutorial.ts` (a `TutorialNodeDef[][]`: one entry per floor, each a list of node defs). Called from `startGame` when `isTutorial` (instead of `generateActMap`). 10 floors; most are linear (1 node), but the **item (floor 3)** and **synergy (floor 5)** stages have **two wild nodes** so the player learns to choose a path. Edges connect every node of a floor to every node of the next; branch floors only ever neighbour single-node floors, so paths never cross. Floors: 1 wild (basics) · 2 wild (evolution) · 3 wild×2 (items) · 4 PokéMart · 5 wild×2 (synergies) · 6 mystery · 7 elite · 8 Pokémon Center · 9 gym (Misty) · 10 Act Boss (Mew).

**Scripted encounters** — `getTutorialEncounter(floor)` returns deliberately weak `SpireEncounter`s so the player always wins (loss is taught by text, never forced). `onSelectMapNode` overrides the generated `encounter` with it when `isTutorial` (and, for the ELITE node, repoints the `room.eliteFightPokemon/eliteMainPokemon` reward fields at it). The mystery node is forced to the gold-free **"Pokemon Day Care"** event in `initializeEventPhase`.

**Blocking dialog system** (reusable): `Transfer.TUTORIAL_DIALOG`. Server-side `GameRoom.sendTutorialDialog(trigger)` (no-op unless `isTutorial`) broadcasts `{trigger, steps:i18nKey[]}` from `TUTORIAL_DIALOG_STEPS` (`tutorial.ts`); `game.tsx` relays it as a `"tutorial-dialog"` window event; the **`tutorial-dialog.tsx`** overlay queues steps and shows them one at a time (Kangaskhan portrait + Next/Got it). The overlay is **blocking** (`pointer-events:auto`, dim backdrop, `z-index:250` — above the picker/map/run-end window) so the player must read each prompt before acting. The final **`complete`** prompt's button is **"Back to Menu"** → calls `game.tsx`'s `leave()` (the run is over; no resumable save). Trigger timing:
- **Client-driven** (perfectly timed to the UI, fired via the window event in `game.tsx`): `start` (welcome+pick-starter, when the starter picker appears) and `map_intro` (when "Continue to Map" / `openMap` first reveals the map). Their step keys are hardcoded in `game.tsx`.
- **Server-driven**: `path_choice` is sent from `initializeMapPhase` whenever the just-opened map has ≥2 available unvisited nodes (a branch floor) — so it shows over the map *before* the player picks. The per-node prompts (`wild1_pick`, `evolution`, `item_craft`, `synergies`, `mart`, `mystery`, `elite_pick`, `center`, `gym_pick`, `boss_pick`) fire from `onSelectMapNode`; reward prompts (`wild1_reward`, `gym_reward`) from `initializeRewardPhase`; `complete` from the boss-win branch.

**Teaching hand-outs** (server grants, gated by floor in `onSelectMapNode`): floor 2 spawns **2 Ditto** on the bench (drag onto the starter to clone → 3 copies → evolution); floor 3 pushes **one of every `ItemComponents`** to the inventory (craft + equip + "items can't be removed" warning). Strings live under `tutorial.*` in `dist/client/locales/en/translation.json` (English only; keep dash-free to match the existing prompts).

**Completion flag** — `markTutorialCompleted(uid)` (`run-save.ts`) sets `UserMetadata.tutorialCompleted`; exposed via `GET /api/tutorial-completed/:uid`. Currently recorded but not surfaced in the UI (the lobby ✓ badge was removed).


## New Files (Spire-Specific)

### Server-Side
| File | Purpose |
|---|---|
| `app/core/map-generator.ts` | StS-style branching maps: 20 floors/act, 3-5 nodes/floor, no-crossing edges. Gyms on floors 6/12/18 (guaranteed) + 9/15 (40%). Elites on 8/13/17 (50%). Centers on 10/19. Boss on 20. Endless mode: `assignEndlessNodeType()` places async fights on 5/10/15/20, gyms 7/17, centers 9/19. Spire mode: `assignSpireNodeType()` — 16 floors, boss 16, pre-boss heal 15, gyms 5/11 (+8@40%), elite/unlock floors one per quarter (3/7/10/13; act 1 skips floor 3 — no act-1 "1-5" library bracket), each node on those floors rolls 45% elite / 25% unlock / 30% wild. |
| `app/models/tutorial.ts` | **Tutorial mode** data: `TUTORIAL_MAP` (the fixed 10-floor map, two branch floors), `getTutorialEncounter(floor)` (weak scripted teams), and `TUTORIAL_DIALOG_STEPS` (trigger → ordered i18n step keys). Consumed by `generateTutorialMap` + the `isTutorial` branches in `game-commands.ts`. See "Tutorial Mode". |
| `app/models/mongo-models/async-fight-pool.ts` | Mongoose model for endless mode async fight FIFO pools (100 per stage) |
| `app/services/async-fight-pool.ts` | Submit/retrieve async fight opponents with recursive stage fallback and Magikarp default. `getAllAsyncOpponentsForStage()` returns the whole pool (no fallback) for elite-design success-rate measurement. Also stores the **classic difficulty-testing archives**: `onSelectMapNode` (`game-commands.ts`) submits the player's team when a classic run reaches floor 5/10/15/20 of acts 1-3, keyed `classic-<easy\|normal\|hard\|impossible>-actN-floorM` (same collection + FIFO-100; snapshot = team brought TO the floor, since classic floor 10 is a guaranteed Pokemon Center, not a fight). Nothing reads these yet (future difficulty testing); `getPopulatedAsyncStages()` regex-filters them out of the Elite Designer stage picker. |
| `app/models/mongo-models/elite-design.ts` | Mongoose model for the **Elite Design library** (`elitedesigns` collection). One doc per `(creatorUid, name)` (unique index). Stores `designJson` (the compact export string), extracted `act`/`stageRange`/`icon`, `creatorName`, `approved` (admin flag — gates appearance in Spire runs), and `results[]` (per-bracket-stage success-rate snapshots: wins/draws/losses/sampleSize/testedAt). |
| `app/services/elite-design.ts` | CRUD + helpers for the design library. `saveEliteDesign(uid, json, id?)` — `id` updates in place (creator **or admin**; clears results when the design content changed; the name-uniqueness check is scoped to the design's owner, not the editor, and an admin edit never reassigns `creatorUid`), no `id` creates (name-collision = error, 50/creator cap). Save runs `validateEliteDesignContent()` — full content validation (Pkm/Item enums, board coords x 0-7 / y 1-3, no duplicate cells, ≤24 units, ≤3 items/unit, bonus-stat bounds via `BONUS_LIMITS`, reward pools incl. `RANDOM_*` tokens, act+stage must be on `STAGE_LADDER` so act-1 "1-5" is rejected) — crafted import strings can't smuggle junk into the library. **Approval is cleared when a NON-admin changes an approved design's content or bumps its bracket** (pure renames keep it) — otherwise "get a tame design approved, then edit it" would bypass the admin gate on live Spire content. **Guests are blocked** (`isGuestUid` — all guests share the `"local-player"` uid, so save/bump/delete reject it; the client gates the whole designer modal and `game-room.ts onCreate` refuses guest `eliteTest` rooms). `listEliteDesigns`, `deleteEliteDesign` (creator/admin), `bumpEliteDesign` (move up/down the act+stage ladder, clears results, creator/admin), `setEliteDesignApproved` (admin only), `getApprovedEliteDesigns(act, stageRange)`, `saveEliteDesignResults(id, results, expectedDesignJson?)` (skips the write if the design changed mid-measure — stale rates must not attach to new content). ⚠️ **ACCEPTED RISK**: all these mutating endpoints trust a **client-supplied `uid`** (no Firebase token verification) and `GET /api/elite-designs` publishes `creatorUid`, so a crafted request can impersonate any creator — reviewed 2026-07 and accepted for the current trusted player base (see the header comment in the file). `designToSpireEliteData()` parses a design into a `SpireEncounter` (+ reward pools) for live Spire elites (icon → board[0]). `spireFloorToStageRange()` maps Spire's 16-floor act onto library brackets as quarters (1-4→"1-5", 5-8→"6-10", 9-12→"11-15", 13-16→"16-20"); `classicFloorToStageRange(act, floor)` maps classic/endless 20-floor acts directly (act-1 floors ≤5 → `""` = no elite; the node converts to wild — no act-1 "1-5" bracket exists and no elites should appear that early). |
| `app/services/elite-test.ts` | Elite Designer sandbox helpers. `parseEliteDesignExport()` / `applyEliteDesignToPlayer()` (build a design onto a Player for the watched test fight). `measureEliteDesign(room, json, act, stageRange, onProgress?, opts?)` — **headless** success-rate measurement: fights a design against EVERY saved endless team in the pools bracketing its stage range, stepping each `Simulation` in a tight `update()` loop (no client sync, `room.broadcast` no-oped via Proxy). `opts`: `shouldAbort` (checked between fights — room path passes "room empty", REST path its cancel flag), `poolCache` (share pool fetches across a bulk run), `skipLatch` (caller holds the latch for a whole batch — see `acquireEliteMeasureLatch`/`releaseEliteMeasureLatch`). **`createHeadlessMeasureRoom()`** — a stand-in GameRoom (virgin `GameState` in idle PICK + no-op `broadcast`/`spawnOnBench`/`rankPlayers`/`computeRoundDamage`/`checkEvolutions*`, empty `clients`) so measures can run WITHOUT a Colyseus room (the REST path, `elite-measure.ts`); the stub surface is the audited set of `room.*` accesses reachable from a Simulation — if a new ability touches a new room member, add it to the stub. **CLOCK GOTCHA:** each fight gets its OWN virtual `ClockTimer` (served via the room Proxy, ticked in lockstep, cleared before `sim.stop()`) — without it, delayed synergy/ability effects fire after teardown → server-killing `undefined.weather` crash. Module-level latch (one measure server-wide, shared across room + REST paths), `setImmediate` yield per fight. |
| `app/services/elite-measure.ts` | **Room-less measurement orchestration** (the measure path used by the Library UI — the in-room `MEASURE_ELITE_DESIGN` message still works as a fallback but the client no longer sends it). Measurement is headless server work, so it runs against `createHeadlessMeasureRoom()` with no test sandbox / game client load: `startEliteMeasure(uid, designId)` (any signed-in user), `startEliteMeasureAll(uid, {act?, stageRange?})` (**admin only** — a full library is minutes of CPU; one shared pool cache per batch so designs in the same bracket never re-fetch pools), `cancelEliteMeasure(uid)` (initiator or admin; the current design's partial fights are discarded, already-saved designs keep results), `getEliteMeasureStatus()` (module-level status: designId/name, done/total fights, batchIndex/batchCount, `completedCount` — bumped per saved design so the client knows to refresh — and `finished`: done/cancelled/error). Batches run fire-and-forget after the HTTP response; progress is **polled** (`GET /api/elite-measure-status`, 1s while active) and results persist per design (`saveEliteDesignResults` with the designJson guard), so a closed client loses nothing. One broken design logs + skips in a bulk run (single runs surface the error). |
| `app/services/endless-record.ts` | Top 5 endless leaderboard by act/floor (JSON file, mirrors arceus-record.ts pattern) |
| `app/services/endless-config.ts` | Admin-controlled global toggle for whether players can start Endless mode. `isEndlessEnabled()` / `setEndlessEnabled()`, persisted to `endless-config.json` (defaults enabled). Set via Discord `/endless enable\|disable`. |
| `app/core/relics.ts` | **Relics** — run-wide passive bonuses (Slay-the-Spire style), distinct from held items. **AUTO-GENERATED** — do not hand-edit the enum/registry; rerun `python3 edit/generate-relics.py` (from `pokemonAutoChess/`) after changing the art. Currently **179 relics** (StS relic set). `Relic` enum (id == PNG filename) + `RELICS` registry (`{ name, description, rarity, implemented }`) + `ALL_RELICS` + `RELIC_RARITIES` + `isRelic()` / `getRelicRarity()` / `isRelicImplemented()`. **Rarity is a relic-only `RelicRarity` enum** (decoupled from the global `Rarity`): `COMMON/UNCOMMON/RARE/EPIC` (rarity is now deterministic: every non-class relic is COMMON except a short pinned RARE list — Bag of Preparation, Matryoshka; the `SEED`/weighting roll was dropped, so UNCOMMON/EPIC are defined but unused) **+ a dedicated `CLASS` tier** for the 6 class starting relics. Colors/labels via `RELIC_RARITY_COLOR` / `RELIC_RARITY_LABEL` (base tiers reuse the global rarity palette CSS vars; CLASS is gold); `RELIC_RARITIES` orders CLASS first. Stored on `player.relics` (synced `ArraySchema<string>`, unique per run), shown in the top-left HUD (`game-relic-container.tsx`) + the Relics wiki tab (`wiki-relics.tsx`). **17 relics are implemented** (the 6 CLASS starters + 5 Silent reward relics + 6 general reward relics — see "Implemented Relics"); the **other 162 are `implemented: false` / `description: "no effect"`** and the economy helpers `getRelicBonusGold()` / `getRelicPostBattleHeal()` / `getRelicDamageReduction()` are **no-op stubs returning 0** (wiring framework in `game-commands.ts`). To implement a relic: add a `(description, True)` entry to `EFFECT_OVERRIDES` in the generator (so regenerate doesn't clobber it), regenerate (`python3 edit/generate-relics.py`, then regenerate `RELICS.md`), and wire the effect — combat (type-scoped) → `relic-battle-effects.ts`; non-combat → directly at the mechanic site (see "Implemented Relics" for examples); economy → the `relics.ts` helpers. Relics CAN be reward picks now (`PlayerChoice.relics[]` — granted in `pickChoice`; Spire gym wins offer one). **Icons:** source `app/public/src/assets/relics/<RELIC_ID>.png` (committed; `webp/` subfolder holds the original webp source art, converted via `edit/convert-webp-to-png.py`); served from `app/public/dist/client/assets/relics/` (gitignored — regen with `npm run assetpack`, or copy the pngs). NOTE: relics are not yet persisted across save/resume (`SavedRunData` doesn't serialize `player.relics`) and have no in-game source besides the admin `GIVE_RELIC` cheat. |
| `edit/generate-relics.py` | Regenerates `app/core/relics.ts` from the PNGs in `app/public/src/assets/relics/`. Derives relic ids from filenames, prettifies display names (with a `NAME_OVERRIDES` map for StS compound/possessive names), assigns a stable rarity (seeded). Re-run after adding/removing relic art. |
| `edit/convert-webp-to-png.py` | `python3 edit/convert-webp-to-png.py <in_dir> [out_dir] [--delete]` — converts webp source art to transparent PNG (used to turn `assets/relics/webp/*.webp` into the served `*.png`). |
| `app/core/spire-classes.ts` | **6 Spire classes** (the selectable "characters"): `SpireClass` enum (IRONCLAD/SILENT/DEFECT/WATCHER/DRIFTER/BEHEMOTH) + `SPIRE_CLASSES` registry (`{ name, theme, description, synergies: Synergy[5], startingRelic: Relic }`). Each class groups 5 synergies (some shared across two classes; BABY/DRAGON/GOURMET/ARTIFICIAL/AMORPHOUS are the classless universal pool — see `SYNERGY-CLASSES.md`). The class→startingRelic map is the canonical pairing (Ironclad=Burning Blood, Silent=Ring of the Snake, Defect=Cracked Core, Watcher=Pure Water, Drifter=Captain's Wheel, Behemoth=Fossilized Helix). **Wired into the run:** `game-room.ts` `require()`s `SPIRE_CLASSES` to grant the class `startingRelic` and filter the starter pool to the class synergies in `startGame` (gated by `state.isSpire`); the lobby Spire Mode card sets it. The per-class synergy list is **duplicated** in `relic-battle-effects.ts` (`RELIC_SYNERGIES`) — keep both in sync. Also exports **`CLASS_EXCLUSIVE_RELICS`** (`Partial<Record<Relic, SpireClass>>`): relics that may only be *offered as rewards* to one class — the 6 class starters (each pinned to its own class) + the 5 Silent reward relics (Happy Flower / Mango / Odd Mushroom / Ring of the Serpent / Violet Lotus). Holding/granting is NOT restricted (admin `GIVE_RELIC` works for any class); only the gym-win relic-offer pool in `game-commands.ts` honors it. See `SYNERGY-CLASSES.md`. |
| `app/core/relic-battle-effects.ts` | Type-scoped combat effects for relics (8 of the 17 implemented live here; the other 3 — Mango / Odd Mushroom / Ring of the Serpent — are non-combat and wired at their mechanic site). `RELIC_SYNERGIES` maps each relic to the synergies it buffs (the 6 class starters to 5 synergies each; the 2 Silent combat relics to 1 each — Happy Flower→FLORA, Violet Lotus→FAIRY) (kept here, decoupled from `spire-classes.ts` — it's a *relic* effect, not a class effect). `applyRelicBattleEffects(entity, player)` is called from `Simulation.addPokemon` for the **player's (BLUE) team only**; for each held relic it adds an Effect to `entity.effectsSet` when the entity's `types` include any of that relic's synergies ("has the type" — no activation threshold needed). Stacks across relics; re-applied fresh each battle; never runs on reconstructed opponents. Effects: Burning Blood → `OnAttackEffect` `addAttack(1)` per attack (copies the Fire synergy's `FireHitEffect`); Ring of the Snake / Cracked Core / Pure Water → `PeriodicEffect` (1s) `handleHeal(maxHP×1%)` / `addPP(2)` / `addAbilityPower(2)`; Captain's Wheel / Fossilized Helix → `OnSpawnEffect` (`addSpeed(5%)`+`addDodgeChance(0.05)`) / `addShield(maxHP×10%)`; **Happy Flower** → `OnKillEffect` `player.collectMulch(1)` on FLORA kills; **Violet Lotus** → `PeriodicEffect` (1s) heals adjacent allies `maxHP×1%` (Green-Orb-style aura, FAIRY only). (`EffectOrigin` in `effects/effect.ts` was widened to include `Relic`.) |
| `app/models/colyseus-models/map-node.ts` | `MapNode` (id, type, x, y, region, gymLeaderSynergy, eliteEncounterIndex, displayName) and `MapEdge` schemas. `MapNodeType` enum (includes ELITE and UNLOCK). |
| `app/models/spire-encounters.ts` | Regional wild encounters via `getRegionalWildEncounter()` with difficulty scaling (`getDifficultyConfig()`). Dynamic gym generation via `generateGymEncounter()` with 27 synergy types and `GYM_LEADER_POKEMON` map. Elite encounter templates with act-specific tiers. Multiple boss options per act via `LEGENDARY_BOSSES` arrays. `getGoldReward()`. |
| `app/models/spire-events.ts` | 11 mystery encounter templates with per-event portrait sprites. `getRandomEvent()`, `getEventItems()`, `getEventBerries()` |
| `app/models/spire-shops.ts` | 6 Pokemon + 2 eggs (Acts 1-2, 12g) + 6 items. Ditto weighted 3x. Pricing: `RARITY_BASE_PRICE` + `STAR_BONUS_PRICE`. `generateShopItems(act)` |
| `app/models/mongo-models/run-history.ts` | Mongoose model for completed run history. Stores: odToken, **`runId`** (indexed — one document per run; upserted on each milestone, see Run End Paths), time, act, floor, difficulty, HP, arceusDamage, victory, team Pokemon with items, and `synergies` (server-authoritative `{type,count}` snapshot taken at save time — includes gem bonus synergies, type-changing stones, Dragon double-types. Optional; legacy records without it fall back to client-side recomputation). |
| `app/models/mongo-models/saved-run.ts` | Mongoose model for save/resume. Stores full game state snapshot for mid-run persistence. |
| `app/services/run-save.ts` | Save/load/delete runs, run history recording, player stat counters. `restoreRunToState()` bypasses `updateSynergies()` to avoid duplicating synergy-spawned items (scarves, artificial items, TMs, wands). Preserves egg `evolution`, `stacks`, `stacksRequired`, **luck** (and all other stat boosts), plus `deathCount` / `originalMap` (evolution triggers — see "Evolution State Persistence") across save/restore. **Re-applies TMs** the same way the reconstruct paths do — a saved `snap.tm` restores `tm + skill + maxPP=100` (else a plain `snap.skill`); without this, resume rebuilt the mon via `createPokemonFromName` and `maxPP` reverted to the species value (the "TM'd mon shows 50 PP after resume" bug). **Flower-pot mons** live in `player.flowerPots`, NOT `player.board`, so they bypass `snapshotPlayerTeam` — `SerializedFlowerPot` carries their permanent `statBoosts` (e.g. Amaze Mulch's +50 HP / +30 AP) so the boost isn't dropped when the pot is rebuilt from name on resume. `SavedRunData` persists `runId` plus the `championChallenged` / `arceusChallenged` one-shot guards. `saveRunHistory()` upserts by `runId` and snapshots `player.synergies` directly; `saveRunHistoryFromSavedRun()` (abandoned runs) recomputes them from the saved board + `bonusSynergies` via `computeSynergies()`. **Streak integrity:** `saveRun()` upserts by `odToken` (one save slot per player), so starting a fresh run silently clobbers any existing save. When the overwritten doc has a **different `runId`** and wasn't a victory (`!isRunVictory`), `saveRun` records a **loss** for it (`saveRunHistoryFromSavedRun` + `updateVictoryRecord(won=false)`) right at the overwrite — otherwise loss-on-abandon was only enforced by the client calling `DELETE /api/saved-run`, letting a player keep a win streak alive forever by starting a new run over a losing one. Victory runs are skipped (the Act-3 win was already counted at boss-fall — no double-count, no false loss); `recordLoss` is idempotent so a race with a normal run-end delete is harmless. |
| `app/services/team-snapshot.ts` | Universal team save/load. `SnapshotPokemon` includes: name, position, items, shiny, emotion, statBoosts (incl. luck), skill, tm, dishes, evolution, stacks, stacksRequired, **deathCount**, **originalMap**. `TeamSnapshot` also carries `runId` (the run that placed it in the E4/Champion ladder) and `money` (gold the player held — reapplied to the reconstructed opponent so Gold Bottle Cap / Gholdengo work, and surfaced as `encounterMoney`). `snapshotPlayerTeam()` uses `_cookedDishes` fallback for dishes consumed during fight. `tm` (the applied TM's `Ability`, saved when `pkm.tm !== DEFAULT`) is the flag distinguishing a TM-changed ability from a Skill-Swap/Sketch-changed one: on reconstruct a `tm` is re-applied as `tm + skill + maxPP=100`, otherwise `skill` alone is restored. `reconstructTeamAsPlayer()` bypasses `updateSynergies()` side effects for champion/E4 opponents. **Evolution-trigger persistence (see "Evolution State Persistence" below):** `deathCount` (drives Corsola→Galarian Corsola + the Basculin→Basculegion male/female form) and `originalMap` (drives Stantler→Wyrdeer) are plain runtime instance fields, NOT schema-synced — they must be snapshotted/restored explicitly or the form reverts on resume. `snapshotPlayerTeam()` also **promotes a pending hatch**: if a non-egg HATCH mon has already met its requirement (`stacks >= stacksRequired`), it snapshots the *evolved* name (boosts stay computed vs the current form, which carries the same diff) so the deferred 2s `updateHatch` setTimeout can't be out-raced by the autosave (the Brionne→Primarina flicker). Restored in all 3 reconstruct paths + `run-save.ts restoreRunToState`. |
| `app/services/champion-data.ts` | Elite Four & Champion persistence per difficulty. JSON files (`champion-data.json`, `-easy`, `-hard`). `promoteNewChampion()` is a **swap** — the new champion vacates E4 #4 (where the climb placed them) and the dethroned champion slides into it; E4 #1-3 untouched. Returns `PromotionResult` with reign duration and longest reign info. Tracks `championSince` timestamp and `longestReign` record per difficulty. Per-slot defense records: `championVictories`/`eliteFourVictories` (challenger lost) and `championTies`/`eliteFourTies` (draw — neither side won before the timer; `incrementChampionTie`/`incrementE4Tie`); both surfaced on the lobby leaderboard as "N wins" / "N draws". `formatDuration()` helper. |
| `app/services/arceus-record.ts` | Arceus damage leaderboard — top 5 per difficulty. JSON files (`arceus-record.json`, `-easy`, `-hard`). Auto-migrates from old single-record format. `checkAndUpdateArceusRecord()` returns `{ isNewRecord, rank, previousRecord }`. `resetArceusLeaderboard()` for admin reset. |
| `app/services/announcement.ts` | Server announcement broadcast hub. `broadcastAnnouncement(message)` pushes to SSE clients (lobby) and Colyseus presence topic `"server-announcement"` (game rooms). Fire-and-forget, no persistence. |
| `app/services/leaderboard-admin.ts` | **Admin Leaderboard Manager** orchestration. Verifies `Role.ADMIN` from the caller's `uid` (`UserMetadata.role`, same pattern as `elite-design.ts`), then delegates: `wipeLeaderboard(uid, board, difficulty?)`, `removeLeaderboardEntry(uid, board, {difficulty?,slot?,index?,odToken?})`, `listVictoryRecordsAsAdmin(uid, difficulty)`. `board` ∈ `champion`\|`arceus`\|`endless`\|`victory` (the four Spire roguelike boards). Champion removal cascades (see "Leaderboard Manager"). The data-mutation helpers themselves live in the per-board services (no admin check there — gating is centralized here + the API layer). |

### Client-Side
| File | Purpose |
|---|---|
| `game-map.tsx` | SVG map with synergy icons (triangle layout for wild), gem icons (gym), pokeball (mart), unown-qm (mystery), chansey (center). Non-crossing edges. Background image from PAC poster `assets/posters/hd/6.6.png` at 20% opacity. |
| `game-reward.tsx` | Shows "Continue to Map" button only when no choices remain (auto-transition handles most cases) |
| `game-choice.tsx` | The reward/starter picker. `INSTANT_REWARD_TYPES` (`gold`/`heal`/`xp`/`itemGrant`) are claimed directly (no sub-picker); the rewards-screen sub-picker (`game-rewards-screen.tsx` has its **own** copy of this list — keep both in sync) targets the single non-instant choice. Special rewards (gym/elite/unlock) render in the `isSpecialReward` branch: its non-Pokémon slot checks `choice.relics?.[index]` first and renders the relic (icon `/assets/relics/<id>.png` + name/desc from `RELICS`) — without this a Spire gym relic option drew a broken `assets/item/.png` (item slot is `""`). Spire wild rewards show one button per held reroll ticket. |
| `game-rest.tsx` | Pokemon Center: 3 choices using event-style UI (heal/ditto+item/dojo ticket). Uses `game-choice.css` styling. |
| `game-event.tsx` | Mystery encounter dialog with Pokemon portrait sprite and choice buttons |
| `tutorial-dialog.tsx` (+ `.css`) | **Tutorial** blocking dialog overlay. Listens for the `"tutorial-dialog"` window event (relayed from `Transfer.TUTORIAL_DIALOG` in `game.tsx`), queues the i18n step keys, and shows them one at a time (portrait + Next/Got it). `z-index:250` + `pointer-events:auto` so it blocks the game; the `complete` trigger's last step is a **Back to Menu** button → `leave()`. See "Tutorial Mode". |
| `game-bottom-bar.tsx` | Full-width bottom HUD bar mirroring the top bar (shares `game-stage-info.css`): regional pokemon icon + encounter-rate chips (left), `GameExperience` (center), speed cycle + Act/Floor map button (right). `left: 60px` at `<=960px` to clear the mobile sidebar toggle. See "In-Game HUD". |
| `game-relic-container.tsx` | Top-left HUD container for `player.relics` (run-wide relics). Fills horizontally then wraps. Each tile is bordered/glowed with its **rarity color** (`RELIC_RARITY_COLOR[rarity]`; CLASS = gold) — EXCEPT unimplemented relics, which get a **black outline** (override). Tooltip shows name + colored rarity label (`RELIC_RARITY_LABEL`) + description. Icons from `/assets/relics/<RELIC_ID>.png`; missing icons auto-hide (tile still shows). Renders nothing when the player has no relics. Reads the **Redux** player copy, so it only updates because `game-container.ts` dispatches `changePlayer` on `player.relics` add/change/remove (see below). |
| `wiki-relics.tsx` (+ `wiki-relics.css`) | Wiki **Relics** tab (registered in `wiki/wiki.tsx` between Pokémon and Abilities; shows in lobby + in-game). Grouped grid: one colored `<section>` per `RelicRarity` (**Class first** (gold), then Common→Epic) with a count, icons in a wrap grid. Unimplemented tiles render with a **black outline** (overrides the section's rarity color). Single render-based `react-tooltip` shows name + effect description. |
| `game-run-end.tsx` | Victory/defeat/Arceus end screen in a `DraggableWindow`. Shows stats grid + Arceus record info. Action buttons (Enter Elite Four, Challenge Arceus) rendered separately at bottom of screen. (No "Back to Lobby" button here by design — the sidebar leave button and browser back already cover that, and a button next to Elite Four/Arceus risked misclicks.) |
| `game-opponent-synergies.tsx` | Enemy synergies panel during PICK/FIGHT. Uses server-computed `encounterSynergies` for snapshot encounters (champion/E4 — includes Dragon double-types etc.), falls back to client-side computation for other encounters. |
| `game-opponent-items.tsx` | Shows opponent inventory items (gems, relics) during PICK/FIGHT. Reads from `encounterInventory` synced state. |
| `game-experience.tsx` | Modified to include "Start Fight" button (red bubbly) next to level-up button during PICK phase |
| `component/bot-builder/elite-designer.tsx` / `elite-designer-modal.tsx` / `elite-designer.css` | **Elite Designer** — a Team Planner clone for designing custom elite fights. Sidebar tab below Team Planner (`main-sidebar.tsx`, `"elite-designer"` modal). The modal has a **tab row**: **Designer** \| **Library** (view toggle) + an **Enter Test Mode** action button (`EnterTestModeTab`, exported from elite-designer.tsx — creates/joins the sandbox room, resolves the in-game name like spire-lobby, never the Google name). Reuses the planner's `TeamEditor`/`PokemonPicker`/`ItemPicker`/`SelectedEntity`/`Synergies` sub-components; no bench. Adds: Act (1-3) + stage-range selector (Act 1: 6-10/11-15/16-20; Acts 2-3 add 1-5), an **Icon Pokémon** dropdown (map avatar, from board mons), a **live budget tracker** (placed count / stars-used / max-stars vs a static mirror of `getDifficultyConfig` Normal mode in `RECOMMENDATIONS` — keep in sync if difficulty rebalances), collapsible **bonus-stat** fields (the 9 `SpireEncounter` bonus fields), and **reward pools** (win + loss). Each reward option = one Pokémon + optional item, where the item is a real `Item` OR a `RANDOM_*` token (`RANDOM_COMPONENT/CRAFTED/BERRY/TOOL/SYNERGY_STONE/SHINY` → `pickRandomIn(<category>)` server-side). Each pool has a "show N of pool" count (default 3 win / 2 loss). State persists to `LocalStoreKeys.ELITE_DESIGNER` (incl. an editor-only `libraryId` linking to a saved entry — never exported); modal merges stored state with `DEFAULT_ELITE_DESIGN` on load. **Export** = a compact-JSON string (copy button) matching the `SpireEncounter` shape — `{name, act, stages, icon?, board:[[pkm,x,y]], items?, bonus?, winRewards?:[[pkm,item?]], winRewardsShown?, lossRewards?, lossRewardsShown?}` — for Discord paste / re-import. **Save to Library** (`POST /api/elite-designs`) persists to the server library; once linked the button becomes **Update Library** (overwrite in place — changing an approved design's content clears its approval unless the editor is admin) + a **Create New** button (separate entry, needs a unique name). Save errors map server validation codes (`invalid_pokemon`/`bad_position`/`bad_items`/`bad_stats`/`bad_rewards`/`board_too_large`/`bad_stage`) to an "invalid data" status line. The **▶ Test** button (stage dropdown) runs a single watched AI-vs-AI fight vs a random saved endless team; requires being in Test Mode (entered via the tab button). **Guest gate:** the whole modal is sign-in only — for uid `"local-player"` it renders a "create an account" notice (`.elite-guest-gate`) instead of the tabs; the server backstops this (library writes reject guests, `game-room.ts onCreate` throws on guest `eliteTest` rooms). |
| `component/leaderboard-manager/leaderboard-manager.tsx` (+ `.css`) | **Leaderboard Manager** modal (admin-only sidebar tab, directly below Elite Designer). Board tabs (Champion/E4, Arceus, Endless, Victory) + a difficulty selector (Champion/Arceus/Victory are per-difficulty; Endless is global). Reuses the public GET endpoints for display (`/api/champion-data`, `/api/arceus-record`, `/api/endless-record`) and the admin GET `/api/admin/victory-records/:difficulty?uid=` (the only one returning `odToken`). Per-board **Wipe** + per-entry **Remove**, each behind an inline confirm overlay. Clears `data` on every board/difficulty switch so the previous board's shape can't render against the new board's component (the `data.champion is undefined` crash). |
| `component/bot-builder/elite-library.tsx` | **Library tab** of the Elite Designer modal. Lists every saved design grouped by act + stage range, showing icon, name + a short rate summary (e.g. "– 75%/25%" = earlier/later bracket win rate), `✓ Approved` badge, creator, and detailed per-stage rates. **Act + Stage filter dropdowns** (head of the list, both default **All**) narrow the displayed groups; options are derived from the designs actually present, and a "no matches" note shows when a combination is empty. Per-row buttons: **Load** (into the Designer, links `libraryId` for the creator **or an admin** so the save button becomes in-place "Update Library"; everyone else loading saves as a new entry), **Measure** (`POST /api/elite-designs/:id/measure` — room-less headless run via `elite-measure.ts`, **no Test Mode needed**; progress polled from `GET /api/elite-measure-status` every 1s while active, list refreshed as each design's results save; the old in-room `MEASURE_ELITE_DESIGN` message still exists server-side but the client no longer sends it), an admin-only **Measure All** button next to the filters (`POST /api/elite-designs/measure-all`, respects the current act/stage filters) with a progress line + **Cancel** (initiator or admin), **+/− bump** (`+` = up/later stage, `−` = down/earlier; move along the stage ladder, creator/admin — clears success rates, and a non-admin bump of an approved design clears its approval too), **Delete** (creator/admin), and admin-only **Approve/Unapprove** (gates Spire-run appearance). Fetches `/api/user-role` directly for admin status (Redux role is unset in the lobby). |

## Key Modified Files

### `app/rooms/game-room.ts`
- `onAuth()`: Verifies Firebase ID tokens via `admin.auth().verifyIdToken()`, creates UserMetadata document on first game (upsert), falls back to guest mode for players without `idToken`
- `onCreate()`: Player with defaults, accepts `resume` flag for save/load
- `startGame()`: Generates map, pushes starter choice (3 first-stage starters + paired items). Debug Mewtwos commented out.
- `pickChoice()`: When picking Ditto, skips paired item. **Auto-transitions to MAP when REWARD choices hit 0** — ⚠️ EVERY early-returning branch (instant `gold/heal/xp/itemGrant`, `unlockReward`, `wildReward/gymReward/eliteReward`, the relic-grant block, generic `addPick`) must set `updatePhaseNeeded = true; time = 0` when `player.choices.length === 0`, or the run **hard-locks in REWARD** (the next map node is unclickable — `SELECT_MAP_NODE` requires `phase === MAP`). A per-tick **safety net** in `OnUpdateCommand` also advances any REWARD where all non-bot players' choices are resolved (covers a forgotten branch or a fight that produced no rewards). This was the "can't progress past the first Spire fight" bug.
- `spawnOnBench()`: Creates Pokemon on bench. Calls `pokemon.onAcquired(player)` to trigger lifecycle hooks (e.g., Deoxys gets Meteorite, Rotom gets Rotom Catalog). Used by all reward pick paths (wild, elite, unlock, gym).
- `SELECT_MAP_NODE`, `SKIP_REWARD`, `REROLL_REWARD` message handlers
- `REROLL_MAP` handler (map reroll button, shown only during starter selection): regenerates the act map. MUST pass `this.state.isEndless` to `generateActMap()` and call `populateAsyncFightNodes()` when endless, or the rerolled map reverts to the normal layout with empty async-fight nodes.
- `resumeGame()`: Restores a saved run. Resumes to MAP for most phases, but re-initializes SHOP/REST/EVENT via their `initialize*Phase()` methods — those phases consume their map node on entry and rely on transient (shop miniGame carousel) or unsaved (rest/event choice) state, so dropping to MAP would strand the player on an already-visited node. Shop/event contents re-roll on resume (not persisted). REWARD is preserved as-is (choices are saved). **Finale forfeit:** if the restored run has `championChallenged` or `arceusChallenged` set, OR has entered the Arceus act (`!isEndless && currentAct >= 5`), the run is finalized as a forfeit (`recordRunEndOnce`, save deleted) instead of re-entering the fight — this stops save-scumming the Arceus damage leaderboard / retrying the champion fight. The `currentAct >= 5` clause matters because merely *entering* the Arceus act (`ENTER_ACT_5` → `initializeMapPhase` → `autoSaveRun`) persists a resumable save BEFORE `arceusChallenged` is set at fight start — so the act itself is the commit point (without it, leaving from the Act-5 map or the Arceus PICK screen left a resumable run you could re-enter). **Endless is excluded** — it increments `currentAct` unbounded (5/6/7…) with no Arceus, so those are normal resumable acts. Likewise `championChallenged` is now set at champion-node *selection* (`onSelectMapNode`), not just fight start, so leaving during the champion PICK also forfeits. The run keeps its Act-3 victory (recorded by `runId`). E4 member fights are not guarded, so the climb stays resumable.
- Event/rest choices handled via `choiceId === "event"` / `choiceId === "rest"`

### `app/rooms/commands/game-commands.ts`
- `OnUpdatePhaseCommand.execute()`: Full state machine (MAP/PICK/FIGHT/REWARD/SHOP/REST/EVENT)
- `onSelectMapNode()`: Sets player.map to region for tilemap, sets spireEncounterBoard, generates gym encounters dynamically via `generateGymEncounter()`. Clears `encounterSnapshot`/`encounterCrownedAt` up front (the E4/Champion/Async branches re-set them) so PVE nodes never inherit the previous opponent's snapshot — see the Opponent Reconstruction gotchas.
- `initializeShopPhase()`: Calls `miniGame.initialize(state, room, true)` (skipEncounters=true) then `initializeShopCarousel()`
- `initializeRestPhase()`: Sets up 3 choices (item component/ditto/dojo ticket by act) via spireEvent state fields
- `initializeRewardPhase()`: Gold + relic effect hooks (`getRelicBonusGold` / `getRelicPostBattleHeal` — **currently no-op stubs returning 0**; the heal/gold rows only appear once a relic grants them). Wild: 4 choices on win (2-3 Pokemon + items, 33% Ditto), 3 on loss (1-2 Pokemon + items). Elite: themed rewards on win, wild-loss on loss. Gym: synergy gem + choose crafted item/Pokemon+component/tool. Boss: 3 shiny items only (no Pokemon). Act transition on boss win.
- `initializeFightingPhase()`: For PVE encounters, calls `cookDishesForPveBoard()` after computing synergies — auto-distributes Chef Hats and cooks dishes for PVE boards with Gourmet synergy (1 hat at count ≥3, 2 hats at count ≥5).
- `cookDishesForPveBoard()`: Standalone function. Checks Gourmet synergy count on PVE board, distributes Chef Hats to strongest Gourmet Pokemon, synchronously cooks dishes using same adjacency/priority logic as `chefCookEffect` in `items.ts`.
- `stopSpireFightingPhase()`: HP damage with relic reduction hook (`getRelicDamageReduction` — currently a no-op stub returning 0). Cleans up simulations. On death: deletes saved run, saves run history, increments stats.
- `endArceusFight()`: Ends Arceus boss fight, records damage dealt, checks/updates Arceus leaderboard, triggers Discord announcement if new #1. Sets `isNewArceusRecord`/`previousArceusRecord`/`previousArceusHolder` synced state. Sets player map to "In the Nightmare" for Arceus fight tilemap.
- `endChampionFight()`: Ends champion fight. Clears `championChallenged` (so the post-win Arceus phase isn't force-forfeited on resume). On win calls `promoteNewChampion()` (the swap; tracks reign), triggers Discord announcements for new champion and optionally longest reign; on loss the team keeps its climbed E4 #4 slot (no insertion). Deletes the save. Run history + stats are recorded at the terminal path (Arceus end or `onDispose`), not here.
- `checkRunDeath()`: Triggers when runHP <= 0 outside fight phase. Deletes save, saves history, increments stats.
- `getDojoTicket()`: Returns difficulty-adjusted dojo ticket tier.
- `placePlayerInEliteFour(e4Index)`: Swap-up cascade persisting the player into E4 slot `e4Index` on a win (see "Elite Four Climb → Swap-Up Cascade"). Tags the snapshot with `state.runId`; saves champion-data immediately.
- `initializeFightingPhase()`: Starts the fight. For a Champion / Arceus node it sets `championChallenged` / `arceusChallenged` and force-saves (the one-shot finale guard). Reconstructs snapshot opponents via `reconstructTeamAsPlayer` (which also reapplies the snapshot's `money`).
- `initializeMapPhase()`: Owns the encounter-state clear-list — `spireEncounterBoard`, `encounterInventory`, `encounterMoney`, `encounterName`, `encounterAvatar`, `encounterSynergies`, `encounterGroundHoles`, `encounterSnapshot`, `encounterCrownedAt`, bonus stats, plus minigame avatars/floating items/portals/symbols. Resets player.map to "town". Any act transition (`ENTER_ELITE_FOUR`, `ENTER_ACT_5` in `game-room.ts`) MUST route through this rather than hand-setting `phase = MAP`, or the defeated opponent's inventory/board stays synced to the client (caused champion items to linger into the Arceus act).
- `initializePickingPhase()`: Clears avatars/floatingItems. Infinite timer.
- `OnUpdateCommand`: MiniGame physics update runs during SHOP phase
- AdditionalPicksStages logic removed (no more forced add-pick rounds)

### `app/rooms/states/game-state.ts`
Synced fields: `currentAct`, `currentFloor`, `mapNodes`, `mapEdges`, `currentNodeId`, `runHP`, `runComplete`, `runFailed`, `championChallenged`, `arceusChallenged` (one-shot finale-fight guards — see Run End Paths), `isSpire`, `spireClass`, `spireEncounterBoard`, `encounterDifficulty`, `encounterBonusHP`, `encounterBonusAtk`, `encounterBonusDef`, `encounterBonusSpeDef`, `encounterBonusAP`, `encounterBonusPP`, `encounterMoney` (snapshot opponent's gold, shown in the fight UI), `encounterName` + `encounterAvatar` (opponent identity for the top-bar "vs" block — set at node select in `onSelectMapNode`, so they're available before/during/after the fight; `encounterAvatar` is the snapshot avatar for snapshot fights else `getAvatarString(PkmIndex[lead], false)`), `encounterSynergies`, `gameSpeed` (float32), `arceusDamageDealt`, `isNewArceusRecord`, `previousArceusRecord`, `previousArceusHolder`, `spireEventName`, `spireEventDescription`, `spireEventPortrait`, `spireEventChoiceLabels`, `spireEventChoiceDescs`

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
- `player.items` onAdd/onRemove listeners for item inventory updates (these only re-render the **Phaser** board inventory — they do NOT dispatch to Redux)
- `player.relics` onAdd/onChange/onRemove listeners → `store.dispatch(changePlayer({ field: "relics", value: Array.from(player.relics) }))`. Required because the relic HUD reads the **Redux** player copy; without this dispatch the React HUD never re-renders on a relic grant (this was the bug that made granted relics invisible). Mirrors the `board` field's pattern. NOTE: the `items` listeners in THIS file still only re-render the Phaser inventory — `player.items` is mirrored to Redux separately by an `items` onAdd/onChange/onRemove → `changePlayer({ field: "items" })` dispatch in **`game.tsx`** (added so the Spire reward-reroll ticket buttons see current inventory). React UI that reads `connectedPlayer.items`/`.relics`/`.choices` depends on these explicit dispatches.
- `player.listen("map")` for tilemap loading on region change (preloads + setMap)

### `app/public/src/game/scenes/game-scene.ts`
- Movement input allowed during SHOP phase (not just TOWN)
- MinigameManager update runs during SHOP phase
- TOWN phase handler disabled

### `app/public/src/game/components/board-manager.ts`
- `BoardMode.MAP`, `BoardMode.REWARD` added
- Enemy preview from `spireEncounterBoard` only (PVEStages fallback removed). `renderBoard()` draws the opponent's half only in **PICK mode** (REWARD funnels through `pickMode()`, which forces `mode = PICK`). The opponent's static team is therefore visible **before** (PICK) and **after** (REWARD) the fight, with the live battle entities shown **during** FIGHT. Two pieces make before/after work: (1) `initializeRewardPhase()` does **not** clear `spireEncounterBoard` (only `initializeMapPhase` does, on the way back to MAP); (2) `game.tsx` has a coalesced, deferred `spireEncounterBoard` onAdd/onChange/onRemove listener that re-renders the board (gated to PICK mode) once the array syncs — the board + PICK phase are set in the same server tick, so the synchronous `renderBoard()` in the phase listener can otherwise run before the array is decoded (the same race the elite-test staging works around).
- SHOP phase uses `minigameMode()`, TOWN removed from constructor

### `app/public/src/game/components/floating-item-container.ts`
- Price label (gold text) above items
- Pokemon portrait for Pokemon shop items (via PkmIndex lookup)
- Pokemon name text below

## Reused Systems (Unchanged from PAC)

- **Battle simulation**: `app/core/simulation.ts` (modified: `start()` now processes dishes for PVE opponents via `refToBoardPokemon`, guards `player` access for PVE in `applyDishEffects`)
- **Pokemon entities**: `app/core/pokemon-entity.ts`
- **Abilities**: `app/core/abilities/` (200+)
- **Effects**: `app/core/effects/` (item, passive, synergy). `chefCookEffect` in `items.ts` records dishes to `pokemon._cookedDishes` for snapshot preservation. Spire change: dishes are distributed **synchronously** at stage start (the `COOK` broadcast still fires for the cook animation, but the upstream 1000ms+2000ms `room.clock.setTimeout` delays were removed) so a player can't start the fight before the Chef Hat dishes land.
- **Dishes**: `app/core/dishes.ts` — `DishByPkm` maps Pokemon to their dish type. RICE effect guards `player` access for PVE safety.
- **Synergies**: 32 types with tiered bonuses
- **Items**: 333+ items with crafting recipes
- **Evolution**: `app/core/evolution-logic/` (6.10 data+handler architecture — `evolution-rules.ts` was removed upstream). Rules are plain data (`app/types/EvolutionRules.ts`, `EvolutionRuleType` enum); behavior in `*-handler.ts` classes dispatched by `EvolutionManager` (`EvolutionManager.getEvolution/updateHatch/tryEvolve`). See `MIGRATION-6.9-to-6.10.md` for where Spire's evolution divergences were re-homed.
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
| `usermetadatas` | `app/models/mongo-models/user-metadata.ts` | User profiles keyed by Firebase uid. `displayName` (lobby-chosen name, source of truth — never the Google name) and `avatar` (sprite string) are persisted from the lobby and searchable via the collation index on `displayName`. Includes `spireStats` with per-difficulty counters (runsStarted, wins, champion, arceusDamage) and `spireRegion` (Home Town choice, default "town"). Created via upsert on first game. |
| `victoryrecords` | `app/models/mongo-models/victory-record.ts` | Win totals + streaks per `{ odToken, difficulty }`. `name`/`avatar` are denormalized fallbacks; `getVictoryLeaderboard()` overlays live `UserMetadata` values at read time. |
| `runhistories` | `app/models/mongo-models/run-history.ts` | Completed run results with team, items, synergy snapshot, act/floor, damage, victory flag. Queried for profile run history display. |
| `savedruns` | `app/models/mongo-models/saved-run.ts` | Active save slots for run resume. One per player (upsert). Deleted on run end. |

### Adding New Persistent Data

To store new data in MongoDB:
1. Create a Mongoose schema in `app/models/mongo-models/`
2. Import and use it in server-side code (rooms, commands)
3. No client-side changes needed — the client talks to the server via Colyseus messages, not directly to MongoDB

### IMPORTANT: Never Use Firebase/Google Real Names

Firebase `user.displayName` contains the player's real name from their Google account. **Under no circumstances may this value be displayed in-game, persisted, or sent anywhere** — not in the database, not in the UI, not in player labels/battle screens, not in leaderboards, not in Discord messages. Always use the game name chosen by the player in the lobby (`options.displayName`). The `onAuth()` method in `game-room.ts` writes `options.displayName` to `UserMetadata.displayName` via `$set` on every game start. The login page and account tab only reveal the player's email, never their real name. `network.ts` `authenticateUser()` hardcodes the client-side profile `displayName` to `"Player"` — it never reads `user.displayName` from Firebase.

**⚠️ The redux field `state.network.displayName` IS the Google account name.** It is set straight from the Firebase auth payload in the `logIn` reducer (`NetworkStore.ts`). Do **not** read it to label a player — it is auth metadata only. To get the player's in-game name on the client, resolve it the way `spire-lobby.tsx` does: DB-backed `LocalStoreKeys.SPIRE_PLAYER_NAME` (treating the `"Username"`/`"Player"` sentinels as unset) → `state.network.profile?.displayName` → a generic fallback. **Regression history:** the Elite Designer "Test vs Endless Team" sandbox (`elite-designer.tsx`) once passed `state.network.displayName` into `createEliteTestRoom`, which surfaced the real name ("James vs …") on the battle screen — fixed by switching to the lobby's resolution. Audit any new `state.network.displayName` read for the same leak.

**Player identity persistence (name / avatar / Home Town).** All three live on `UserMetadata` and the DB is the source of truth — the lobby (`spire-lobby.tsx`) loads them on mount; localStorage is just a cache:
- **Name** → `displayName`, via `PUT /api/player-name` (debounced on lobby edit) + `onAuth` `$set` on run start. On load the DB wins for real names, but the sentinels `"Player"`/`"Username"` are treated as *unset* (local value kept and re-saved). Gated by a `nameLoaded` flag so the local value can't clobber the DB before the load lands.
- **Avatar** → `avatar` (sprite-string form), via `PUT /api/player-avatar`; reverse-mapped to a `Pkm` on load via `avatarStringToPkm()`. Gated by `avatarLoaded`. Pure DB-authoritative (no sentinel).
- **Home Town** → `spireRegion` (see "Home Town" section). Pure DB-authoritative, gated by `regionLoaded`.

**Victory leaderboard names.** `VictoryRecord` is per-`{ odToken, difficulty }` with a denormalized `name`/`avatar`; only the played difficulty's row is updated on a run. `getVictoryLeaderboard()` overlays the current `displayName`/`avatar` from `UserMetadata` (by `odToken`) at read time, so a player's latest name shows across **all** difficulty leaderboards without replaying each one (the stored copy is only a fallback).

**Wiping names.** There is no automatic wipe (the old boot-time `wipeRealNamesAndSeed()` was removed from `index.ts`). The only reset is the manual Discord admin command `/wipeplayernames` → `wipeAllPlayerNames()` in `victory-record.ts`, which in-place sets `displayName` and `VictoryRecord.name` to `"Player"`. Because the DB is authoritative only for real names, an active player's local name re-seeds the DB on their next visit (a soft wipe by design).

### Guest vs Signed-In Behavior

| Feature | Guest | Signed In |
|---|---|---|
| Play runs | Yes | Yes |
| uid | `"local-player"` | Firebase uid |
| Save/resume runs | No | Yes |
| Run history | No | Yes (saved to MongoDB on run end) |
| Player stats | No | Yes (per-difficulty counters) |
| Account tab | Shows "Sign In" button | Shows name, email, sign out |
| Elite Designer | No (modal shows a sign-in gate; server rejects guest library writes + `eliteTest` rooms) | Yes |
| Admin cheats | No | Yes, if `role: "ADMIN"` in UserMetadata |

### Admin Role System

- Player roles are stored in `usermetadatas.role` (MongoDB). Default is `BASIC`.
- To grant admin: set `role: "ADMIN"` on the user's document in MongoDB Atlas (or via mongoose script).
- **Server**: `game-room.ts` `onCreate()` fetches role from DB when creating the Player object. Message handlers (`SKIP_TO_ACT`, `GIVE_MEWTWO`, `GIVE_POKEMON`, `GIVE_ITEM`, `GIVE_RELIC`, `RESET_CHAMPION`, `ADMIN_TELEPORT_NODE`) check `player.role !== Role.ADMIN`.
- **Client**: `game.tsx` fetches `/api/user-role/:uid` on mount, dispatches `setRole()` to Redux. Admin buttons render when `profile.role === Role.ADMIN`.
- **Lobby gotcha**: Redux `profile.role` is only populated *in a game* (by `game.tsx`); in the main lobby it's unset. So lobby-side admin UI must look the role up directly — `spire-lobby.tsx` and `elite-library.tsx` fetch `/api/user-role/:uid` into a local flag, and `main-sidebar.tsx` does the same (`isAdmin` state) to gate the **Leaderboard Manager** sidebar tab (falling back to the Redux role in-game). Gating only on `profile.role` would hide the item in the lobby — which is exactly where it lives.
- Admin cheat buttons (right side panel in game): Test Victory, Skip to Act 1/2/3, Give 999 Gold, Give Mewtwo (buffed, repeatable), Give Ditto, Give Pokemon (searchable combobox over every `Pkm` entry — spawns at normal stats via `GIVE_POKEMON`), Give Item (searchable combobox over every `Item` entry — pushed to `player.items` via `GIVE_ITEM`; an `ITEM_SEARCH_ALIASES` map adds friendly synonyms, e.g. typing "compost" surfaces `RICH_MULCH`/`AMAZE_MULCH`), Give Relic (searchable combobox over every `Relic` — pushed to `player.relics` via `GIVE_RELIC`, deduped/unique), Heal, Skip to Elite 4, Skip to Act 5, Reset E4/Champion.
- Admin map teleport: Admins can click any unvisited node on the map to jump directly to it, bypassing path connectivity. Client sends `ADMIN_TELEPORT_NODE`, server marks the node available then delegates to `onSelectMapNode()`.
- `MONITOR_PASSWORD` env var enables the Colyseus monitor dashboard at `/colyseus` (basic auth: admin / password).

## Leaderboard Manager (Admin)

An admin-only lobby tool (sidebar tab below Elite Designer) to curate the four **Spire roguelike leaderboards** — Champion/Elite Four, Arceus damage, Endless records, Victory records. (It does NOT touch the global PAC ELO/Level/Bot/Event boards.) Distinct from the Discord `/reset-*` commands, which only do bulk wipes.

- **UI**: `app/public/src/pages/component/leaderboard-manager/leaderboard-manager.tsx` (modal via `main-sidebar.tsx`). Board tabs + difficulty selector (Champion/Arceus/Victory are per-difficulty; Endless is a single global file). Displays entries via the existing public GET endpoints, except Victory which uses the admin GET (`/api/admin/victory-records/:difficulty?uid=`) because only it returns `odToken` (the removal key).
- **Server**: `app/services/leaderboard-admin.ts` verifies `Role.ADMIN` from the caller's `uid` then delegates to per-board helpers. API: `POST /api/admin/leaderboard/wipe`, `POST /api/admin/leaderboard/remove`, `GET /api/admin/victory-records/:difficulty`. Every route re-checks admin server-side, so the tab being hidden is not the only gate.
- **Wipe** (per difficulty) reuses the existing reset functions (`resetChampionData` / `resetArceusLeaderboard` / `resetEndlessLeaderboard` / new `resetVictoryRecords`).
- **Remove one entry**: arceus/endless by `index`; victory by `odToken`+difficulty; champion by `slot`.
- **Elite Four cascade** (`removeChampionLadderEntry` in `champion-data.ts`): removing E4 slot `k` (0 = #1 weakest … 3 = #4 strongest) slides every **weaker** team (indices `< k`) UP one rung to fill the gap and seeds a fresh Magikarp `DEFAULT_SNAPSHOT` at E4 #1; `crownedAt`/`victories`/`ties` move in lockstep. Removing the **Champion** promotes E4 #4 into the Champion slot (carrying its defense record), then cascades the E4 up the same way (Magikarp at #1). Mirrors the win-cascade in `promoteNewChampion`/`placePlayerInEliteFour` so the ladder never holes or duplicates.
- **Client race gotcha**: switching board flips `board` a render before the new fetch lands, so the component must not render the previous board's data shape. `fetchData` clears `data` to `null` up front and the Champion branch is gated on `data?.champion` (not bare truthiness) — otherwise a stale array from the prior board crashes `ChampionBoard` with `data.champion is undefined`.

## Discord Integration

### Overview

The Discord bot handles three categories of announcements plus admin commands.

### How It Works

- **Bot client**: A Discord bot (`Client` with `Guilds`, `GuildMessages`, `MessageContent` intents) is initialized at server startup from `DISCORD_BOT_TOKEN`. Requires at least one channel ID configured. Bot also requires **Message Content Intent** enabled in Discord Developer Portal.
- **Champion announcements** (champion channel): New champion with team image, defeated champion's reign duration, E4 lineup. Triggered by `endChampionFight()`.
- **Longest reign announcements** (champion channel): When a dethroned champion held the title longer than any previous champion on that difficulty.
- **Arceus record announcements** (Arceus channel): New #1 damage record with team image, previous record holder. Triggered by `endArceusFight()`.
- **Admin commands** (admin channel, requires Discord Administrator permission). Destructive resets use a two-step `/confirm-reset` flow (30s window); toggles/announcements apply immediately:
  - `/reset-leaderboards` — Resets all Champion/E4 and Arceus leaderboards for all difficulties. (needs `/confirm-reset`)
  - `/reset-arceus [difficulty]` — Resets Arceus damage leaderboard. Optional difficulty: easy/normal/hard/impossible. Omit for all. (needs `/confirm-reset`)
  - `/reset-champions [difficulty]` — Resets Champion/E4 data. Optional difficulty: easy/normal/hard/impossible. Omit for all. (needs `/confirm-reset`)
  - `/wipeplayernames` — Resets every account/victory-record player name to "Player". (needs `/confirm-reset`)
  - `/endless enable | disable` — Toggles whether players can start Endless mode. Applies immediately. Persisted to `endless-config.json` (survives restarts); admins bypass the lock for testing, and resuming an in-progress endless run is always allowed.
  - `/announce <message>` — Broadcasts a server announcement popup to all connected clients (lobby + in-game). Players must click OK to dismiss. Fire-and-forget (no persistence across refresh, latest replaces previous). Applies immediately, no confirmation step.
- **Environment tag**: Bot messages are prefixed with `[development]`, `[staging]`, etc. based on `SERVER_ENV`. Production messages have no prefix.
- **Generated image**: A composite PNG created server-side with jimp — player name header, Pokemon portraits with item icons, active synergy icons with counts.

### Server Announcement System

```
Discord: /announce <message>
  → discord.ts handler → broadcastAnnouncement()
    ├── SSE (lobby): iterates connected EventSource clients, writes event
    │   → spire-lobby.tsx EventSource listener → setAnnouncement() → popup
    └── Colyseus presence (game): publishes to "server-announcement" topic
        → game-room.ts subscriber → room.broadcast(Transfer.SERVER_ANNOUNCEMENT)
        → game.tsx message listener → setAnnouncement() → popup
```

- SSE endpoint: `GET /api/announcements/stream` in `app.config.ts`
- Lobby connects via `new EventSource("/api/announcements/stream")` on mount, auto-reconnects on drop
- Game rooms subscribe to `"server-announcement"` presence topic in `onCreate()`
- Both popups use PAC UI style (`my-container` class, `bubbly` OK button, gold `#f1c40f` header)

### Key Files

| File | Role |
|---|---|
| `app/services/discord.ts` | Bot client + webhook clients. `announceNewChampion()` (with reign duration), `announceArceusRecord()`, `announceNewLongestReign()`. Admin commands: `/reset-leaderboards`, `/reset-arceus [difficulty]`, `/reset-champions [difficulty]`, `/wipeplayernames`, `/endless enable\|disable`, `/announce`. `generateTeamImage()` composites sprites. |
| `app/services/announcement.ts` | Server announcement broadcast hub. `broadcastAnnouncement()` pushes to SSE clients (lobby) + Colyseus presence (game rooms). Fire-and-forget, in-memory only. |
| `app/rooms/commands/game-commands.ts` | `endChampionFight()` calls `promoteNewChampion()` then Discord announcements with reign data. `endArceusFight()` calls `checkAndUpdateArceusRecord()` then Discord announcement if new #1. |
| `app/public/src/assets/types-png/` | Pre-converted PNG versions of synergy type icons. Used by the image generator. |

### Environment Variables

| Variable | Purpose |
|---|---|
| `DISCORD_BOT_TOKEN` | Bot token from Discord Developer Portal → Bot → Reset Token |
| `DISCORD_CHAMPION_CHANNEL_ID` | Channel for champion + longest reign announcements |
| `DISCORD_ARCEUS_CHANNEL_ID` | Channel for Arceus damage records (default: `1509158620430860349`) |
| `DISCORD_ADMIN_CHANNEL_ID` | Channel for admin commands like `/reset-leaderboards` (default: `1509190218690068510`) |

### Existing Webhook Features (from upstream PAC)

The same `discord.ts` file also has webhook-based announcements for bans and bot approvals using `DISCORD_WEBHOOK_URL` and `DISCORD_BAN_WEBHOOK_URL`. These are separate from the bot integration.

## Known Issues / Incomplete Features

1. **Relics — 179 catalogued, 17 implemented**: The relic system (`app/core/relics.ts`, auto-generated) has **179 relics** across the `RelicRarity` tiers (Common/Uncommon/Rare/Epic + a **CLASS** tier for the 6 class starters), the top-left HUD container, the Relics wiki tab, and the admin `GIVE_RELIC` cheat. **17 relics are implemented** (6 CLASS starters + 5 Silent reward relics + 6 general reward relics — see "Implemented Relics"): the 6 starters are granted at Spire run start, and **Spire gym wins** offer a random relic (`PlayerChoice.relics[]`, implemented-first + class-filtered). The **other 162 are `implemented: false` / `description: "no effect"`** (black-outlined in HUD + wiki); their economy helpers are no-op stubs. Remaining gaps: relics are granted on the live `player.relics` but **`player.relics` itself may not survive save/resume** (the run snapshot doesn't explicitly re-hydrate it — verify before relying on it), and outside Spire there's still no in-game source besides the admin cheat. Implementing more relics = add a `(description, True)` entry to `EFFECT_OVERRIDES` in `edit/generate-relics.py`, regenerate, and wire the effect (combat → `relic-battle-effects.ts`; economy → `relics.ts` helpers). The old "passive items" system (`relic-effects.ts` / `PASSIVE_ITEMS`) was removed and replaced by this.
2. **Balance**: Gold, encounter difficulty, HP damage need playtesting.
3. **Act transition UI**: No "Act Complete" overlay — map regenerates silently.
4. **Meta-progression**: No unlocks between runs.
5. **Ascension system**: Ranks defined in lobby UI but all say "Coming soon". No gameplay modifiers implemented yet.
6. **Version number**: RESOLVED — single source of truth in `package.json` `"version"` field. All UI and server startup read from it. Patch popup and hotfix badge derived automatically in `spire-lobby.tsx`.
7. **`player.life` vs `state.runHP`**: Any upstream PAC ability/item/effect that modifies `player.life` directly will be broken in Spire — it must use `player.addRunHP()` / `player.getRunHP()` instead. See "Player Health" section above. When porting new PAC abilities, grep for `player.life` and convert.
8. **Elite Designer → server loader (RESOLVED — now ALL modes)**: Designs saved to the library (`elitedesigns` Mongo collection, `app/services/elite-design.ts`, Library tab in the designer modal) and flagged `approved` (admin toggle) ARE the elite pool for **acts 1-3 in every mode** (Classic / Endless / Spire; since 2026-07 — previously Spire-only). `populateEliteDesignNodes()` (`game-room.ts`, mirrors `populateAsyncFightNodes`) assigns an approved design to each ELITE node after every map generation (start / REROLL_MAP / act transitions / `advanceEndlessAct` / resume) — Spire's 16-floor acts map onto the library's 20-floor brackets as quarters (`spireFloorToStageRange`: 1-4→"1-5", 5-8→"6-10", 9-12→"11-15", 13-16→"16-20"); classic/endless 20-floor acts map directly (`classicFloorToStageRange`; act-1 floors ≤5 → NO elite — the node converts to wild, matching the library's missing act-1 "1-5" bracket); a bracket with no approved designs converts the node into a normal wild encounter. In Classic, the design encounter additionally passes through `adjustEncounterItems` + `addHardModeItems` (now exported) at node select, so easy/hard/impossible item scaling still differentiates difficulties (designs are budgeted against Normal); Spire/Endless are mode 1 so those are no-ops. **Endless acts 4+ keep the hardcoded pool** (`populateEliteDesignNodes` self-gates) — fixed design boards can't track the uncapped scaling. `designToSpireEliteData()` parses designJson into a `SpireEncounter` (icon Pokémon moved to board[0] for mainBonus*/dojo-main semantics) + reward pools; design win/loss reward pools (each option = Pokémon + optional item, `RANDOM_*` tokens resolved via `resolveDesignRewardItem`) drive `generateEliteRewardChoice`/`generateEliteLossChoice`, falling back to standard elite rewards when a pool is empty. Picking a Spire design reward grants the Pokémon AND the paired item (`pickChoice` in game-room.ts — classic elite/gym picks still grant only the Pokémon; classic/endless elite rewards use the classic flow — main + 2 fight mons + components — sourced from the design's board, since `generateDesignRewardChoice` gates on `isSpire`). The hardcoded `ELITE_ENCOUNTERS_BY_ACT` now serves only Endless acts 4+ and the mid-population/Fisho2 fallbacks. The library also measures design **success rates** headlessly vs the endless async pools (`measureEliteDesign` in `elite-test.ts`) — since 2026-07 measured **room-less** straight from the lobby Library tab via `elite-measure.ts` (no test sandbox / game-client load; admin "Measure All" batches the whole library with a shared pool cache). **Approval-gate integrity (2026-07):** saves are content-validated server-side (`validateEliteDesignContent`), a non-admin edit/bump of an approved design clears `approved` (re-review required), guests are blocked from the designer entirely, and stale measure results are discarded if the design changed mid-measure — see the `elite-design.ts` row above.

## API Endpoints (`app/app.config.ts`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/saved-run/:uid` | GET | Fetch saved run summary for resume display |
| `/api/saved-run/:uid` | DELETE | Delete saved run (abandon). Records run history + victory record first — `won` is computed via `isRunVictory(savedRun.data)` (previously passed `currentAct`, a truthy number, so **every** abandoned run wrongly counted as a victory). |
| `/api/run-history/:uid` | GET | Paginated run history (`?page=N`) |
| `/api/champion-data/:difficulty` | GET | Elite Four & Champion data (0/1/2) for lobby display. Includes `championSince` and `longestReign`. |
| `/api/arceus-record/:difficulty` | GET | Arceus damage leaderboard (top 5) for lobby display |
| `/api/endless-record` | GET | Endless mode leaderboard (top 5 by act/floor) |
| `/api/endless-enabled` | GET | Returns `{ enabled: boolean }` — whether players can currently start Endless mode (admin toggle). Fails open to `true`. |
| `/api/spire-region/:uid` | GET | Player's Home Town region choice (returns `{ region: string }`) |
| `/api/spire-region/:uid` | PUT | Save Home Town region (`{ region: string }` body) |
| `/api/tutorial-completed/:uid` | GET | Returns `{ completed: boolean }` from `UserMetadata.tutorialCompleted` (set when the tutorial boss is beaten). |
| `/api/player-name/:uid` | GET | Player's saved name (`{ name: string \| null }`), source of truth for the lobby input |
| `/api/player-name/:uid` | PUT | Save player name (`{ name }`); validated via `USERNAME_REGEXP`, rejects "Player"/"Username" |
| `/api/player-avatar/:uid` | GET | Player's saved avatar sprite string (`{ avatar: string \| null }`) |
| `/api/player-avatar/:uid` | PUT | Save avatar (`{ avatar }`, sprite-string form e.g. `"0019/Normal"`) to `UserMetadata.avatar` |
| `/api/player-search` | GET | Case-insensitive prefix search by name (`?q=`); uses the collation index on `displayName` |
| `/api/victory-leaderboard/:difficulty` | GET | Top-10 victory totals & longest streaks; name/avatar overlaid from `UserMetadata` at read time |
| `/api/admin/victory-records/:difficulty` | GET | **Admin** (`?uid=`): victory records WITH `odToken` (for the Leaderboard Manager's remove UI; the public board omits it). 403 if not `Role.ADMIN`. |
| `/api/admin/leaderboard/wipe` | POST | **Admin** `{ uid, board, difficulty? }` — wipe a Spire board (`champion`\|`arceus`\|`endless`\|`victory`) for one difficulty (Endless ignores difficulty). |
| `/api/admin/leaderboard/remove` | POST | **Admin** `{ uid, board, difficulty?, slot?, index?, odToken? }` — remove one entry. champion→`slot` (`"champion"`\|0-3, cascades); arceus/endless→`index`; victory→`odToken`. |
| `/api/spire-stats/:uid` | GET | Per-difficulty player stats (runs, wins, champion, arceus damage) |
| `/api/user-role/:uid` | GET | Returns `{ role }` from UserMetadata (used by client to show admin UI) |
| `/api/async-stages` | GET | Endless async-fight stages that have ≥1 saved team, with counts (Elite Designer test stage picker) |
| `/api/elite-designs` | GET | All saved Elite Design library entries (with success-rate `results`) |
| `/api/elite-designs` | POST | Save a design (`{ uid, design, id? }`; `id` updates in place — creator or admin — else creates — name-collision/full = 400). Guests rejected (`guest`). Runs full content validation (`validateEliteDesignContent` — bad Pokémon/items/coords/stats/rewards/stage = 400 with a specific code). A non-admin content change to an approved design clears `approved`. |
| `/api/elite-designs/:id/approve` | PUT | Admin: `{ uid, approved }` — gate whether the design appears as a Spire elite |
| `/api/elite-designs/:id/bump` | PUT | `{ uid, direction: "up"\|"down" }` — move the design along the act+stage ladder (clears results; a non-admin bump of an approved design also clears `approved`; guests rejected) |
| `/api/elite-designs/:id` | DELETE | Delete a design (`?uid=`; creator or admin; guests rejected) |
| `/api/elite-designs/:id/measure` | POST | `{ uid }` — start a room-less measurement of one design (any signed-in user; 400 `busy` if one is already running). Responds `{started}` immediately; poll status for progress. |
| `/api/elite-designs/measure-all` | POST | **Admin** `{ uid, act?, stageRange? }` — measure every (filtered) library design in one background batch with a shared pool cache. Responds `{started, count}`. |
| `/api/elite-measure/cancel` | POST | `{ uid }` — cancel the running measurement (initiator or admin). Current design's partial fights discarded; already-completed designs keep their saved results. |
| `/api/elite-measure-status` | GET | Measurement progress for the Library tab's 1s poll: `{running, mode, designId, designName, done, total, batchIndex, batchCount, startedBy, completedCount, finished}`. |
| `/api/public-runs` | GET | Live game rooms for the lobby's Live Runs / spectate list (owner, difficulty, act/floor, HP, spectators). Filters out Elite Designer test sandboxes (`isEliteTest` room metadata). |
| `/api/announcements/stream` | GET | SSE endpoint for server announcements. Lobby connects via `EventSource` on mount. Broadcasts fire-and-forget messages from Discord `/announce` command. |
| `/colyseus` | GET | Colyseus monitor dashboard (basic auth: admin / `MONITOR_PASSWORD` env var) |
| `/status` | GET | Server status: CCU (active game room clients), total accounts, version |
| `/titles` | GET | Returns `[]` (stub to prevent PAC client 404) |

## Difficulty Balancing

### Dojo Tickets by Difficulty
| Act | Easy | Normal | Hard | Impossible |
|---|---|---|---|---|
| 1 | Silver | Bronze | Bronze | Bronze |
| 2 | Silver | Silver | Silver | Silver |
| 3 | Gold | Gold | Silver | Silver |

### Act 3 Item Class System (`spire-encounters.ts`)
In Act 3, encounter Pokemon no longer receive random items/components. Instead, each Pokemon is assigned a class (Frontline, Physical, Special, Support) weighted by its base stats (ATK, DEF, SpeDEF, range), and receives 0-3 items (0-2 on easy) drawn from that class's item pool. This applies to all Act 3 encounters including elites, but NOT legendary bosses (which keep their fixed thematic items) or champion/E4 fights. `addHardModeItems` and `adjustEncounterItems` skip Act 3 entirely.

### Hard/Impossible Mode Extra Items (`addHardModeItems` in `spire-encounters.ts`)
Extra random item components added to each encounter Pokemon slot (Acts 1-2 only; Act 3 uses the class system above):
- Act 1: 0.5x team size (hard), 0.75x team size (impossible, starts from floor 4 instead of floor 9)
- Act 2: 1.25x team size (hard; impossible uses class items instead)

### Impossible Mode Encounter Scaling (`getDifficultyConfig`)
- All acts: +1 star budget (via `getStarBudgetOffset`)
- Act 3: +2 Pokemon count, +5 star budget (on top of the +1 above)

### Boss Boost (`applyBossBoost`)
- **Hard Act 3**: +1 random legendary (from Celebi/Jirachi/Victini/Manaphy/Shaymin/Phione) with Soul Dew, +200 HP, +5 ATK.
- **Impossible Act 2**: +150 HP, +3 ATK (stat boost only, no extra Pokemon).
- **Impossible Act 3**: +Mega Rayquaza +Roaring Moon (each with Soul Dew), +300 HP, +8 ATK, +3 DEF, +3 SpeDef, extra class item per Pokemon.

### Arceus (Act 5 Boss)
15 items (incl. the boss-only **Legend Plate**, see below), +10000 HP, +150 ATK, +60 DEF, +60 SpDEF, +500 AP. Items set in `getArceusEncounter()` in `spire-encounters.ts`. Arceus fight always ends in "defeat" — score is damage dealt. Top 5 damage scores per difficulty tracked in `arceus-record*.json`. Tilemap set to "In the Nightmare" region. Can be challenged after winning OR losing the champion fight (guard: `currentAct === 4`, admin bypass). **One-shot:** `arceusChallenged` is set at fight start and persisted, but the forfeit-on-resume guard keys on `!isEndless && currentAct >= 5` (entering the Arceus act) as well — because `ENTER_ACT_5` autosaves a resumable run *before* `arceusChallenged` is set, so without the act check a player could leave from the Act-5 map / Arceus PICK screen and re-enter. Resuming any run that has reached the Arceus act forfeits it (see `resumeGame`), so a player can't quit a bad damage roll and retry. Gold-scaling effects (Gold Bottle Cap, Gholdengo) read `player.money`, which is reapplied from the team snapshot on reconstructed opponents.

### Game Speed
Cycles through 0.5x → 1x → 2x → 3x. State field is `float32`. Server validates allowed values in `GAME_SPEED` handler.

### Balance Changes from PAC v6.10
All balance diversions from upstream are listed in the lobby's **PAC Diversions** panel (`spire-lobby.tsx`, events section). The panel uses colored tags (buffed/nerfed/changed/removed/new) with inline item/pokemon/synergy icons. The `new` tag (teal `PacTag`) flags Spire-original additions like Legend Plate.

**Items:**
- Legend Plate (`Item.LEGEND_PLATE`): NEW Spire-original item, **boss-only — held by Arceus, never offered to players** (not in any reward/shop/craft pool; only registered in the enum + `ItemStats: {}` + Arceus's item list). Pure effect, no stats: (1) **theft immunity** — the holder's items and stat boosts can't be stolen, knocked off, or transformed, guarded in the 6 item/stat-stealing ability strategies (`abilities.ts`): THIEF, KNOCK_OFF, PICKUP, SHADOW_CLONE, TRICK_OR_TREAT (all check `target.items.has(Item.LEGEND_PLATE)`), and SPECTRAL_THIEF / Marshadow (added alongside the existing TWIST_BAND guard). Ability *damage* still lands; only the steal is blocked. (2) **1000 damage cap** — any single instance of damage the holder takes is capped at 1000 (`pokemon-state.ts`, just before `pokemon.hp -= residualDamage`, so both HP loss and the recorded `takenDamage` → Arceus damage leaderboard respect it). Stops execute / %-max-HP cheese (Rhydon `HORN_DRILL`'s 9999, Bidoof `SUPER_FANG`) from one-shotting Arceus or spiking the leaderboard. Sprite: `assets/item/LEGEND_PLATE.png` (individual PNG for React UI) + a frame baked into the `item` multiatlas (`item.json`/`item.png`) for the in-game board.
- Gold Bottle Cap (`items.ts`): Crit power bonus capped at 200 gold (was uncapped)
- Tea (`dishes.ts`): PP reduced from 80 to 40
- Smoked Filet (`dishes.ts`): ATK 5→3, AP 10→5
- Rainbow Swirl (`abilities.ts`, `DecorateStrategy`): PP buff 60→50 (AP scaling on the PP also removed — see PP Batteries below)
- Dojo Tickets: Apply instantly (not after 3 fights), one per Pokemon per act
- Item Reroll Ticket (`Item.ITEM_REROLL_TICKET`): NEW Spire-original consumable (unholdable, in `RerollTickets`). On a Spire wild-reward screen it replaces the whole offer with item-components-only (same option count). Asset: `assets/item{tps}/ITEM_REROLL_TICKET.png` (source for the atlas) + `assets/item/ITEM_REROLL_TICKET.png` (dist, for React UI). Joins the other 3 reroll tickets (basic/class/upgrade), all Spire-only post-fight drops
- Repeat Ball: Removed (commented out of the shiny item pool — excludes it from both reward offerings AND golden eggs)
- Red Scale: Removed (commented out of the shiny item pool — excludes it from both reward offerings AND golden eggs)
- Berries: All berries are removable — added `...Berries` to `RemovableItems` (`app/types/enum/Item.ts`). Benching a Pokémon (`onPokemonChangePosition()` in `game-commands.ts`, plus Arceus's `RKS_SYSTEM` passive) returns its berries to the player's inventory instead of leaving them stuck on the unit. Upstream PAC leaves berries non-removable.
- Mushrooms (Oinkologne drops — Tiny/Big/Balm): Auto-sold for gold (1/2/5g via `ItemSellPricesAtTown`) on entering a PokeMart (SHOP) or Pokemon Center (REST). Implemented as `autoSellTownItems()` in `game-commands.ts`, called at the top of `initializeShopPhase()`/`initializeRestPhase()` **before `autoSaveRun()`** so the save reflects the cashed-out inventory (resume can't re-sell). Reuses the legacy PAC town-sell logic (`ItemsSoldAtTown` is exactly the three mushrooms); the PAC TOWN phase that originally did this is unused in Spire, so without this hook mushrooms never sold. Sends `Transfer.PLAYER_INCOME` → client gold toast (`game.tsx`). En description text updated in `dist/client/locales/en/translation.json` ("...at a PokeMart or Pokemon Center"); other locales still say "when returning to town".

> **Shiny item pool is a single source of truth.** `ShinyItems` (`app/types/enum/Item.ts`) is the one curated Spire list used for *all* shiny-item reward offerings (boss/legendary/async floor-20 rewards, shop carousel) **and** golden eggs. `GoldenEggItems` (`app/config/game/synergies.ts`) is just an alias: `export const GoldenEggItems = ShinyItems`. Golden eggs come from the BABY synergy (count 3/5/7) and award `pickRandomIn(GoldenEggItems)` when a shiny `EGG` hatches (`hatch-evolution-handler.ts`). To add/remove a shiny item, edit `ShinyItems` only — both paths follow automatically. Repeat Ball and Red Scale are the two items currently commented out of it.

**Pokemon:**
- Snorlax/Munchlax (`Passive.GLUTTON`): Berry/Gourmet HP gains halved
- Misdreavus/Mismagius (`Ability.NIGHT_SHADE`): Damage capped at 500
- Bidoof/Bibarel (`Ability.SUPER_FANG`): Damage capped at 500 (`Math.min(500, …)`, mirrors Night Shade) — stops the %-max-HP true damage from spiking vs high-HP targets like Arceus. The cap is reflected in the ability tooltip (`SUPER_FANG` effect text in `dist/client/locales/en/translation.json`, English only); other locales still show the upstream uncapped text
- Alcremie Rainbow Swirl (`Ability.DECORATE`): PP buff 60→50 (AP scaling on the PP removed — see PP Batteries below)
- PP Batteries (`abilities.ts`): The PP these abilities grant to **allies** no longer scales with the caster's AP — the `addPP(...)` call passes `apBoost = 0` (was `1` full, or `0.5` for Fairy Wind/Decorate). Affects FAIRY_WIND (Flabébé/Floette/Florges), DECORATE (Alcremie Rainbow Swirl), MISTY_SURGE (Tapu Fini), FORECAST (Castform Rain), IVY_CUDGEL (Ogerpon Wellspring), AFTER_YOU (Indeedee Male), TERRAIN_PULSE (Smoliv/Dolliv/Arboliva), SPITE (Yamask/Cofagrigus). Only the PP gain changed; co-located heals/shields/buffs/damage keep their AP scaling. SOAK and the DRUMMER passive already granted flat PP (unchanged).
- Grookey/Thwackey/Rillaboom (`pokemon.ts`): `maxPP` 60→70 on all three stages. Slows how often the DRUMMER line casts (it feeds PP to adjacent allies instead of casting often). Also synced in `precomputed/pokemons-data.csv`.
- Skeledirge (`Ability.TORCH_SONG`): Flame count hard-capped at 20 (`Math.min(20, …)`). The AP buff still applies **once per flame** (as upstream does) — capping the flame count is what bounds the command queue, so per-flame AP can no longer run away. Without the cap this was a feedback loop (AP-scaled flame count + per-flame AP gain) that flooded `pokemon.commands` with unbounded `DelayedCommand`s, leaking memory and OOM-crashing the production server. Other than the cap, byte-identical to upstream PAC.
- Cosmog/Cosmoem (`pokemon.ts`): Evolve after 3 stacks instead of 8; +30 max HP per evolution instead of +10 (`evolution-logic/evolution-manager.ts` `afterEvolve`, the COSMOG/COSMOEM stacking block)
- Tandemaus/Maushold (`pokemon.ts`): Each stage evolves 5 fights after acquisition via a hatch-style timer — `evolutionRule = { type: EvolutionRuleType.HATCH, hatchTime: 5 }` (honored by `evolution-logic/hatch-time.ts`), instead of fixed `stageLevel >= 14`/`>= 20`. (Replaced the old `TimerEvolutionRule` class, removed in the 6.10 evolution refactor.)
- Count evolutions: 2★+ units need only `min(numberRequired, 2)` copies (`evolution-logic/count-evolution-handler.ts`)
- Charcadet armor & Zacian Rusted Sword (`game-commands.ts` `grantBossSignatureItems()`): Added to the player's inventory for winning any act-end boss (floor-20 Legendary Boss or Endless async fight), instead of the dead upstream `pve-stages.ts` PvE-stage reward path

**Synergies:**
- Light (`synergies.ts`): Triggers raised from 2/3/4/5 to 3/4/5/6
- Flora (`synergies.ts`): Triggers lowered from 3/4/5/6 to 2/3/4/5 (each tier one less). The Bellossom (5th/orange) flower pot unlocks at the top tier (`FLOWER_POWER`, now Flora 5) once all 4 base pots are fully grown. **Gotcha:** the client renderer `getNbFlowerPots()` (`board-manager.ts`) had the top breakpoint hardcoded as `>= 6` (upstream's old value) so the Bellossom pot wasn't *drawn* until Flora 6 even though the server spawned it at 5 — now derived from `SynergyTriggers[Synergy.FLORA].at(-1)` so it can't drift if Flora is retuned
- Fighting (`pokemon-state.ts`): Damage blocked per tier (Guts/Sturdy/Defiant/Coaching) raised from 3/6/9/12 to 4/8/12/16. Effect text in `dist/client/locales/en/translation.json` (GUTS/STURDY/DEFIANT/COACHING); other locales still show upstream numbers
- Grass (`pokemon-state.ts`): Healing per 2s (Ingrain/Growth/Spore) raised from 5/15/25 to 5/20/35 (Overgrow shares Spore's value). Effect text in `dist/client/locales/en/translation.json` (INGRAIN/GROWTH/SPORE); other locales still show upstream numbers
- Fishing Rods (`items.ts`, `FishingRodEffect`): Only proc after wild battle encounters
- Gyms removed: Amorphous, Light, Gourmet, Artificial (commented out in `GYM_LEADER_POKEMON`)

**General:**
- Evolution: 6 copies for 3★ instead of 9
- Hatch mons: 5 stages to hatch, 8 stages to evolve

## Run End Paths

**Run history is one document per run, keyed by `runId`.** `state.runId` is a stable UUID minted at `startGame()` and preserved across save/resume. The history record is **created when the Act 3 boss falls** (`recordActThreeVictoryOnce` → `saveRunHistory`) and **upserted by `runId`** on every later milestone (Elite Four / Champion / Arceus), so a run can never appear twice (the old before/after-Arceus duplicate). `saveRunHistory` / `saveRunHistoryFromSavedRun` use `RunHistory.updateOne({ runId }, …, { upsert: true })`.

All run-ending paths must: (1) delete saved run, (2) save run history (upsert by `runId`), (3) increment player stats. The 6 paths:

| Path | Location | victory | champion |
|---|---|---|---|
| Elite Four loss | `OnUpdatePhaseCommand` E4 branch | true | false |
| Arceus fight end | `endArceusFight()` | true | true |
| Champion fight end | `endChampionFight()` | true | !!winner |
| HP death (non-fight) | `checkRunDeath()` | false | false |
| Boss loss Act 3+ | `stopSpireFightingPhase()` boss branch | false | false |
| HP death (fight) | `stopSpireFightingPhase()` HP branch | false | false |

### Elite Four Climb → Swap-Up Cascade

The Elite Four is a 4-slot ladder (`champion-data.ts` `eliteFour[0..3]`, #1 weakest → #4 strongest), climbed bottom-up on Act 4 floors 1-4. **Winning a fight persists your team immediately** via `placePlayerInEliteFour(e4Index)` (`game-commands.ts`, called from the `ELITE_FOUR` win branch; `e4Index = floor - 1`), tagged with the run's `runId`:

- You take the beaten member's slot. For slot N>0 the beaten member slides **down** into slot N-1 (the slot you held from beating the lower member), so your single entry climbs the ladder. Beating #1 (slot 0) drops the old #1 off the bottom. `eliteFourCrownedAt` / `eliteFourVictories` / `eliteFourTies` move in lockstep; your new entry gets `crownedAt = now`, `victories = 0`, `ties = 0`. **Saved to disk on every win.**
- **A loss does NOT modify the lineup** — every member you beat was already placed, so a loss just ends the run (losing to #1, having beaten nobody, leaves the ladder untouched). The defending member's win counter is still credited via `incrementE4Victory` earlier in the branch.
- Net effect: exactly **one ladder entry per run** (it moves up as you climb), identified by `runId`. A player may legitimately hold several entries across *different* runs (and can face their own old teams).

Becoming Champion is the same swap one rung higher: `promoteNewChampion()` (`champion-data.ts`) puts your team in the Champion slot and slides the dethroned champion **down into E4 #4** (the slot you vacated by climbing there). E4 #1-3 are untouched. A champion *loss* likewise changes nothing (you already hold E4 #4 from the climb). The winner snapshot carries the `runId`.

> **History note:** this replaced the old "loss inserts you just below the member who beat you" mechanic (`E4_LOSS_TAKES_SLOT`, `insertIndex = floor - 2`) and the old promote-*shift* (which dropped E4 #1). Both are gone — wins place you, losses don't, promotion is a swap — so a single run never produces a duplicate ladder entry.

## Evolution State Persistence (Save/Resume Gotcha)

Some evolutions are driven by **runtime instance fields that are NOT Colyseus schema-synced** (they live on the `Pokemon` model as plain TS fields, not `@type`). These are invisible to the save snapshot unless explicitly persisted — if dropped, the **beginning-of-turn evolution re-check** (`updatePlayerBetweenStages()` → `EvolutionManager.tryEvolve` at stage start, called from `initializePickingPhase`) fails and the evolved form **silently reverts on resume** (the "Primarina turned back into Brionne after I left" bug).

**Trigger fields that must be snapshotted** (all in `SnapshotPokemon`, saved by `snapshotPlayerTeam`, restored in `restoreRunToState` + both `reconstructTeam*`):
- **`deathCount`** (`pokemon.ts:108`, incremented in `pokemon-entity.ts onDeath` → `refToBoardPokemon.deathCount++`). Gates the **STATE** evolution Corsola→Galarian Corsola (`deathCount > 0`) and selects the Basculin→Basculegion **male/female form** (`deathCount >= 5`, the STACK rule's `divergentEvolution`).
- **`originalMap`** (`Stantler.originalMap`, set in `onAcquired` to `player.map`). Gates the STATE evolution Stantler→Wyrdeer (`player.map !== originalMap && stageLevel >= 20`). Default `"town"`; only saved when non-default.

**The deferred-hatch race.** HATCH evolutions apply via a **2000ms `setTimeout` in `EvolutionManager.updateHatch`**, so for ~2s after a stage starts the board still holds the pre-evolution form. An autosave in that window would capture the old name. `snapshotPlayerTeam()` defuses this by **promoting a pending hatch**: when a non-egg HATCH mon already satisfies `stacks >= stacksRequired`, the snapshot records `pokemon.evolution` (the imminent form) instead of the current name, and drops the pre-evolution `stacks`/`stacksRequired`/`evolution` (the evolved form supplies its own). Stat boosts stay computed against the *current* form's baseline because the boost diff carries unchanged across evolution. **Eggs are excluded** (`evolution === DEFAULT` → random hatch that must not be predicted).

**Evolutions that are already safe** (trigger state is schema-synced or fully derivable from the saved board): COUNT (board copies), STACK like Poipole→Naganadel (`stacks`/`stacksRequired`, persisted, and the evolve is *synchronous* — no setTimeout), ITEM (held items), PLACEMENT (board position), MONEY (player.money), and STATE evolutions keyed only on board/map/stage (Burmy→Wormadam). **When adding any new STATE evolution or divergent-form rule, check whether its condition reads a non-schema field; if so, add that field to `SnapshotPokemon` and all 4 save/restore sites.**

## Champion/E4 Opponent Reconstruction (Important Gotchas)

Champion and Elite Four opponents are saved player teams that fight as **real Player objects** (not the `{ id: "pve", board }` pattern used for wild/gym/elite/boss encounters). This enables full synergy behavior including ground holes, light spotlight, bench interactions, and Dragon double-types.

**Critical implementation details:**
- `reconstructTeamAsPlayer()` creates the opponent Player. It MUST set `player.team = Team.RED_TEAM` — synergy effects like `GroundHoleEffect` use `player.team` to flip board coordinates. Without it, hole lookups use wrong indices and return 0.
- It also reapplies `player.money = snapshot.money ?? 0` so gold-scaling effects fire for the opponent (Gold Bottle Cap crit power, Gholdengo gold damage, both read `pokemon.player.money`). Legacy snapshots saved before the `money` field report 0 until re-saved.
- Synergies/effects MUST be computed via `computeSynergies()` + `player.effects.update()` directly — NOT via `player.updateSynergies()`. The latter triggers side-effect methods (`updateScarves`, `updateArtificialItems`, `updateTms`, `updateFairyWands`, `updateWeatherRocks`, `updateFishingRods`) that add random junk items from the Player constructor's randomly-initialized fields, corrupting the opponent's state and potentially erroring before `effects.update()` runs.
- The opponent Player is temporary (not in `state.players`). It's passed directly to `new Simulation(...)` as the `redPlayer` parameter.
- Server-computed synergy counts are synced via `encounterSynergies` because client-side computation from encoded board strings misses Dragon double-types and other computed bonuses.
- Opponent ground holes are synced via `encounterGroundHoles` and rendered by `board-manager.ts renderOpponentGroundHoles()` on the opponent's board half.
- When selecting an E4/Champion node, `player.map` is set to the snapshot's `region` field (their Home Town) for the tilemap background. Falls back to default if region is missing or "town".
- **Snapshot hygiene**: `encounterSnapshot` is the trigger for the snapshot render/reconstruct path. PVE nodes (wild/gym/elite/boss/Arceus) never set it, so it MUST be null for them — `onSelectMapNode()` clears it (and `encounterCrownedAt`) at the top. If a stale snapshot survives into a PVE node, the snapshot branch fires and re-displays the prior opponent's `encounterInventory` items. This is also why act transitions must go through `initializeMapPhase()` (which nulls the snapshot) — the champion-items-during-Arceus bug came from `ENTER_ACT_5` bypassing it.

**Gourmet dish preservation:**
- Dishes are consumed (`pokemon.dishes.clear()`) during `Simulation.start()`, so by the time `snapshotPlayerTeam()` runs post-fight, `pokemon.dishes` is empty.
- Solution: dishes are recorded to `pokemon._cookedDishes` (non-schema runtime field) via the `Pokemon.addDish()` helper (`dishes.add` + `_cookedDishes.push`). **All** player-side dish sources use it — chef cooking (`chefCookEffect`), manual drag-drop equip (`game-commands.ts`), Picnic Set sandwiches, and dish carry-over on evolution — so non-cooked dishes (e.g. mushrooms dragged from inventory) aren't lost from the post-fight E4/Champion snapshot. `snapshotPlayerTeam()` falls back to `_cookedDishes` when `dishes` is empty. `_cookedDishes` is reset at the start of each stage in `updatePlayerBetweenStages()`.
- `reconstructTeamAsPlayer()` restores dishes to `pokemon.dishes` (schema field) so they're visible to the client during PICK phase. `encodeSnapshotForClient()` encodes dishes in a **separate** `|`-segment (format `name,x,y[,items][|boosts[|dishes]]`), NOT merged into the items list — so `board-manager.ts addPvePokemons()` can add them to `pokemon.dishes` and the `PokemonSprite` renders them *below* the unit (via `updateDishes()`) instead of as held items to the right. (Earlier they were merged into items and wrongly shown in the items panel.)
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

## Player Health: `state.runHP` vs `player.life` (IMPORTANT)

Spire has **two separate health fields** — confusing them is a common source of bugs:

- **`state.runHP`** (`game-state.ts`, `@type("int16")`) — The **authoritative** Spire run health. Synced to all clients, shown on the HP bar, used for death checks and run-ending logic. This is the one that matters.
- **`player.life`** (`player.ts`, `@type("int16")`) — Legacy PAC multiplayer health. In Spire, this is a **read-only mirror** of `state.runHP`, updated at phase boundaries by `syncRunHPToPlayers()`. Direct modifications to `player.life` are invisible to the Spire HP bar and game logic.

**How to modify run HP from abilities/items/effects:**
- Use `player.addRunHP(value)` — safely modifies `state.runHP`, clamps to 0-100, and syncs to `player.life`. Works because Player stores a `gameState` reference (set in constructor).
- Use `player.getRunHP()` — reads from `state.runHP` when available, falls back to `player.life`.
- **NEVER** write `player.life += X` or `player.life -= X` directly in ability/item/effect code. It won't affect the actual run HP.

**How run HP flows:**
```
state.runHP (source of truth)
    ↓ syncRunHPToPlayers() — called at phase transitions
player.life (mirror for client rendering / legacy code)
```

**Where `state.runHP` is legitimately modified:**
- Battle loss damage: `stopSpireFightingPhase()` in `game-commands.ts`
- Post-battle healing: `initializeRewardPhase()` (relic heal hook — currently a no-op, no relic grants it yet)
- Pokemon Center / Rest: `initializeRestPhase()`
- Mystery events: event choice handlers
- `player.addRunHP()`: helper method for abilities/items/effects

**Key files:**
- `player.ts`: `gameState` field, `addRunHP()`, `getRunHP()` methods
- `game-commands.ts`: `syncRunHPToPlayers()` (state→player sync), all direct `state.runHP` modifications

## Login Page (`auth.tsx`)

- Logo: `assets/ui/AutoSpire.png`
- Title: "Pokemon Auto Spire"
- Login via PAC's `StyledFirebaseAuth` component (Google + Email providers)
- "Play as Guest" button bypasses auth and uses mock `"local-player"` uid
- Footer: version (from `package.json`), fan credit line, PAC credit, upstream version note, Discord link
- After sign-in, shows "Authenticated as: Click to reveal" (hides real name/email until clicked)
- Player name defaults to "Username" — Google display name is NOT auto-filled
- Built on Pokemon Auto Chess v6.10.1 (`prod@79505b1`)

**Auth restore on refresh (IMPORTANT).** `firebase.auth().currentUser` is `null` for a moment after a page reload while Firebase restores the session asynchronously — reading it synchronously misidentifies a signed-in user as a guest. `network.ts` exposes **`waitForFirebaseAuth()`** (resolves on the first `onAuthStateChanged`, caches the promise), and `authenticateUser()` is **async** and awaits it before falling back to the `"local-player"` guest mock. The lobby guard (`spire-lobby.tsx`) and "Play as Guest" (`auth.tsx`) both await it: on a refresh with no Redux `uid`, the lobby waits for Firebase — a restored user is re-logged-in and stays, otherwise it redirects to `/`. Without this, a signed-in user who refreshed mid-session got silently downgraded to guest and stranded in the lobby. Any new `authenticateUser()` caller must treat it as a promise.

**iCloud / email-password login & email enumeration protection.** If the Firebase project has **Email Enumeration Protection** enabled (Authentication → Settings → User actions), `firebaseui@6.1.0`'s email/password flow breaks: `fetchSignInMethodsForEmail` returns empty, so FirebaseUI shows existing users the *sign-up* form and they hit `auth/email-already-in-use` ("account exists with that email" but can't log in). Hits @icloud.com users specifically (no Google-button alternative). Fix = **disable** that setting in the Firebase Console (FirebaseUI's own README recommends this when using the email provider), or replace the FirebaseUI email flow with a custom form calling `signInWithEmailAndPassword` directly. Check the project's `emailPrivacyConfig` via the Identity Toolkit admin API with the service-account creds if a user reports this.

## Inventory Item Stacking

Duplicate items in the **player inventory** collapse into a single icon with a count badge (bottom-right); Pokémon-held items still render individually. Display-only — `player.items` still holds duplicate entries server-side, so every drag/craft/sell/equip (which identifies items by name and removes one instance) automatically re-renders the stack with the count reduced. No server changes.

- `items-container.ts` `render()` — groups duplicates into one `ItemContainer` per distinct item **only when `pokemonId === null`** (player inventory); calls `setStackCount(n)`. Sort order preserved; the flat `items` list is kept for existing consumers.
- `item-container.ts` — `stackCount` + `setStackCount()` draw a `stackText` badge bottom-right when ≥2 (separate from the top-right `updateCount` badge that battle code uses for held-item stacks).
- `game-scene.ts` — **same-component crafting** (e.g. Fossil Stone ×2 → Old Amber): dragging from a stack of 2+ leaves a static "ghost" `ItemContainer` (count−1) behind in the inventory as a drop target, and `itemDragged` becomes a single item. The ghost only **arms as a drop zone after the drag moves ~40px away** (so releasing in place is a no-op, not an accidental craft); on `dragend` the ghost is destroyed and the inventory re-renders from server state. Dropping the dragged item onto the ghost sends the normal `DRAG_DROP_COMBINE`.

## In-Game HUD

The in-game HUD is **two Slay-the-Spire-style full-width bars** — top and bottom — sharing their chrome CSS in `game-stage-info.css` (`#game-stage-info` / `#game-bottom-bar`, both `.my-container`, 3em tall, z-index 60, mirrored border radii). The old centered stage-info element, the bottom shop bar, and the bottom-left float cluster are all gone. Both bars sit inside `#game-wrapper` (already offset right by the sidebar on desktop, so `left:0/right:0` = full play-area width) and render in `game.tsx` when `!isBoardHidden`.

**Top bar** (`game-stage-info.tsx`, `<GameStageInfo onLeave={() => setShowLeaveConfirm(true)} />`). Left→right:
- **Identity**: player avatar + name + a subtitle line showing the **Spire class name** (`SPIRE_CLASSES[spireClass].name`) in Spire, else the **difficulty** label (Easy/Normal/Hard/Impossible).
- **Opponent "vs" block** (right of the name): portrait + `vs <name>`. Shown in **PICK / FIGHT / REWARD** (`showOpponent`). Uses `spectatedPlayer.opponentName/opponentAvatar` (set only at fight start) with a fallback to the synced `encounterName`/`encounterAvatar` for before/after — so the team you're about to face shows pre-fight and stays on the rewards screen.
- **Resources** (center): HP (`runHP/100`, color-graded), Gold, Team size.
- **Right**: weather icon + battle `TimerBar` (FIGHT only), and the **Leave Game button** (red `bubbly`, `onLeave` prop → the leave-confirm dialog; moved here from the mid-screen panel, which is now admin-cheats-only and gated `isAdmin && !spectate`).

**Bottom bar** (`game-bottom-bar.tsx`, `<GameBottomBar onShowMap={mapVersion > 0 ? () => setMapHidden(false) : undefined} />`). Left→right:
- **Left** (`.bottombar-left`): `GameRegionalPokemonsIcon` + `GameRarityPercentage` (encounter-rate chips) — absorbed from the old `.game-bottom-floats` cluster.
- **Center**: the `GameExperience` widget (level + buy-XP button + XP bar).
- **Right** (reuses `.topbar-right`/`.topbar-speed-button`/`.topbar-floor` classes): the **speed-cycle button** (`cycleSpeed`) and the **Act/Floor yellow map button** (`bubbly orange`, `onClick={onShowMap}`).
- At `<=960px` the bar gets `left: 60px` to clear the collapsed sidebar's 60×60 toggle button pinned bottom-left on mobile.

`GameShop` (`game-shop.tsx`) now ONLY hosts the `toast-money` / `toast-life` `ToastContainer`s (targeted by `containerId` elsewhere — don't remove them). `GameStreakInfo` was dropped (renders `null` in Spire — its history filter excludes all-PvE fights). The relic HUD (`game-relic-container.tsx`) sits at `top:3.5em` to clear the top bar. **Draggable windows** (`.draggable-window` — both synergy panels, run-end) have `z-index: 61` so a window dragged over a bar keeps a grabbable header (bars 60 < windows 61 < modals 71 < tooltips 75).

**Theme note**: the five theme stylesheets that give the top bar its translucent background (`fishspick`, `pasdefault`, `origin`, `umbra`, `unown` in `dist/client/themes/`) list `#game-bottom-bar` alongside `#game-stage-info` — keep both ids in sync when theming.

**New Redux fields** (all in `GameStore.ts` + `$state.listen` in `game.tsx`): `spireClass`, `encounterName`, `encounterAvatar`. The opponent preview *board* behavior (visible before/during/after the fight) is documented under board-manager above.

## Mobile / Touch Support

Phone/tablet support is CSS + input-layer work; nothing server-side. The signal for "mobile" is `(pointer: coarse)` wherever possible (orientation/width-independent), NOT width breakpoints — wide phones in landscape (933px+) and iPads slip past width gates.

- **Rotate overlay**: `#rotate-device-overlay` (rendered in `game.tsx`, styled in `style/index.css`) — a blocking "Rotate your device" prompt on the game page, gated `@media (orientation: portrait) and (pointer: coarse)`. The board is landscape-shaped; `Scale.FIT` letterboxes portrait into a sliver.
- **Canvas sizing**: `GameContainer.resize()` (`game-container.ts`) measures `this.div.clientWidth/Height` (the `#game` element), NOT `window.innerWidth - 60` — the 60px sidebar rail only exists on wide screens; at `<=960px` the sidebar collapses to a floating bottom-left button and `#game` is `100vw` (the hardcoded −60 used to letterbox the board by exactly the sidebar width).
- **Double-tap zoom**: killed globally via `touch-action: manipulation` on html/body/buttons/inputs/canvas/`.clickable`/`.bubbly` (`style/index.css`). Panning/pinch still work.
- **Picker touch model** (`game-choice.tsx`): tap = pick immediately; **press-and-hold ~400ms** = open the pokemon's detail tooltip without picking (the lift-click is swallowed via a `longPressFired` ref; finger movement cancels; next tap dismisses). Implemented by forcing the react-tooltip open through the optional `detailOpen` prop on `GamePokemonPortrait` — on touch the tooltip is ALWAYS controlled (`isTouchDevice ? detailIndex === index : undefined`); never flip a react-tooltip between controlled (`true`/`false`) and uncontrolled (`undefined`), it gets stuck. `.game-choice .my-box.clickable` sets `-webkit-touch-callout: none` so iOS doesn't open the image-save sheet mid-hold.
- **Board long-press** (`pokemon.ts` `startLongPress`): 450ms hold on a board/bench pokemon opens the same detail panel as desktop right-click; cancelled on move (>8px)/up/out/drag. ⚠️ The touch gate is `pointer.wasTouch` — `Pointer.touch` does NOT exist in Phaser and silently never fires.
- **Balance panel**: hidden entirely on `@media (pointer: coarse), (max-width: 900px)` (`game-balance-panel.css`).
- **Reward picker sizing** (`game-choice.css` `<=900px`): choice lists wrap, item boxes get `min-width: 140px` (the desktop `max-width: 20vw` collapses to ~78px on phones), picker container capped `96vw`/`82vh` with scroll.
- **Viewport & safe areas**: `viewport-fit=cover` in the viewport meta (`app/views/index.html` — the build copies it to `dist/client/index.html`); both HUD bars pad with `max(0.75em, env(safe-area-inset-left/right))` for notches. `body`/`#game`/lobby sections declare `100dvh` after their `100vh` fallback (mobile URL bar makes `100vh` taller than the visible area).
- **iOS input zoom**: `@media (pointer: coarse)` floors `input`/`select`/`textarea` to `font-size: max(16px, 1em) !important` (`style/index.css`) — iOS zooms the page when focusing anything smaller; `!important` because several inputs set 12-14px inline.
- **Bar breakpoints**: `<=900px` shrinks both bars; `<=700px` (small landscape phones) additionally hides `.topbar-opponent-name`, the `/100` HP max, and the bottom bar's XP progress bar so nothing overflows at 667px.
- **Lobby stacking/fonts**: the Tutorial|Endless `li` has class `.lobby-mode-row` → `flex-direction: column` at `<=960px`; lobby titles use `clamp()` instead of raw `vw` (raw `1.25vw` was ~5px on phones).
- **PWA**: `dist/client/manifest.json` (fullscreen, landscape, name "Pokemon Auto Spire") + `dist/client/icons/icon-{180,192,512}.png` (generated from `assets/ui/AutoSpire.png` via `sips`) + manifest/apple-touch/theme-color tags in `app/views/index.html`. Both live at the dist root (NOT under the gitignored `dist/client/assets/`) and are committed, like the theme CSS files. The existing `sw.js` service worker makes it installable.
- **Lobby difficulty row** (`.difficulty-buttons-row`, `lobby.css`): unconditional `overflow-x: auto` + non-shrinking children — the Play panel is ~50% of the window so the ~630px row overflows at many widths (iPad landscape, mid-size desktop), not just phones. The Impossible unlock hint is a visible line BELOW the row (a hover tooltip would be clipped by the scroll container). `.room-menu`/`.events-menu` have explicit `overflow-x: hidden` — `overflow-y: auto` alone computes `overflow-x` to `auto`, so any child poking out horizontally turned the whole panel into a sideways scroller (the "dragging moves the whole panel" bug).

## Map Visuals (`game-map.tsx`)

- Background: PAC poster `assets/posters/hd/6.6.png` (The Cove) at 20% opacity, `cover` sizing, stretches to full SVG height
- Dotted path lines: `#999` (unvisited), `#aaa` (visited), `#444` (missed)
- Border: `#999` to match path lines
- Other PAC posters available at `assets/posters/` (non-HD: 3.8–6.9) and `assets/posters/hd/` (HD: 6.2–6.9) for future per-act backgrounds

## UI Themes

Theme selection (Interface → Theme) is driven by `app/config/game/theme.ts` (`THEMES` list, `VIDEO_BG_THEMES`, `Theme` type) and applied at runtime by `app/public/src/theme.ts` → `applyTheme()`. A theme = (1) an id in `THEMES`; (2) a stylesheet `app/public/dist/client/themes/<id>.css` loaded via `<link>` (runtime, **not** bundled — edit + hard-refresh, no rebuild); (3) for video themes (in `VIDEO_BG_THEMES`), `assets/theme/<id>/videobg.mp4` (a fullscreen `#videobg`, `z-index:-1`); (4) a `theme.<id>` translation; (5) the default in `app/public/src/preferences.ts`. The special id `"default"` loads no CSS/video (bare classic look). Theme CSS overrides the global palette vars from `app/public/src/style/colors.css` (`--color-bg-primary/secondary/tertiary/accent`, `--color-special`); `.my-box`/`.my-container` backgrounds derive from those vars.

**Spire change:** `isThemeUnlocked()` was gutted to always return true — single-player has no title progression, so every theme is available (upstream gated most behind `TITLE_BY_THEME` titles).

**Custom Spire themes** (both clone Zen Garden's `videobg.mp4` as the background video):
- **PAS Default** (`pasdefault`) — the default theme: Zen Garden background + classic colours, **opaque** panels (CSS is just `#videobg`, no transparency).
- **Fish's Pick** (`fishspick`) — neutral **grey** `:root` palette, with panels at ~80% alpha so the video shows through: the `.my-box` leaderboards (centre Champion/Elite Four, Arceus, Endless, Victory + Live Runs) plus the in-game HUD — both full-width bars `#game-stage-info` + `#game-bottom-bar` (see "In-Game HUD") and the reward panel `.game-choice > .my-container`.

Adding the `THEMES` list / changing the default preference **does** require `npm run build` (those are bundled); editing a theme's `.css`, video, or translation does not (runtime-loaded — hard-refresh).

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
