import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Role } from "../../../../../types"
import { type Pkm, PkmIndex } from "../../../../../types/enum/Pokemon"
import { useAppSelector } from "../../../hooks"
import PokemonPortrait from "../pokemon-portrait"
import { type EliteDesign, parseImportString } from "./elite-designer"
import "./elite-designer.css"

// One saved design as returned by GET /api/elite-designs
// (app/models/mongo-models/elite-design.ts).
interface LibraryDesign {
  kind: "elite" | "boss"
  id: string
  name: string
  act: number
  stageRange: string
  icon: string
  designJson: string
  creatorUid: string
  creatorName: string
  approved: boolean
  createdAt: string
  results: {
    difficulty?: "easy" | "normal" | "hard" | "impossible"
    stage: string
    wins: number
    draws: number
    losses: number
    sampleSize: number
    testedAt: string
  }[]
}

// Mirror of EliteMeasureStatus in app/services/elite-measure.ts, polled from
// GET /api/elite-measure-status while a measurement runs.
interface MeasureStatus {
  running: boolean
  mode: "single" | "all" | null
  designId: string | null
  designName: string | null
  done: number
  total: number
  batchIndex: number
  batchCount: number
  startedBy: string | null
  completedCount: number
  finished: string | null
}

const MEASURE_ERROR_LABEL: Record<string, string> = {
  busy: "A measurement is already running — try again in a moment.",
  not_found: "Design not found — it may have been deleted.",
  empty_design: "This design has no Pokémon on the board.",
  bad_stage: "This design has an invalid stage range.",
  insufficient_data:
    "Every milestone pool needs at least one recorded team before measuring.",
  simulation_error:
    "A fight simulation failed, so the incomplete measurement was discarded.",
  guest: "Sign in to run measurements.",
  forbidden: "Measure All is admin-only.",
  no_designs: "No designs match the selected filters.",
  internal: "Measurement failed — check the server logs."
}

// Mirror of the server's bump ladder (elite-design.ts STAGE_LADDER) — used only
// to disable the bump arrows at the ends. Act 1 has no 1-5 elite range.
const STAGE_LADDER: { act: number; stageRange: string }[] = [
  { act: 1, stageRange: "6-10" },
  { act: 1, stageRange: "11-15" },
  { act: 1, stageRange: "16-20" },
  { act: 2, stageRange: "1-5" },
  { act: 2, stageRange: "6-10" },
  { act: 2, stageRange: "11-15" },
  { act: 2, stageRange: "16-20" },
  { act: 3, stageRange: "1-5" },
  { act: 3, stageRange: "6-10" },
  { act: 3, stageRange: "11-15" },
  { act: 3, stageRange: "16-20" }
]

function ladderIndex(d: LibraryDesign): number {
  return STAGE_LADDER.findIndex(
    (s) => s.act === d.act && s.stageRange === d.stageRange
  )
}

const DIFFICULTY_LABELS = [
  ["easy", "Easy"],
  ["normal", "Normal"],
  ["hard", "Hard"],
  ["impossible", "Impossible"]
] as const

function difficultySummaries(d: LibraryDesign) {
  return DIFFICULTY_LABELS.map(([difficulty, label]) => {
    const rows = d.results.filter((result) => result.difficulty === difficulty)
    return {
      difficulty,
      label,
      wins: rows.reduce((sum, row) => sum + row.wins, 0),
      draws: rows.reduce((sum, row) => sum + row.draws, 0),
      losses: rows.reduce((sum, row) => sum + row.losses, 0),
      sampleSize: rows.reduce((sum, row) => sum + row.sampleSize, 0),
      testedAt: rows[0]?.testedAt
    }
  })
}

// Compact Easy/Normal/Hard/Impossible aggregate across both milestone pools.
function shortRates(d: LibraryDesign): string | null {
  if (!d.results || d.results.length === 0) return null
  return difficultySummaries(d)
    .map((summary) =>
      summary.sampleSize > 0
        ? `${summary.label[0]} ${Math.round((100 * summary.wins) / summary.sampleSize)}%`
        : `${summary.label[0]} —`
    )
    .join(" · ")
}

