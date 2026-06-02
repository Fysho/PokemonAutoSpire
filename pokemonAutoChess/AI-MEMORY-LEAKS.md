# PokemonAutoSpire — Server Stability Incidents (Leaks, OOM & Runaway Loops)

A running log of memory-leak / out-of-memory (OOM) and runaway-loop bugs found in the Spire
server, the mechanism behind each, the fix, and a playbook for diagnosing the next one. The
production server is a single long-lived Node process behind PM2 (see `CLAUDE.md` →
*Production Deployment*), so **anything that retains per-run state across room disposal
accumulates until V8 aborts**, and **anything that runs unbounded work on the per-tick update
loop can starve the single event loop for every other player**. There is no request lifecycle
to bail you out.

> **Golden rule:** every `this.presence.subscribe(topic, handler)` in a room's `onCreate()`
> MUST have a matching `this.presence.unsubscribe(topic, handler)` in that room's
> `onDispose()`, passing the **exact same handler reference**. Anything else leaks.

---

## Why presence subscriptions leak the entire room

Colyseus rooms share a **single `Presence` instance** (here `LocalPresence`, an in-memory
`EventEmitter`) across *every* room on the server. When a room calls:

```ts
this.presence.subscribe("server-announcement", handler)
```

it adds `handler` as a listener on that shared emitter. The emitter keeps the listener
alive for the lifetime of the **process**, not the room. If `handler` is a closure that
references `this` (the room) — or a bound method of the room — then the emitter transitively
retains the whole room: its `GameState`, the 8×8 board, every `Simulation`, snapshots, etc.

Rooms are created and disposed once per run. Over hours of traffic, thousands of disposed
rooms stay pinned. RSS climbs until:

```
FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory
```

and PM2 restarts the process. The tell-tale early symptom in the logs:

```
MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 server-announcement listeners added to [EventEmitter]. MaxListeners is 10.
```

The listener count climbing past 10 **is** the leak in progress — one stuck listener per
room ever created.

### Two unsubscribe gotchas

1. **Pass the exact handler reference.** `unsubscribe(topic)` *without* a callback removes
   **all** listeners on that topic — and because the emitter is shared across all rooms,
   that would tear out every *other* live room's listener too. Always pass the specific
   handler. The codebase pattern is to bind once and store the bound reference:
   ```ts
   // onCreate()
   this.onServerAnnouncement = this.onServerAnnouncement.bind(this)
   this.presence.subscribe("server-announcement", this.onServerAnnouncement)
   // onDispose()
   this.presence.unsubscribe("server-announcement", this.onServerAnnouncement)
   ```
   Reassigning `this.onServerAnnouncement` to its bound form means subscribe and unsubscribe
   reference the identical function object — required for the emitter to actually remove it.

2. **Anonymous closures can't be unsubscribed.** A subscription written as
   `subscribe("x", (msg) => {...})` has no stored reference, so it can never be removed.
   Always use a named/bound method.

The upstream PAC `game-room.ts` already demonstrates the correct pattern for the
`"room-deleted"` topic (subscribe in `onCreate`, unsubscribe in `onDispose`); the leaks
below were places where that discipline was missing.

---

## Incident 1 — `server-announcement` listener leak in GameRoom (CRITICAL, fixed v1.7.2)

**Severity:** Critical. This was the actual cause of repeated production OOM crashes
(~5 GB RSS, multiple PM2 restarts over a single evening).

**File:** `app/rooms/game-room.ts`

**Root cause.** The Spire-added server-announcement feature subscribed in `onCreate()` using
an **anonymous closure** that captured `this`, and `onDispose()` never unsubscribed:

```ts
// BEFORE (leaking)
this.presence.subscribe("server-announcement", (message: string) => {
  this.broadcast(Transfer.SERVER_ANNOUNCEMENT, message)
})
```

Every `GameRoom` ever created left a closure on the shared presence emitter, retaining the
full room (state, board, simulations) forever. Because `GameRoom` is the heavyweight room
(it holds the entire run), this dominated heap growth.

**Fix.** Convert to a bound method and unsubscribe on dispose:

```ts
// onCreate()  — game-room.ts:983
this.onServerAnnouncement = this.onServerAnnouncement.bind(this)
this.presence.subscribe("server-announcement", this.onServerAnnouncement)

// method      — game-room.ts:987
onServerAnnouncement(message: string) {
  this.broadcast(Transfer.SERVER_ANNOUNCEMENT, message)
}

// onDispose() — game-room.ts:1262
this.presence.unsubscribe("server-announcement", this.onServerAnnouncement)
```

---

## Incident 2 — preparation-room presence leaks (LATENT / unreachable, fixed v1.7.2)

**Severity:** Latent. Currently **unreachable in Spire** — `PreparationRoom` is dead code
here. Only `game: defineRoom(GameRoom)` is registered in `app/app.config.ts` (line ~248);
`PreparationRoom` is never imported or `defineRoom`'d. Spire goes lobby → game room directly
(`client.create("game", …)`). It is also a much lighter room than `GameRoom` even if it ran.

**File:** `app/rooms/preparation-room.ts`

