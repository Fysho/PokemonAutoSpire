# PokemonAutoSpire - Design Document

## Vision

PokemonAutoSpire is a single-player roguelike that combines Pokemon Auto Chess's battle mechanics (synergies, items, auto-battling Pokemon teams) with Slay the Spire's run structure (branching map, escalating difficulty, permadeath). The player builds a team of Pokemon across a multi-act run, navigating a branching map with fights, shops, events, and bosses.

---

## Run Structure

### Overview

```
ACT 1 (15 floors)          ACT 2 (15 floors)          ACT 3 (15 floors)
├─ Wild Battles             ├─ Harder Wild Battles      ├─ Hardest Wild Battles
├─ Gym Leader (elite)       ├─ Gym Leader (elite)       ├─ Gym Leader (elite)
├─ PokeMarts               ├─ PokeMarts                ├─ PokeMarts
├─ Pokemon Centers          ├─ Pokemon Centers          ├─ Pokemon Centers
├─ Mystery Encounters       ├─ Mystery Encounters       ├─ Mystery Encounters
└─ BOSS: Legendary          └─ BOSS: Legendary Duo      └─ FINAL BOSS: Legendary Trio
```

- **3 Acts**, each with ~15 floors of branching nodes
- Each act ends with a **Legendary Boss** encounter
- Difficulty scales across acts and within each act
- Gym Leaders appear as **elite encounters** throughout floors (like StS elites)
- Run ends on death (0 HP) or after defeating Act 3 boss

### Map Node Types

| Node | Icon | Description |
|------|------|-------------|
| **Wild Battle** | Crossed swords | Standard PvE fight against wild Pokemon teams |
| **Gym Leader** | Badge icon | Elite encounter - harder fight, better rewards |
| **PokeMart** | Shopping bag | Buy/sell Pokemon and items with gold |
| **Pokemon Center** | Heal cross | Heal HP, optionally upgrade/evolve a Pokemon |
| **Mystery Encounter** | Question mark | Random event with choices and consequences |
| **Legendary Boss** | Crown | Act-ending boss fight against legendary Pokemon |

### Map Generation

- Each floor has 2-4 branching paths
- Paths converge at certain points (like StS)
- Gym Leaders appear on ~2-3 nodes per act (not every path hits them)
- PokeMarts and Pokemon Centers appear at fixed intervals
- Boss node is always the final node of each act
- First node of Act 1 is always a Wild Battle (tutorial-ish)

---

## Game Flow

### Phase Cycle (Per Node)

```
MAP SCREEN ──► [Node Type] ──► REWARDS ──► MAP SCREEN
                  │
                  ├─ Wild Battle ──► PICK (arrange board) ──► FIGHT ──► Rewards
                  ├─ Gym Leader ──► PICK ──► FIGHT ──► Rewards (better)
                  ├─ Legendary Boss ──► PICK ──► FIGHT ──► Act Complete
                  ├─ PokeMart ──► Shop UI ──► Back to Map
                  ├─ Pokemon Center ──► Heal/Upgrade UI ──► Back to Map
                  └─ Mystery Encounter ──► Choice UI ──► Outcome ──► Back to Map
```

### Game States

| State | Replaces | Description |
|-------|----------|-------------|
| **MAP** | New state | Branching path selection (Slay the Spire map) |
| **PICK** | Original PICK | Board arrangement before fights (place/move Pokemon, equip items) |
| **FIGHT** | Original FIGHT | Auto-battle simulation (reuse existing battle engine) |
| **SHOP** | New state | PokeMart interface (buy/sell/reroll) |
| **REST** | New state | Pokemon Center (heal HP, upgrade Pokemon) |
| **EVENT** | New state | Mystery encounter with choices |
| **REWARD** | New state | Post-fight rewards (choose Pokemon, get gold/items) |

The original **TOWN** phase (walking around collecting items) is removed. Its functions are distributed:
- Item collection → post-fight rewards
- NPC interaction → Mystery Encounters
- Portal/synergy choices → reward screens and events

---

## Core Mechanics

### Player Stats

| Stat | Start | Details |
|------|-------|---------|
| **HP** | 100 | Lose HP when fights are lost. Amount = remaining enemy Pokemon damage. Die at 0. |
| **Gold** | 0 | Earned from battles. Spent at PokeMarts and on level-ups. |
| **Level** | 1-10 | Determines max team size on board. Spend gold to gain XP. |
| **Team Size** | Scales with level | Level 1 = 1 Pokemon on board, up to 6-8 at max level |
| **Bench** | 8 slots | Pokemon storage between fights |
| **Items** | Inventory | Held items (on Pokemon) + passive relics (run-wide) |

### Getting Pokemon

Pokemon are NOT freely available from a shop each round. Instead:

