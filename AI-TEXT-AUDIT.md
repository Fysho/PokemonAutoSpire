# Player-Facing Text — AI-Tell Audit

Review of displayed text for AI-generated-looking patterns (`—` em-dash, `;` semicolons, templated phrasing, triadic/marketing tone). **Nothing was changed** — this is a report only.

## Summary

| Tell | Verdict |
|---|---|
| Em-dash (`—`) | Pervasive — main offender. Used as prose punctuation **and** as a label/description separator. |
| Semicolons (`;`) | **Clean.** None found in any narrative/flavor strings. |
| Templated phrasing | Present in ticket descriptions and the Diversions panel. |
| Triadic / marketing tone | Borderline in the 6 class descriptions. |

Note: the vast majority of `—` in the codebase are in **code comments**, not displayed text — those are excluded below.

---

## 1. PAC Diversions panel — biggest concentration
`app/public/src/pages/spire-lobby.tsx` (~35 instances, lines **1399–1556**)

Every balance line uses the identical `<strong>Label</strong> — description` em-dash separator. Examples:

- L1399 `Evolution — Pokemon need 6 copies to reach 3★ instead of 9.`
- L1403 `Hatch Mons — Take 5 stages to hatch and 8 stages to evolve.`
- L1411 `Punching Glove — On-hit bonus damage capped at 200.`
- L1415 `Gold Bottle Cap — Crit power bonus now caps at 200 gold.`
- L1419 `Tea — PP reduced from 80 to 40.`
- L1423 `Smoked Filet — ATK reduced from 5 to 3, AP reduced from 10 to 5.`
- L1427 `Rainbow Swirl — Decorate PP buff reduced from 60 to 50.`
- L1431 `Dojo Tickets — Apply stat boosts instantly instead of after 3 fights. Only one per Pokemon per act.`
- L1435 `Repeat Ball — Removed from the game.`
- L1439 `Red Scale — Removed from the game.`
- L1443 `Legend Plate — A new Arceus-only item: its items and stat boosts can't be stolen or knocked off (Thief, Knock Off, Spectral Thief, etc.), and any single instance of damage it takes is capped at 1000.`
- L1447 `Berries — All berries are now removable: benching a Pokemon returns its berries to your inventory.`
- L1451 `Mushrooms — Tiny/Big/Balm Mushrooms are automatically sold for gold (1/2/5g) when you reach a PokeMart or Pokemon Center.`
- L1459 `Snorlax — Glutton passive HP gains from berries and Gourmet effects halved.`
- L1463 `Misdreavus / Mismagius — Night Shade damage capped at 500.`
- L1467 `Alcremie (Rainbow Swirl) — Decorate PP buff reduced from 60 to 50.`
- L1480 `PP Batteries — The PP these Pokemon grant to allies no longer scales with AP.`
- L1484 `Grookey / Thwackey / Rillaboom — Max PP increased from 60 to 70, so the Drummer line takes longer to cast its own ability while it feeds PP to adjacent allies.`
- L1488 `Skeledirge (Torch Song) — Flame count capped at 20 (prevents a runaway AP feedback loop). The per-flame AP buff is otherwise unchanged from upstream.`
- L1492 `Rotom Drone (Plasma Flash) — Flash count capped at 20, so it no longer ramps without limit over a long fight (fixes a runaway command-queue buildup).`
- L1500 `Execute Abilities — Horn Drill, Sheer Cold, and Crabhammer deal 9999 damage on execute.`
- L1507 `Cosmog / Cosmoem — Evolve after 3 evolutions instead of 8, and gain 30 permanent max HP per evolution instead of 10.`
- L1511 `Tandemaus / Maushold — Each stage now evolves 5 fights after it is acquired, instead of on fixed turns 15 and 20.`
- L1515 `Charcadet — Receives its Auspicious / Malicious Armor for defeating any act-end boss, instead of a fixed PvE stage.`
- L1519 `Zacian — Receives its Rusted Sword for defeating any act-end boss, instead of a fixed PvE stage.`
- L1523 `Bidoof / Bibarel — Super Fang damage capped at 500.`
- L1531 `Light — Triggers raised from 2/3/4/5 to 3/4/5/6.`
- L1535 `Flora — Triggers lowered from 3/4/5/6 to 2/3/4/5.`
- L1539 `Fighting — Damage blocked raised from 3/6/9/12 to 4/8/12/16.`
- L1543 `Grass — Healing per 2s raised from 5/15/25 to 5/20/35.`
- L1547 `Fishing Rods — You catch mons when traveling to a wild battle.`
- L1556 `Gyms — Amorphous, Light, Gourmet, and Artificial gyms are not available.`