**Root cause.** `onCreate()` subscribes to **three** presence topics — `server-announcement`,
`game-started`, `room-deleted` — each via a properly bound method, but the original
`onDispose()` only logged and called `this.dispatcher.stop()`, never unsubscribing. (This is
an upstream PAC bug the fork inherited; upstream's prep-room `onDispose` doesn't unsubscribe
either.)

**Fix.** Unsubscribe all three with their stored references (`onDispose`, prep-room.ts:455–457):

```ts
this.presence.unsubscribe("server-announcement", this.onServerAnnouncement)
this.presence.unsubscribe("game-started", this.onGameStart)
this.presence.unsubscribe("room-deleted", this.onRoomDeleted)
```

Patched proactively for correctness and to future-proof it if prep-rooms are ever
re-enabled. If you re-register `PreparationRoom`, this fix is required, not optional.

---

## Incident 3 — Skeledirge `TORCH_SONG` runaway commands (CRITICAL, fixed earlier)

Documented here for completeness; details live in `CLAUDE.md` → *Balance Changes* →
*Pokemon* → Skeledirge.

**File:** `app/core/abilities/abilities.ts` (`TorchSongStrategy`).

**Root cause.** A feedback loop — AP-scaled flame count combined with per-flame AP gain —
flooded `pokemon.commands` with unbounded `DelayedCommand`s during a single fight, leaking
memory mid-simulation and OOM-crashing the server. The code was byte-identical to upstream;
Spire's longer/harder fights pushed it past the tipping point.

**Fix.** Flame count capped at 20; AP buff applied once per cast instead of per flame.

**Lesson.** Not all OOMs are cross-room retention. Per-fight unbounded growth (command
queues, arrays, maps that scale with AP/stacks/turns) can blow the heap inside one
simulation. When triaging, distinguish *slow climb over hours* (retention/listener leak)
from *fast spike in one fight* (runaway in-simulation allocation).

---

## Incident 4 — idle-disconnect runaway loop blocks new runs (CRITICAL, fixed v1.7.2)

**Severity:** Critical. Not a memory leak — an **event-loop starvation** runaway. Symptom:
players suddenly **could not start a new run**, coinciding with a flood of identical logs:

```
Disconnecting idle player <uid> from game <roomId> after 900s inactive | act: 3 floor: 13
   (repeated dozens of times for the same player/room)
```

**Files:** `app/rooms/game-room.ts` (`disconnectIdlePlayers`), `app/rooms/commands/game-commands.ts` (`OnUpdateCommand`).

**Root cause.** The anti-AFK idle disconnect (`IDLE_DISCONNECT_MS = 900s`) had **no guard
against re-firing**. `OnUpdateCommand.execute()` runs every game tick; once
`idleTimeMs >= IDLE_DISCONNECT_MS` it called `disconnectIdlePlayers()` and `return`ed, but:

- nothing reset `idleTimeMs` or marked the disconnect as done, and the phase doesn't change,
  so the next tick re-crossed the threshold and fired again — **every tick, indefinitely**;
- the stale/AFK client didn't leave instantly (so it kept matching and re-logging);
- worst of all, `disconnectIdlePlayers()` calls `saveRun(p.id, …)` **fire-and-forget (no
  await)** for every human still in `state.players` (and `onLeave` never removes them). Each
  call runs `snapshotPlayerTeam()` synchronously (CPU on the event loop) and launches an
  unbounded in-flight MongoDB upsert — dozens of times per second.

The single-threaded event loop got buried under per-tick team serialization + overlapping DB
writes, so the matchmaker couldn't service `client.create("game")` and new runs stalled.

**Fix.** Fire the idle path **at most once per idle window**, reset on phase advance:

```ts
// game-room.ts:110 — new guard field
idleDisconnected: boolean = false

// game-room.ts:1214 — make disconnect idempotent
disconnectIdlePlayers() {
  if (this.idleDisconnected) return
  this.idleDisconnected = true
  ...
}

// game-commands.ts — reset on phase change, skip once fired
if (this.room.idlePhase !== this.state.phase) {
  this.room.idlePhase = this.state.phase
  this.room.idleTimeMs = 0
  this.room.idleDisconnected = false       // a still-connected player can idle again later
}
if (this.state.phase !== GamePhaseState.FIGHT && !this.room.idleDisconnected) {
  this.room.idleTimeMs += realDeltaTime
  if (this.room.idleTimeMs >= IDLE_DISCONNECT_MS) {
    this.room.disconnectIdlePlayers()
    return
  }
}
```

**Lessons.**
- Any per-tick action that depends on a threshold needs a latch: reset the accumulator or set
  a "done" flag, or it re-fires every frame.
- **Never call an unbounded `async` (especially a DB write) fire-and-forget from the tick
  loop.** One stuck room ticking at frame rate can starve the whole single-process server —
  the blast radius is global, not just that room.
- A symptom that looks like "the whole server is down for everyone" can originate in a
  *single* room's update loop. Grep the spamming log line to the room/command that emits it.

---

## Incident 5 — Rotom Drone `PLASMA_FLASH` runaway commands (CRITICAL, fixed v1.8.1)