1. **Post-Fight Rewards**: After winning a Wild Battle or Gym Leader fight, choose 1 of 3 offered Pokemon (similar to "additional picks" in PAC). Rarity scales with act/floor.
2. **PokeMart Nodes**: Full shop experience - spend gold to buy Pokemon from a random selection. Can sell Pokemon. Can reroll.
3. **Mystery Encounters**: Some events offer Pokemon as rewards or let you catch wild Pokemon.
4. **Starter**: Pick 1 starter Pokemon at run start, plus 2-3 random commons.

### Evolution

Keep the original auto chess evolution system:
- Collect 3 copies of the same Pokemon → auto-evolve to next star level
- Item-based evolutions (e.g., Fire Stone + Eevee → Flareon)
- Pokemon offered in rewards/shops can complete your evolutions

### Economy

| Source | Gold |
|--------|------|
| Win a Wild Battle | 3-5 gold (scales with floor) |
| Win a Gym Leader | 8-12 gold |
| Win a Legendary Boss | 15-20 gold |
| Lose a battle | 1-2 gold (consolation) |
| Sell a Pokemon | Based on rarity/stars (keep original pricing) |
| Mystery Encounters | Variable |

| Cost | Gold |
|------|------|
| Level up (buy XP) | 4 gold per 4 XP (keep original) |
| Shop reroll | 1 gold |
| Pokemon purchase | 1-5 gold based on rarity |

No interest system. No streak bonuses. Gold is finite and precious.

### Leveling

Keep the original level-up system:
- Spend gold to buy XP at any time (during PICK phase or at shop)
- Level determines how many Pokemon you can field
- Higher level = higher rarity Pokemon appear in shops and rewards
- Available between fights, not just at specific nodes

### Health & Damage

StS-style HP system:
- Start with 100 HP
- **Lose a fight**: Take damage = sum of remaining enemy Pokemon damage values
- **Win a fight**: No HP lost
- **Pokemon Center**: Heal 30-50% of max HP (free, costs the map node choice)
- **Some items/relics**: Provide passive healing or damage reduction
- **Die at 0 HP**: Run over, return to main menu

---

## Items & Relics

### Repurposing the Item System

The existing 333+ item system splits into two categories:

#### Held Items (On Pokemon)
Items that attach to individual Pokemon (up to 3 per Pokemon, same as original):
- Equipment: Scope Lens, Shell Bell, Heavy Duty Boots, etc.
- Berries: Consumed during battle for effects
- Craftable combinations: Keep the 60+ recipes

#### Passive Relics (Run-Wide)
A subset of items repurposed as run-long passive bonuses:
- Earned from Gym Leaders, Legendary Bosses, and some Mystery Encounters
- Affect your entire team for the rest of the run
- Examples:
  - **Metronome**: "Your Pokemon gain +5% AP per ability cast in each battle"
  - **Lucky Egg**: "Earn 2 extra gold from battles"
  - **Exp Share**: "Pokemon on your bench gain XP passively"
  - **Amulet Coin**: "Shop rerolls cost 0 gold"

The distinction: held items go on specific Pokemon, passive relics go in a "relic bar" and affect the whole run.

### Item Acquisition
- **Post-fight rewards**: Choose an item alongside Pokemon offers
- **Gym Leaders**: Drop a guaranteed held item + chance of a relic
- **Legendary Bosses**: Drop a guaranteed relic
- **PokeMart**: Items available for purchase
- **Mystery Encounters**: Random item rewards
- **Crafting**: Combine items during PICK phase (keep original system)

---

## PvE Encounter Design

### Wild Battles (Normal Fights)

Pre-designed encounters with procedural scaling:

```
Design Template: "Rock Cave"
- Act 1, Floor 3: 3x Geodude (1-star)
- Act 1, Floor 10: 4x Geodude (2-star) + 1x Graveler
- Act 2, Floor 5: 6x Geodude (2-star) + 2x Golem
- Act 3: replaced by stronger rock-themed encounters
```

Each encounter has:
- A **theme** (synergy-based: Rock team, Water team, Mixed, etc.)
- A **base composition** that scales with floor/act
- **Procedural variance**: +-1 Pokemon, random item assignments, star level variance
- Difficulty curve: Act 1 = 1-3 star commons, Act 3 = 2-3 star epics/ultras

### Gym Leaders (Elite Encounters)

Hand-crafted boss-like fights with specific teams:
- Gym Leader teams have strong synergies and held items
- Example: Brock (Rock/Ground synergy, Onix + Geodude + Golem, all with defensive items)
- Harder than regular fights but reward better loot
- ~2-3 per act, appear on specific map branches

### Legendary Bosses (Act Bosses)

