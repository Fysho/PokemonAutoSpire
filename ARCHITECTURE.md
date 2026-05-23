# Pokemon Auto Chess - Source Architecture

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Game Engine | Phaser 4 | Rendering, sprites, input, tilemaps |
| UI Framework | React + Redux | HUD, shop, menus, overlays |
| Server | Node.js + Colyseus | Authoritative game state, real-time sync |
| Database | MongoDB | User profiles, stats, bots, chat |
| Auth | Firebase | Player authentication |
| Transport | WebSocket (Colyseus) | Client-server state synchronization |
| Build | esbuild | Bundling |

## Room Lifecycle (Multiplayer Flow)

```
CustomLobbyRoom → PreparationRoom → GameRoom → AfterGameRoom
   (matchmaking)    (8-player lobby)   (main game)   (results/XP)
```

## Game Phase Cycle (Inside GameRoom)

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   TOWN   │────►│   PICK   │────►│  FIGHT   │──┐
│ (minigame│     │ (opponent │     │ (battle  │  │
│  walk    │     │  preview) │     │  sim)    │  │
│  items)  │     │  ~2 sec   │     │ 30-90s   │  │
└──────────┘     └──────────┘     └──────────┘  │
     ▲                                           │
     └───────────────────────────────────────────┘
```

- **TOWN**: Players walk around a shared map, collect floating items, interact with portals/NPCs
- **PICK**: Brief transition showing next opponent, players finalize board placement
- **FIGHT**: Server runs battle simulation, Pokemon auto-battle on the board

## Core Systems

### 1. Shop & Economy
- **File**: `app/models/shop.ts`
- 5 Pokemon offered per roll, cost 1 gold to reroll
- Rarity pools with weighted probabilities per player level
- Interest system: earn `min(5, gold / 10)` bonus per round
- Shop lock prevents refresh between rounds

### 2. Battle Simulation
- **File**: `app/core/simulation.ts`
- Server-authoritative: all combat runs on server, client displays results
- Pokemon state machine: Idle → Moving → Attacking → Idle
- Damage pipeline: base ATK → crit check → type (phys/spec/true) → defense reduction
- Attack cooldown: `baseDuration / (0.4 + speed * 0.007)`

### 3. Pokemon Entities
- **File**: `app/core/pokemon-entity.ts`
- Stats: HP, ATK, DEF, SPE_DEF, Speed, Range, PP, AP, Crit, Luck
- Stars (1-3): evolution through collecting 3 copies
- 1-3 item slots per Pokemon

### 4. Abilities & Effects
- **Abilities** (`app/core/abilities/`): 200+ moves, consume PP, scale with AP
- **Effects** (`app/core/effects/`): Three categories:
  - Item effects (200+): triggered by equipping/combat events
  - Passive effects (150+): Pokemon-specific innate abilities
  - Synergy effects: team composition bonuses at thresholds (2/3/4/5/7/10)

### 5. Synergy System
- **File**: `app/types/enum/Synergy.ts`
- 32 synergy types (FIRE, WATER, GRASS, MONSTER, DRAGON, etc.)
- Activate bonuses by fielding multiple Pokemon of same type
- Thresholds vary per synergy (e.g., Fire: 2/4/6/8, Monster: 2/4/6)

### 6. Items
- **File**: `app/types/enum/Item.ts`
- 333+ items across categories: equipment, berries, gems, wands, dishes, masks
- Crafting: 60+ recipes combining 2 base items
- Categories: Equipment, Consumable, Town-only, Holdable/Unholdable

### 7. Evolution
- **File**: `app/core/evolution-rules.ts`
- CountEvolution: collect 3 copies → evolve (standard)
- ItemEvolution: specific item triggers evolution
- ConditionEvolution: level/stat thresholds
- HatchEvolution: eggs hatch into Pokemon

## Client Architecture

### Phaser Scenes
- `game-scene.ts` (850 lines): Main scene, input, camera
- `preloading-scene.ts`: Asset loading
- `debug-scene.ts`: Dev tools

### Board Modes (in `board-manager.ts`, 1563 lines)
- **PICK mode**: Board grid, bench, drag-drop Pokemon/items
- **BATTLE mode**: Combat display, HP bars, ability VFX, damage numbers
- **TOWN mode**: Avatar walking, floating items, portals, NPCs

### Key Client Components
| File | Purpose |
|------|---------|
| `game-container.ts` | Colyseus room integration, state listeners |
| `board-manager.ts` | Board rendering, all 3 modes |
| `battle-manager.ts` | Battle animation and display |
| `minigame-manager.ts` | Town mode (walking, items, portals) |
| `pokemon.ts` | Draggable Pokemon sprite |
| `pokemon-avatar.ts` | Walking avatar with emotes |

### React UI Components (in `pages/component/game/`)
- `game-shop.tsx`: Shop display with 5 Pokemon slots
- `game-players.tsx`: Player list, life, rank
- `game-synergies.tsx`: Synergy wheel overlay
- `game-dps-meter.tsx`: Battle DPS statistics
- `game-pokemon-detail.tsx`: Pokemon stat popup

### State Management
- `GameStore.ts`: Phase, money, synergies, shop, DPS
- `NetworkStore.ts`: Connection status, auth
- `PreparationStore.ts`: Pre-game team setup

## Communication (Client ↔ Server)

### Server → Client (Colyseus Schema Sync)
Automatic state replication for: players, simulations, phase, avatars, items, portals, weather

### Client → Server (Transfer Messages)
- `DRAG_DROP` / `DRAG_DROP_ITEM` / `DRAG_DROP_COMBINE`: Board manipulation
- `SHOP` / `REFRESH` / `LOCK`: Economy actions
- `LEVEL_UP` / `SELL_POKEMON`: Progression
- `SPECTATE` / `LOADING_PROGRESS`: Meta actions

## Key Enums

| Enum | Count | File |
|------|-------|------|
| `Pkm` (Pokemon) | ~1000+ | `Pokemon.ts` |
| `Item` | 333+ | `Item.ts` |
| `Ability` | 200+ | `Ability.ts` |
| `Passive` | 190+ | `Passive.ts` |
| `Synergy` | 32 | `Synergy.ts` |
| `EffectEnum` | 173+ | `Effect.ts` |
| `Status` | 30 | `Status.ts` |
| `Weather` | 13 | `Weather.ts` |
| `Rarity` | 9 | `Game.ts` |
| `GamePhaseState` | 3 | `Game.ts` (PICK, FIGHT, TOWN) |

## Data Sizes (approximate)

| System | Key Files | Lines |
|--------|-----------|-------|
| Game Room | `game-room.ts` | 1,367 |
| Game Commands | `game-commands.ts` | 2,100+ |
| Board Manager | `board-manager.ts` | 1,563 |
| Game Scene | `game-scene.ts` | 850+ |
| Game Container | `game-container.ts` | 800+ |
| Game Page | `game.tsx` | 700+ |
| Prep Room | `preparation-room.ts` | 487 |
| Battle Manager | `battle-manager.ts` | 500+ |
| Minigame Mgr | `minigame-manager.ts` | 400+ |