> Internally consistent (arguably deliberate), but the uniform em-dash-as-separator across ~35 rows is the most "AI-formatted"-looking surface in the game. A colon (`:`) would read more human.

---

## 2. Item ticket descriptions — templated + em-dash
`app/public/dist/client/locales/en/translation.json` (lines **3191–3193**)

All three share a `Spire only. … — … Consumed on use.` template with a mid-clause em-dash:

- L3191 `CLASS_REROLL_TICKET` — `"Spire only. Reroll the wild Pokémon reward — same rarity, but sharing your class's synergies (ignores the region). Consumed on use."`
- L3192 `UPGRADE_TICKET` — `"Spire only. Reroll the wild Pokémon reward — each one rarity higher, keeping the region synergy. Consumed on use."`
- L3193 `ITEM_REROLL_TICKET` — `"Spire only. Reroll the wild reward into item components — every option becomes a random component. Consumed on use."`

---

## 3. Other player-facing em-dashes

- `app/public/dist/client/locales/en/translation.json:4337` — `"No options — defaults to auto-generated."`
- `app/public/src/pages/auth.tsx:60` — `"A mod of Pokemon Auto Chess — all credit to the original developers"`
- `app/core/spire-classes.ts:115` (Behemoth) — `"…crushing in return — a wall that hits back."`
- `app/models/spire-events.ts:91` (Elemental Trial) — `"Channel the power of the orbs — but first, you must overcome it."`

---

## 4. Admin-facing em-dashes (lower priority — normal players don't see these)
`app/public/src/pages/component/bot-builder/elite-library.tsx`

- L42 `"A measurement is already running — try again in a moment."`
- L43 `"Design not found — it may have been deleted."`
- L46 `"Measurement failed — check the server logs."`
- L309 `No designs saved yet — build one in the Designer tab and click "Save…"`
- L353 tooltip `"Approved — can appear as an elite fight in Spire runs"`
- L433 tooltip `"Move down one stage range (clears success rates — re-measure after)"`
- L444 tooltip `"Move up one stage range (clears success rates — re-measure after)"`

(L82 uses `"—"` purely as a "no data" placeholder — fine.)

---

## 5. Borderline by *tone*, not punctuation — class descriptions
`app/core/spire-classes.ts`

Polished sentence-fragment openers + triadic lists read slightly AI-flavored (also normal game flavor text — subjective):

- L39 Ironclad — `"Raw strength and ferocity. Overwhelm the enemy with relentless physical force before they can react."`
- L54 Silent — `"Toxins, swarms, and evasion. Whittle foes down with poison and numbers while slipping out of danger."`
- L69 Defect — `"Channels focus and raw energy. Scales hard on spell power, light, and chained electric attacks."`
- L84 Watcher — `"Walks the line between light and shadow. Alternates holy radiance and cursed power for devastating bursts."`
- L99 Drifter — `"A nomad of tide and storm. Slippery and weather-driven, controlling the battlefield from afar."`
- L114 Behemoth — `"An immovable colossus of stone and steel. Slow to fall and crushing in return — a wall that hits back."`

---

## Clean / no concerns

- **Tutorial** (`translation.json` `tutorial.*`) — natural, conversational; no em-dashes or semicolons. Reads human.
- **Mystery events** (`spire-events.ts`) — NPC dialogue uses `"…"` quotes and `...` ellipses; no AI tells except the one Elemental Trial em-dash (§3).
- **Dev Notes** (`spire-lobby.tsx:1379–1385`) — short casual bullets, clearly human.
- **Relic descriptions** (`relics.ts`) — purely mechanical, fine.
- **Semicolons** — none in any narrative string.