Fully hand-crafted, high-difficulty encounters:
- Single legendary or legendary pair/trio
- Unique mechanics (e.g., Mewtwo has massive AP, Rayquaza changes weather)
- Fixed teams with specific items
- Examples:
  - Act 1 Boss: Mewtwo (solo, high stats)
  - Act 2 Boss: Lugia + Ho-Oh (legendary duo)
  - Act 3 Boss: Weather Trio (Groudon + Kyogre + Rayquaza)

---

## Mystery Encounters

Random events with narrative choices. Examples:

**"Abandoned Daycare"**
- Choice A: Adopt an Egg (get a random egg Pokemon, hatch after 3 fights)
- Choice B: Search the grounds (get 2 random items)
- Choice C: Leave (nothing happens)

**"Team Rocket Grunt"**
- Fight a Team Rocket battle (medium difficulty)
- Win: Get a Shadow Pokemon (boosted stats, random from pool)
- Lose: Lose 5 gold

**"Mysterious Trader"**
- Trade one of your Pokemon for a random Pokemon of higher rarity
- Or: Trade 10 gold for a relic

**"Ancient Shrine"**
- Sacrifice 20 HP to get a powerful relic
- Or: Offer a Pokemon to receive 3 Pokemon of lower rarity
- Or: Pray (small chance of legendary encounter, usually nothing)

---

## Starting a Run

1. **Title Screen** → "New Run"
2. **Choose Starter Pokemon**: Pick 1 from a selection (e.g., the 23 existing starters like Bulbasaur, Charmander, Squirtle, Pikachu, etc.)
3. **Receive Starting Team**: Starter + 2 random common Pokemon
4. **Starting Gold**: 5 gold
5. **Starting HP**: 100
6. **Starting Level**: 1 (can field 1 Pokemon)
7. **View Act 1 Map** → Begin run

---

## Server Architecture (TBD)

The original game uses Colyseus (WebSocket server) for multiplayer state sync. For single-player, two approaches are being considered:

### Option A: Embedded Local Server
- Keep Colyseus, run server in-process (localhost)
- Minimal refactoring of existing game logic
- Package as Electron app or similar
- Pro: Battle simulation, shop logic, etc. all stay on server as-is
- Con: Heavier runtime, unnecessary networking layer

### Option B: Client-Only
- Move all game logic to the client
- Remove Colyseus dependency
- Game state managed entirely in Redux + Phaser
- Pro: Lighter, deployable as static web app
- Con: Significant refactoring of server-side game logic

Decision deferred until implementation planning phase.

---

## What Changes vs. Original

### Removed
- Multiplayer matchmaking and lobbies
- PvP battles (all fights are PvE)
- TOWN phase (walking around map)
- Spectator mode
- ELO/ranking system
- Chat system
- Round-based auto-shop (shop only at PokeMart nodes)
- Interest/streak gold economy
- Player damage based on units left (replaced by fixed damage values)

### Kept (Reused As-Is)
- Battle simulation engine (`simulation.ts`)
- Pokemon stats, abilities, passives
- Synergy system (all 32 synergies)
- Item system (333+ items, crafting recipes)
- Evolution system
- Board grid (8x8, drag-drop placement)
- PICK phase (board arrangement)
- FIGHT phase (auto-battle display)
- Pokemon sprites and animations
- Level-up system (gold → XP → team size)
- Rarity system

### Added
- MAP phase (Slay the Spire branching map)
- PvE encounter system (pre-designed + scaled)
- Gym Leader encounters
- Legendary Boss encounters
- Mystery Encounter events
- Pokemon Center (heal node)
- PokeMart (shop node)
- Passive relic system (repurposed items)
- Post-fight reward screen (pick 1 of 3 Pokemon)
- Run-based HP system (100 HP, permadeath)
- Starter Pokemon selection
- Act progression (3 acts)
- Run start/end flow

### Modified
- Shop: only available at PokeMart nodes, not every round
- Gold: earned from battles only, no interest
- Pokemon acquisition: post-fight picks + shop nodes, not round-based shop
- Game phases: MAP → PICK → FIGHT → REWARD → MAP (was TOWN → PICK → FIGHT)
- Health: StS-style HP pool instead of auto chess life system

---

## Open Questions

1. **Meta-progression**: What unlocks between runs? (deferred)
2. **Difficulty modes**: Easy/Normal/Hard? Ascension system like StS?
3. **Act theming**: Should acts have biome themes affecting encounters? (e.g., Act 1 = Forest, Act 2 = Mountain, Act 3 = Ocean)
4. **Weather on map**: Should weather persist across fights within an act?
5. **Synergy bonuses on map**: Any map-level bonuses for team synergies?
6. **Pokemon Center upgrades**: Just heal, or also remove/transform Pokemon?
7. **Run seeding**: Seeded runs for competitive/shareable experiences?
8. **Encounter pool per act**: Which Pokemon appear in which acts?
9. **Server architecture**: Embedded server vs. client-only (see above)
10. **Save system**: Save and resume runs, or must complete in one session?
