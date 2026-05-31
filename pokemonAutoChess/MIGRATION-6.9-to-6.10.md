# PAC 6.9 → 6.10 Migration (PokemonAutoSpire vendored fork)

> For AIs/devs working on PokemonAutoSpire (PAS). PAS vendors PokemonAutoChess (PAC)
> under `pokemonAutoChess/` and forks it for a single-player roguelike. This documents
> the upgrade of that vendored copy from PAC **6.9** (`01c2ebe70`) to **6.10**
> (`origin/prod` = 6.10.0 + post-tag hotfixes).

## How the merge was done

The vendored `pokemonAutoChess/` shares **no git history** with upstream (broken submodule,
tracked directly by the outer PAS repo). So a synthetic 3-way merge was used:

1. Clone of upstream lives in `pac-upstream/` (gitignored). Base = `01c2ebe70` (6.9), target = `origin/prod` (6.10).
2. A worktree was checked out at the 6.9 base, the Spire vendored files overlaid on top, and committed as a synthetic "Spire-on-6.9" base (so it has real shared ancestry with both sides).
3. `git merge origin/prod` → genuine 3-way merge. Merge worktree: `pac-spire-merge/` on branch `spire-merge`.

**Resolution policy:** keep Spire's intentional divergences (single-player: no leaderboards/
twitch/meta/accounts/bots/lobby); take upstream bugfixes; union imports where both sides use a symbol;
take upstream for build artifacts (dist/locales) and rebuild.

## The big architectural change: evolution refactor (#3938)

Upstream **deleted `app/core/evolution-rules.ts`** (453 lines of evolution *classes*) and replaced it
with a **data + handler** model:

- `app/types/EvolutionRules.ts` — evolution rules are now **plain data** (`EvolutionRuleType` enum +
  typed objects like `{ type: EvolutionRuleType.HATCH }`), no longer classes.
- `app/core/evolution-logic/*-handler.ts` — handler classes (`CountEvolutionHandler`,
  `HatchEvolutionHandler`, etc.) extending abstract `EvolutionHandler` with `canEvolve()`/`evolve()`/`getEvolution()`.
- `app/core/evolution-logic/evolution-manager.ts` — `EvolutionManager` dispatches by `evolutionRule.type`.
  Key entry points: `EvolutionManager.getEvolution(pokemon, player, ...)`, `EvolutionManager.updateHatch(pokemon, player)`,
  `EvolutionManager.tryEvolve(...)`.
- `app/core/evolution-logic/evolution-handler.ts` → `carryOverPermanentStats()` (stat carry-over on evolve).
- `app/core/evolution-logic/hatch-time.ts` → `getHatchTime(pokemon, player)` free function.

**API migration required across callers:**
- `pokemon.evolutionRule instanceof HatchEvolutionRule` + `pokemon.evolutionRule.updateHatch(p, player, stage)`
  → `pokemon.evolutionRule?.type === EvolutionRuleType.HATCH` + `EvolutionManager.updateHatch(pokemon, player)`
- `pokemon.evolutionRule.getEvolution(...)` → `EvolutionManager.getEvolution(...)`
- `egg.evolutionRule.getHatchTime(...)` → `getHatchTime(egg, player)` (free function)
- Per-pokemon `evolutionRule = new XxxRule(...)` → `evolutionRule = { type: EvolutionRuleType.XXX, ... } satisfies XxxEvolutionRule`

## Spire's evolution divergences and where they re-homed

PAC's evolution mechanics assume long, fixed-length multiplayer games; Spire's short, variable-order
roguelike runs break them. Spire's divergences (documented in POKEMON-CHANGELOG.md, 2026-05-31):

| # | Divergence | 6.9 location | 6.10 re-home |
|---|-----------|--------------|--------------|
| 1 | Cosmog-line **+30 HP/stack** (was +10) | `evolution-rules.ts` afterEvolve | `evolution-logic/evolution-manager.ts` `afterEvolve` (the COSMOG/COSMOEM block) — `addMaxHP(30)`. Companion: `pokemon.ts` Cosmoem `onAcquired` reverts `−90` (3×30). Cosmog `stacksRequired = 3` (was 8). |
| 2 | Count-evo **2★+ needs only `min(numberRequired,2)` copies** | `CountEvolutionRule` | `evolution-logic/count-evolution-handler.ts` — `canEvolve`, `canEvolveIfGettingOne`, `evolve` (the `required` const). ⚠️ Undocumented in changelogs; confirmed intentional & carried forward. |
| 3 | Tandemaus/Maushold **evolve N fights after acquisition** (was fixed stageLevel) | `TimerEvolutionRule extends HatchEvolutionRule` | Data field: added optional `hatchTime?: number` to `HatchEvolutionRule` type; `getHatchTime()` honors it; `pokemon.ts` Tandemaus/MausholdThree use `{ type: EvolutionRuleType.HATCH, hatchTime: 5 }`. The `TimerEvolutionRule` class is gone. |
| 4 | `statMapping` permanent-buff rewrite | `evolution-rules.ts` `carryOverPermanentStats` | **Dropped** — upstream independently did the equivalent refactor in `evolution-logic/evolution-handler.ts`. |

