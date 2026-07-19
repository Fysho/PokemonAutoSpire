# Balance Suggestions — Summary & Recommendations

Summarised from `BalanceSuggestions.txt` — reports from **BMAN** (plays Easy/Normal, where most players are), **Spencer** (gold tier), and **Talbot** (challenger tier).

> **Key framing from the reports:** Talbot (seconded by Spencer) argues the *systemic* problems should be fixed before individual Pokémon nerfs — otherwise you nerf units that are only broken because of stat-stacking. Talbot also suggests rolling changes out incrementally (one batch every week or two) and re-tuning based on reception.

---

## 1. Systemic Issues (fix these first)

### 1.1 Permanent stat stacking / Dojo Tickets — **highest priority, unanimous**
- **Talbot:** Stat buffing + burst is too strong; there is no defensive equivalent, so defence strategies are dead. Cap permanent stats (e.g. no AP > 300) **or** cap effects (e.g. 1 dojo ticket per Pokémon); also bound AP from Return to a couple hundred.
- **Spencer:** Dojo tickets should apply **once per run per Pokémon**. Unbounded stacking makes one-man teams dominant and defeats team-building.
- **BMAN:** (implicitly) notes Pokémon "get strong easily" on Easy/Normal.

**Recommendation:** Cap dojo tickets at **1 per Pokémon per run** (Spencer's version — simplest, most legible to players) and put a soft cap on other permanent-stat sources (e.g. Return AP). This alone will deflate several of the "OP Pokémon" complaints below, so ship it *before* the unit nerfs and re-evaluate.

### 1.2 Start-of-round micro ("optimising the fun out of the game") — **unanimous among Spencer/Talbot**
- **Talbot:** Move beginning-of-round effects (fire shard, water fishing, gourmet, wooloo, fighting) to **end of round**, like PAC, to kill the micro loop. Also flags end-of-round effects generally as too exploitable.
- **Spencer:** Gourmet micro is "toxic" — players who micro beat players who don't, which defeats the point of an auto-battler.

**Recommendation:** Do it. Move these triggers to end-of-round. Low design risk, removes a chore, and both experienced players independently called it out.

### 1.3 Save-scumming
- **Talbot:** Should be prevented.

**Recommendation:** Agree — for a roguelike, run integrity matters. Auto-save on every meaningful decision point (shop roll, pick, battle start) so reloading can't reroll outcomes.

### 1.4 Shields
- **BMAN:** "So many shields you can't break through them"; Light/Psychic/Fairy/Normal + Blissey is oppressive on Easy/Normal.
- **Spencer:** Shield is a broken stat because it **isn't capped by max HP**.

**Recommendation:** Cap total shield at some % of max HP (e.g. 100%). This addresses the root cause rather than nerfing every shield source separately.

### 1.5 Light synergy
- **BMAN:** Nerf Light overall — PP recovery too high, Attack/AP gain too easy; scary when combined with Psychic/Water/Normal/Fairy.

**Recommendation:** Reduce Light's PP-regen numbers a step. Combine with the Luxray PP nerf (below) and re-check before nerfing further — Light is only reported as a problem on Easy/Normal so far.

### 1.6 Psychic synergy
- **BMAN:** Nerf Psychic AP by ~25%.

**Recommendation:** Reasonable direction, but do it *after* the stat-stacking cap and shield cap land — those changes reduce AP snowballing already. Start at −15% if acting now.

### 1.7 Legendary / unique acquisition
- **Talbot:** Too luck-based; suggests earning **type shards/fragments** to buy or choose (or choice-of-three) a synergy-relevant legendary, analogous to PAC portals.
- **Spencer:** Agrees the current dojo-ticket "build one god" path should be replaced by bounded mechanics.

**Recommendation:** Adopt the shard idea — it also gives dojo-ticket-style progression a healthy replacement. Good candidate for a later batch since it's a feature, not a tweak.

### 1.8 Other economy / QA items (Talbot)
- **Eggs in shops:** almost never worth 12 gold in act 1, too slow to hatch/evolve in acts 2–3. → Reduce price or speed up hatching; otherwise cut from shops.
- **Suspected broken mechanics — verify:** Dunsparce evolution, Falinks troopers, Psychic Unown (may need a new mechanism), shop-roll modifiers (incense effect, Combee honey dish, Grass-9 reroll berry).
- **TM/tool choice:** free tool select/reroll after gym fights may be too deterministic, but human-synergy TMs should be reroll-able/choosable.
- **PAC leftovers:** Spencer says don't bother porting random PAC mechanics (e.g. Unown shop) — the base game is good, it needs tuning, not more systems.
- **End-of-run experience:** players are frustrated by auto-losing to the E4 without an optimised team — consider an intermediate PvP round (or a choice) before the E4.

---

## 2. Individual Pokémon Nerfs

| Pokémon | Spencer | Talbot | BMAN | Recommendation |
|---|---|---|---|---|
| **Kingambit** | +40 PP (60→100), remove ability crit, maybe small Atk nerf. Keep "slow one-shot threat" identity. | +20 PP as a start | "Most powerful unit in PAS, always in Archives" — nerf at minimum | **+20 PP and remove ability crit.** Unanimous top offender, so act now, but take Talbot's softer PP step; removing the crit multiplier trims the worst spikes without killing the identity. |
| **Gardevoir** | 5 targets no splash (recommended), or 3 targets + 20% splash to keep board-wipe identity | 5 targets, no splash (prevent full board wipe) | Too strong (listed) | **5 targets, no splash.** Two of three explicitly converge on this exact change. Hold the extra AP nerf Spencer floats until after stat-cap changes. |
| **Blissey** | AP scaling −50%, shields to 20/40/60 | AP scaling −50% only — "AP Blissey is the absurd one, avoid nerfing base Blissey" | Core of the oppressive shield comps on Easy/Normal | **AP scaling −50%; leave base shields alone** and let the global shield-cap (§1.4) handle the rest. Revisit shield values only if still oppressive after the cap. |
| **Skeledirge** | +30 PP (60→90), 5 flames no scaling, each flame 30% Atk, 30% burn, no ability increase | Cap flame damage at 70 — base is fine, stat-stacking is the issue | — | **Cap flame damage (~70).** Targets the actual failure mode (stacking) without gutting the base unit. Add Spencer's PP nerf only if the infinite-spam pattern survives the cap. |
| **Luxray** | +10 PP (70→80), Def/SpDef 14→9 | +10 PP (prevent rapid Light casts) | Light synergy enabler | **+10 PP** (both agree). Skip the defence nerf for now — one change at a time. |
| **Snorlax** | Either nerf HP gain (2/berry, 3/dish, 5/cook) or Body Slam to 80 + 15% max HP | HP scaling to 5/5/10 "as a start" | — | **Reduce HP gains (toward Talbot's 5/5/10).** Nerf the accumulation, not the ability — consistent with the stat-stacking theme. |
| **Rillaboom** | +20 PP (70→90) — "not sure how to balance him" | +10 PP (still casts too often) | — | **+10 PP.** Neither is confident; take the smaller step. |
| **Gengar, Porygon(?), others** | "Whole list of Pokémon way too strong" once stat-stacking is removed — any uncrossable wall needs a nerf | — | Also names Blissey, "Electribe", "Barnett"(?) | **Defer.** Re-run the meta after the systemic changes and this nerf batch, then evaluate the next tier. (BMAN's "Electribe"/"Barnett" names are likely translation artifacts — worth confirming which units he means.) |

---

## 3. Suggested Rollout Order

1. **Batch 1 — systemic:** dojo ticket cap (1/Pokémon/run), shield cap vs max HP, move start-of-round effects to end-of-round, prevent save-scumming.
2. **Batch 2 — top nerfs:** Kingambit, Gardevoir, Blissey, Skeledirge (as above).
3. **Batch 3 — second tier:** Luxray, Snorlax, Rillaboom; Light PP-regen and Psychic AP trims if still needed.
4. **Batch 4 — features:** legendary shard system, egg/shop economy pass, TM reroll, E4 pre-fight PvP round; fix/verify Dunsparce, Falinks, Unown, shop-roll modifiers along the way.

One batch every 1–2 weeks (per Talbot), re-tuning on reception. Update `SYNERGY/POKEMON/ABILITY-CHANGELOG.md` with each batch.

### Points of disagreement to keep in mind
- **Nerf severity:** Spencer's numbers are consistently heavier than Talbot's; Talbot repeatedly says "start slower." Recommendations above side with Talbot — nerfs are easy to deepen, hard to walk back.
- **Perspective split:** BMAN speaks for Easy/Normal (where shields/Light dominate), Talbot for challenger, Spencer for gold. Changes should be sanity-checked against Easy/Normal specifically, since that's where most players are.