Same failure mode as Incident 3 (Skeledirge), different ability. Details in
`ABILITY-CHANGELOG.md` → *Plasma Flash flash-count cap*.

**File:** `app/core/abilities/abilities.ts` (`PlasmaFlashStrategy`).

**Root cause.** Flash count = `4 + pokemon.count.ult`, uncapped. `count.ult` increments every
cast, so over a long fight it climbs without bound and each cast queues `4 + count.ult`
`DelayedCommand`s staggered over `100ms * i`. The queue filled faster than it drained, flooding
`pokemon.commands` (production logs: ROTOM_DRONE with 200–260+ "pending commands" warnings).
Byte-identical to upstream PAC; exposed by Spire's longer fights letting `count.ult` ramp high.

**Fix.** Flash count capped at 20 — `Math.min(20, 4 + pokemon.count.ult)`.

**Lesson.** The "pending commands" warning naming the same Pokemon repeatedly is the
fingerprint of this class of bug. Any per-cast count that scales with a monotonically growing
quantity (`count.ult`, AP, stacks) and pushes one `DelayedCommand` per unit **must** be capped.
When this warning appears, grep the named Pokemon's ability strategy for an uncapped loop that
pushes to `pokemon.commands`.

---

## Safety net — PM2 `max_memory_restart`

`ecosystem.config.js` sets `max_memory_restart: "1500M"`. PM2 recycles a process before a
leak can bloat it to multi-GB and trigger a V8 OOM abort.

**This is a safety net, not a fix.** It masks leaks (the user sees a brief restart instead of
a crash) but the underlying retention must still be fixed at the source. Tuning notes:

- The limit is **per process**. `instances: os.cpus().length` runs one process per core, so
  ensure `(instances × limit)` stays comfortably under the droplet's total RAM.
- With the leaks above fixed, steady-state RSS should be modest and this ceiling should
  essentially never be hit. If it *is* hit in normal operation, treat it as a signal that a
  new leak exists — investigate, don't just raise the number.

> **Production note (from the incident logs):** the crashing process was started ad-hoc
> (single fork named `pokemon-auto-spire`, untimestamped logs) rather than from this
> `ecosystem.config.js` (named `colyseus`, `time: true`). Start from the ecosystem file
> (or pass `--time`) so future incidents have timestamps, and so the `max_memory_restart`
> guard actually applies.

---

## Diagnosis playbook for the next OOM

1. **Confirm it's a Node heap OOM, not an OS kill.** Look for `FATAL ERROR: ... heap out of
   memory` in `pokemon-auto-spire-error.log` / `pm2 logs`. Rule out OS-level kills:
   `journalctl -k | grep -i oom`, `systemd-oomd` actions, and check swap/RAM (`free -m`).
2. **Scan for `MaxListenersExceededWarning`.** A listener count that climbs over time names
   the leaking topic directly — grep the topic string to find the `subscribe` site.
3. **Audit every `presence.subscribe`.** For each room, confirm a matching
   `presence.unsubscribe(sameTopic, sameHandlerRef)` exists in `onDispose()`. Anonymous
   closures and missing unsubscribes are the usual culprits.
   ```bash
   grep -rn "presence.subscribe\|presence.unsubscribe" --include="*.ts" app/rooms/
   ```
4. **Check `onDispose()` actually runs and cleans up.** It should clear timers/intervals,
   stop the dispatcher, drop large fields, and unsubscribe presence. Compare against
   `pac-upstream/` for the intended cleanup shape.
5. **Distinguish slow vs fast.** Slow climb over hours → cross-room retention (listeners,
   caches, static maps keyed by run). Fast spike in one fight → runaway in-simulation
   allocation (command queues, AP/stack-scaled loops — see Incident 3).
5b. **Server "down for everyone" with a spamming log line → suspect a per-tick runaway, not
   only memory.** A flood of one identical message means a room's update loop is re-firing
   something every tick (missing latch/threshold reset) and starving the event loop —
   matchmaking and new-run creation stall even though RAM looks fine. Grep the spamming line
   to its room/command (see Incident 4). Check for un-awaited `async`/DB calls in the loop.
6. **Reproduce locally with a heap snapshot.** Start with `node --inspect`, take heap
   snapshots over time in Chrome DevTools, and look for retained `GameRoom` / `GameState`
   instances whose retainer path leads back to an `EventEmitter` — that's a listener leak.
7. **Capture before/after.** Note RSS trend and listener counts pre/post fix so the next
   investigator can tell whether a regression returned.

---

## Checklist when adding any new room subscription / long-lived listener

- [ ] Subscribe with a **bound method**, never an anonymous closure.
- [ ] Store the bound reference (`this.fn = this.fn.bind(this)`) so subscribe and unsubscribe
      use the identical function object.
- [ ] Add the matching `unsubscribe(topic, this.fn)` in `onDispose()`.
- [ ] If you add a timer/interval, clear it in `onDispose()` too.
- [ ] If you add a module-level cache/map keyed by run or room, ensure entries are deleted
      on dispose (or use a bounded/TTL structure) — these leak the same way.
</content>
</invoke>