// Shared success-rate library for elite and boss designs, grouped by kind, act,
// and stage range. Rates aggregate both milestone pools per difficulty.
export default function EliteLibrary(props: {
  onLoad: (design: EliteDesign) => void
}) {
  const uid = useAppSelector((state) => state.network.uid)
  const role = useAppSelector((state) => state.network.profile?.role)
  // Redux only learns the role in-game (game.tsx setRole); in the lobby it's
  // unset, which would hide the admin buttons — so fetch it directly too.
  const [fetchedAdmin, setFetchedAdmin] = useState(false)
  useEffect(() => {
    if (!uid) return
    fetch(`/api/user-role/${uid}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.role === Role.ADMIN) setFetchedAdmin(true)
      })
      .catch(() => {})
  }, [uid])
  const isAdmin = fetchedAdmin || role === Role.ADMIN

  const [designs, setDesigns] = useState<LibraryDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [measure, setMeasure] = useState<MeasureStatus | null>(null)
  const [notice, setNotice] = useState<string>("")
  // Library can hold a lot of designs — let the user narrow the list by act
  // and/or stage range. "all" (the default) shows everything.
  const [actFilter, setActFilter] = useState<string>("all")
  const [stageFilter, setStageFilter] = useState<string>("all")
  const [kindFilter, setKindFilter] = useState<string>("all")

  const refresh = useCallback(() => {
    fetch("/api/elite-designs")
      .then((res) => res.json())
      .then((data: LibraryDesign[]) => {
        setDesigns(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Measurement progress: measures run room-less on the server (see
  // elite-measure.ts) — poll /api/elite-measure-status while one is active.
  // `polling` starts true so a batch already running (started earlier, or by
  // someone else) is picked up when the tab opens; the first tick turns
  // polling back off if nothing is running.
  const [polling, setPolling] = useState(true)
  // Distinguish "we watched it finish" from "it finished before we opened the
  // tab" — only the former should show a completion notice / refresh burst.
  const sawRunningRef = useRef(false)
  const lastCompletedRef = useRef(0)

  useEffect(() => {
    if (!polling) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch("/api/elite-measure-status")
        const s: MeasureStatus = await res.json()
        if (cancelled) return
        if (s.running) {
          sawRunningRef.current = true
          setMeasure(s)
          // A design finished mid-batch — pull its fresh results in.
          if (s.completedCount > lastCompletedRef.current) {
            lastCompletedRef.current = s.completedCount
            refresh()
          }
        } else {
          setMeasure(null)
          setPolling(false)
          if (sawRunningRef.current) {
            sawRunningRef.current = false
            lastCompletedRef.current = 0
            refresh()
            if (s.finished === "cancelled") {
              setNotice("Measurement cancelled.")
            } else if (s.finished && s.finished !== "done") {
              setNotice(
                MEASURE_ERROR_LABEL[s.finished] ?? "Measurement failed."
              )
            }
          }
        }
      } catch {
        // transient fetch error — keep polling
      }
    }
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [polling, refresh])

  async function measureOne(design: LibraryDesign) {
    if (measure?.running) return
    setNotice("")
    const res = await fetch(`/api/elite-designs/${design.id}/measure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: uid ?? "" })
    })
    if (res.ok) {
      setPolling(true)
    } else {
      const body = await res.json().catch(() => ({}))
      setNotice(
        MEASURE_ERROR_LABEL[body?.error] ?? "Could not start measuring."
      )
    }
  }

  // Admin: measure every design (narrowed by the current act/stage filters).
  async function measureAll() {
    if (measure?.running) return
    setNotice("")
    const res = await fetch("/api/elite-designs/measure-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: uid ?? "",
        kind: kindFilter !== "all" ? kindFilter : undefined,
        act: actFilter !== "all" ? Number(actFilter) : undefined,
        stageRange: stageFilter !== "all" ? stageFilter : undefined
      })
    })
    if (res.ok) {
      setPolling(true)
    } else {
      const body = await res.json().catch(() => ({}))
      setNotice(
        MEASURE_ERROR_LABEL[body?.error] ?? "Could not start measuring."
      )
    }
  }

  // Stop the running measurement (initiator or admin; server enforces).
  async function cancelMeasure() {
    await fetch("/api/elite-measure/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: uid ?? "" })
    }).catch(() => {})
  }

  function load(design: LibraryDesign) {
    const parsed = parseImportString(design.designJson)
    if (parsed) {
      // Link the editor to this entry (creator or admin) so its save button
      // becomes "Update Library" — edit-in-place. Other users loading someone
      // else's design get no link, so their save creates a new entry instead.
      const canEdit = design.creatorUid === uid || isAdmin
      props.onLoad({
        ...parsed,
        libraryId: canEdit ? design.id : undefined
      })
    } else setNotice("Could not load this design (malformed data).")
  }

  // Admin: toggle whether a design can enter its live encounter pool.
  async function setApproved(design: LibraryDesign, approved: boolean) {
    setNotice("")
    const res = await fetch(`/api/elite-designs/${design.id}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: uid ?? "", approved })
    })
    if (res.ok) refresh()
    else setNotice("Could not change approval (admin only).")
  }

  // Moves a design one stage range up/down the ladder (clears its rates —
  // they were measured against the old bracket; re-measure manually).
  async function bump(design: LibraryDesign, direction: "up" | "down") {
    setNotice("")
    const res = await fetch(`/api/elite-designs/${design.id}/bump`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: uid ?? "", direction })
    })
    if (res.ok) refresh()
    else {
      const body = await res.json().catch(() => ({}))
      setNotice(
        body?.error === "at_limit"
          ? "Already at the end of the stage ladder."
          : body?.error === "forbidden"
            ? "Only the creator (or an admin) can move this design."
            : "Could not move this design."
      )
    }
  }

  async function remove(design: LibraryDesign) {
    if (!confirm(`Delete "${design.name}" from the library?`)) return
    const res = await fetch(
      `/api/elite-designs/${design.id}?uid=${encodeURIComponent(uid ?? "")}`,
      { method: "DELETE" }
    )
    if (res.ok) refresh()
    else setNotice("Could not delete this design.")
  }

  // Distinct acts / stage ranges present in the library, for the filter
  // dropdowns (only offer values that actually have designs).
  const actOptions = useMemo(
    () => [...new Set(designs.map((d) => d.act))].sort((a, b) => a - b),
    [designs]
  )
  const stageOptions = useMemo(
    () =>
      [...new Set(designs.map((d) => d.stageRange))].sort(
        (a, b) => parseInt(a) - parseInt(b)
      ),
    [designs]
  )

  // kind → act → stageRange → designs after applying the filters.
  const grouped = useMemo(() => {
    const byGroup = new Map<string, LibraryDesign[]>()
    for (const d of designs) {
      if (kindFilter !== "all" && d.kind !== kindFilter) continue
      if (actFilter !== "all" && String(d.act) !== actFilter) continue
      if (stageFilter !== "all" && d.stageRange !== stageFilter) continue
      const key = `${d.kind}|${d.act}|${d.stageRange}`
      if (!byGroup.has(key)) byGroup.set(key, [])
      byGroup.get(key)!.push(d)
    }
    return [...byGroup.entries()].sort(([a], [b]) => {
      const [kindA, actA, rangeA] = a.split("|")
      const [kindB, actB, rangeB] = b.split("|")
      return (
        kindA.localeCompare(kindB) ||
        parseInt(actA) - parseInt(actB) ||
        parseInt(rangeA) - parseInt(rangeB)
      )
    })
  }, [designs, kindFilter, actFilter, stageFilter])

  return (
    <div className="elite-library">
      <div className="elite-library-head">
        <p className="elite-rec-note">
          Saved elite and boss designs with success rates measured against real
          player teams at Easy, Normal, Hard, and Impossible. Each completed
          rate covers exactly 200 fights across the two bracketing milestone
          pools. Approved elites and bosses enter their respective live
          encounter pools.
        </p>
        {designs.length > 0 && (
          <div className="elite-library-filters">
            <label>
              Type{" "}
              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value)}
              >
                <option value="all">All</option>
                <option value="elite">Elite</option>
                <option value="boss">Boss</option>
              </select>
            </label>
            <label>
              Act{" "}
              <select
                value={actFilter}
                onChange={(e) => setActFilter(e.target.value)}
              >
                <option value="all">All</option>
                {actOptions.map((a) => (
                  <option key={a} value={String(a)}>
                    Act {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stage{" "}
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="all">All</option>
                {stageOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            {isAdmin && (
              <button
                className="bubbly orange small"
                onClick={measureAll}
                disabled={!!measure?.running}
                title="Measure every design matching the type/act/stage filters. Runs on the server; results persist as each design finishes."
              >
                Measure All
                {(kindFilter !== "all" ||
                  actFilter !== "all" ||
                  stageFilter !== "all") &&
                  " (filtered)"}
              </button>
            )}
          </div>
        )}
        {measure?.running && (
          <p className="elite-library-notice">
            Measuring {measure.designName ?? "…"}
            {measure.batchCount > 1 &&
              ` (${measure.batchIndex}/${measure.batchCount})`}
            {" — "}
            {measure.done}/{measure.total || "?"} fights{" "}
            {(measure.startedBy === uid || isAdmin) && (
              <button className="bubbly red small" onClick={cancelMeasure}>
                Cancel
              </button>
            )}
          </p>
        )}
        {notice && <p className="elite-library-notice">{notice}</p>}
      </div>

      {loading && <p className="elite-rec-note">Loading…</p>}
      {!loading && designs.length === 0 && (
        <p className="elite-rec-note">
          No designs saved yet — build one in the Designer tab and click "Save
          to Library".
        </p>
      )}
      {!loading && designs.length > 0 && grouped.length === 0 && (
        <p className="elite-rec-note">
          No designs match the selected act / stage filter.
        </p>
      )}

      {grouped.map(([key, group]) => {
        const [kind, act, range] = key.split("|")
        return (
          <section key={key} className="elite-library-group my-box">
            <h4>
              {kind === "boss"
                ? `Act ${act} Bosses`
                : `Act ${act} · Stage ${range}`}
            </h4>
            {group.map((d) => {
              const mine = d.creatorUid === uid
              const isMeasuring =
                !!measure?.running && measure.designId === d.id
              return (
                <div key={d.id} className="elite-library-row">
                  {d.icon && PkmIndex[d.icon as Pkm] ? (
                    <PokemonPortrait
                      portrait={{ index: PkmIndex[d.icon as Pkm] }}
                    />
                  ) : (
                    <div className="elite-library-noicon" />
                  )}
                  <div className="elite-library-info">
                    <span className="elite-library-name">
                      {d.name}
                      {shortRates(d) && (
                        <span
                          className="elite-library-shortrate"
                          title="Win rate by classic difficulty (exactly 200 fights each)"
                        >
                          {" "}
                          – {shortRates(d)}
                        </span>
                      )}
                      {d.approved && (
                        <span
                          className="elite-library-approvedtag"
                          title={`Approved — can appear as a live ${d.kind} fight`}
                        >
                          ✓ Approved
                        </span>
                      )}
                    </span>
                    <span className="elite-library-creator">
                      by {d.creatorName}
                    </span>
                    <div className="elite-library-results">
                      {isMeasuring ? (
                        <span>
                          Measuring… {measure.done}/{measure.total || "?"}
                        </span>
                      ) : d.results.length === 0 ? (
                        <span className="elite-library-unmeasured">
                          Not measured yet
                        </span>
                      ) : (
                        difficultySummaries(d).map((summary) => (
                          <span
                            key={summary.difficulty}
                            title={`${summary.wins} wins · ${summary.draws} draws · ${summary.losses} losses out of ${summary.sampleSize} fights${summary.testedAt ? ` (${new Date(summary.testedAt).toLocaleDateString()})` : ""}`}
                          >
                            {summary.label}:{" "}
                            {summary.sampleSize === 0 ? (
                              "no teams"
                            ) : (
                              <b>
                                {Math.round(
                                  (100 * summary.wins) / summary.sampleSize
                                )}
                                %
                              </b>
                            )}
                            {summary.sampleSize > 0 &&
                              ` (${summary.wins}W ${summary.draws}D ${summary.losses}L / ${summary.sampleSize})`}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="elite-library-actions">
                    <button
                      className="bubbly blue small"
                      onClick={() => load(d)}
                      title="Load this design into the Designer tab"
                    >
                      Load
                    </button>
                    <button
                      className="bubbly green small"
                      onClick={() => measureOne(d)}
                      disabled={!!measure?.running}
                      title={
                        measure?.running
                          ? "A measurement is already running"
                          : "Fight exactly 200 times at each classic difficulty (800 fights total; server-side)"
                      }
                    >
                      {isMeasuring ? "Measuring…" : "Measure"}
                    </button>
                    {isAdmin && (
                      <button
                        className={`bubbly ${d.approved ? "dark" : "orange"} small`}
                        onClick={() => setApproved(d, !d.approved)}
                        title={
                          d.approved
                            ? `Remove from the live ${d.kind} pool`
                            : `Approve for the live ${d.kind} pool`
                        }
                      >
                        {d.approved ? "Unapprove" : "Approve"}
                      </button>
                    )}
                    {(mine || isAdmin) && (
                      <>
                        {d.kind === "elite" && (
                          <>
                            <button
                              className="bubbly dark small"
                              onClick={() => bump(d, "down")}
                              disabled={
                                ladderIndex(d) <= 0 || !!measure?.running
                              }
                              title="Move down one stage range (clears rates and may clear approval)"
                            >
                              −
                            </button>
                            <button
                              className="bubbly dark small"
                              onClick={() => bump(d, "up")}
                              disabled={
                                ladderIndex(d) >= STAGE_LADDER.length - 1 ||
                                !!measure?.running
                              }
                              title="Move up one stage range (clears rates and may clear approval)"
                            >
                              +
                            </button>
                          </>
                        )}
                        <button
                          className="bubbly red small"
                          onClick={() => remove(d)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