Other related decisions:
- `game-pokemon-portrait.tsx` — uses `EvolutionManager.getEvolution` but **keeps Spire's defensive
  try/catch** (snapshot/reconstructed pokemon from team-snapshot can carry malformed `evolutionRule`).
- Timburr/Gurdurr `afterEvolve(){ player.updatePillars() }` overrides were **removed** — now dead in 6.10
  (the instance `afterEvolve` method is no longer called by `EvolutionManager`); pillars update via
  `[Passive.PILLAR]`'s `OnEvolutionEffect`.
- `pokemon.ts` `onChangePosition` instance method was **removed** — superseded by upstream's exported
  `onPokemonChangePosition()` in `game-commands.ts`, which the passive system (OnChangePositionEffect) depends on.
  Spire's `changePokemonPosition` helper was dropped; its callers migrated to `onPokemonChangePosition`.
- `cookDishesForPveBoard()` (Spire PVE Gourmet feature) was **preserved** in `game-commands.ts`.

## Dojo item divergence (non-evolution, flagged)

Spire replaced upstream's `pokemonsTrainingInDojo` ("pokémon leaves board to train, returns after N
stages") with its own `dojoFamilies` instant-buff mechanic (in `effects/items.ts`, woven through
`player.ts`, `run-save.ts`, detail UI). The merge kept Spire's `items.ts`. **Watch out:** auto-merged
`player.ts` carries *both* `dojoFamilies` and upstream's `pokemonsTrainingInDojo` field — reconcile if
the training mechanic resurfaces.

## Type-check status: CLEAN (0 errors)

`npx tsc --noEmit` passes with **0 errors** on the merged tree (pristine upstream 6.10 is also 0; the
project expects tsc-clean even though the build itself uses esbuild). For reference, pre-merge Spire 6.9
had **39** pre-existing tsc errors — all of those were cleared as part of this work too.

The 65 errors present right after the raw merge fell into three buckets, all now resolved:

1. **Translations (was ~32, of which ~25 migration-introduced):** tier-A took upstream
   `dist/client/locales/*/translation.json`, dropping Spire's custom keys (e.g. `item.BABY_GEM`).
   **Fixed:** deep-merged Spire's locale files into the 6.10 ones (Spire keys win, all keys from both
   present) for `en/de/fr/it/ko/pt/zh`. Still rebuild the client with `npm run build` to regenerate types.
2. **Single-player UI (was ~21, pre-existing Spire debt):** dead multiplayer UI files reference
   `rooms.lobby/preparation/after`. **Fixed:** added those as always-`undefined` optional members on the
   `rooms` type in `network.ts` (runtime unchanged — they're never joined in single-player); added a
   `sendMaintenanceOrder` noop stub; fixed a stale 2-arg `joinGame()` call.
3. **Spire data / type gaps (pre-existing Spire debt):** `Pkm.LYCANROC` → `Pkm.LYCANROC_DAY`;
   `GoldenEggItems` `satisfies ShinyItem[]` → `satisfies Item[]` (REPEAT_BALL kept at runtime as Spire
   ships it); dropped the now-redundant `RED_SCALE` filter in `pve-stages.ts`; added `spireRegion?` to
   `IUserMetadata`; exported + cast `SavedRunData`; cast `Tools.includes` in `isItemSellable`; renamed a
   shadowing inner `const index` (`atlasIndex`) in the client sprite loader; `avatar ?? ""` in player-box;
   cast dynamic i18n template keys (`t(\`pkm.${x}\`)` etc.) with `as any` (keys exist at runtime).

After this: run `npm run build` (regenerates `dist/`, asset/translation versions) and add a changelog entry.

## Locations
- Merge worktree: `pac-spire-merge/` (branch `spire-merge`), based on `pac-upstream` (gitignored clone).
- After validation, the merged tree is copied back into the PAS `pokemonAutoChess/` vendored dir.
