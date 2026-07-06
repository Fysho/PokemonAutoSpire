import UserMetadata from "../models/mongo-models/user-metadata"
import { Role } from "../types"
import { logger } from "../utils/logger"
import {
  getEliteDesignById,
  listEliteDesigns,
  saveEliteDesignResults
} from "./elite-design"
import {
  acquireEliteMeasureLatch,
  createHeadlessMeasureRoom,
  measureEliteDesign,
  releaseEliteMeasureLatch
} from "./elite-test"
import type { AsyncFightOpponent } from "./async-fight-pool"

// ============================================================================
// Room-less elite design measurement (REST path).
//
// The original measure flow required the Elite Designer test sandbox — a full
// Colyseus GameRoom plus the whole Phaser game client, loaded only to reach a
// Measure button, when measurement is entirely headless server work. This
// module runs the same measureEliteDesign() against a stand-in room
// (createHeadlessMeasureRoom — a virgin GameState identical to the idle test
// room), triggered straight from the lobby Library tab:
//
//   POST /api/elite-designs/:id/measure   one design (any signed-in user)
//   POST /api/elite-designs/measure-all   whole library, act/stage filterable
//                                         (admin only — minutes of CPU)
//   POST /api/elite-measure/cancel        initiator or admin
//   GET  /api/elite-measure-status        polled by the Library tab
//
// Runs fire-and-forget in the background; the HTTP response is just "started".
// Progress lives in the module-level status object below (poll it — results
// also persist to the design docs, so a dropped client loses nothing). The
// measureRunning latch in elite-test.ts is shared with the in-room path, so
// only one measurement runs server-wide regardless of how it was triggered.
// ============================================================================

export interface EliteMeasureStatus {
  running: boolean
  // Batch identity: "single" or "all". Meaningless when running is false.
  mode: "single" | "all" | null
  designId: string | null
  designName: string | null
  done: number // fights done for the CURRENT design
  total: number // fights total for the CURRENT design
  batchIndex: number // 1-based position of the current design in the batch
  batchCount: number // designs in the batch (1 for single)
  startedBy: string | null
  // Bumped every time a design's results are saved — the Library tab refreshes
  // its list when this changes.
  completedCount: number
  // Set when the batch ends: "done" | "cancelled" | an error code. Cleared on
  // the next start.
  finished: string | null
}

const status: EliteMeasureStatus = {
  running: false,
  mode: null,
  designId: null,
  designName: null,
  done: 0,
  total: 0,
  batchIndex: 0,
  batchCount: 0,
  startedBy: null,
  completedCount: 0,
  finished: null
}

let cancelRequested = false

export function getEliteMeasureStatus(): EliteMeasureStatus {
  return { ...status }
}

async function isAdmin(uid: string): Promise<boolean> {
  try {
    const user = await UserMetadata.findOne({ uid }, { role: 1 }).lean()
    return user?.role === Role.ADMIN
  } catch {
    return false
  }
}

function isGuestUid(uid: string): boolean {
  return !uid || uid === "local-player"
}

// Cancel the running measurement — the initiator or an admin. The current
// design's partial fights are discarded; designs already completed in a bulk
// run keep their saved results.
export async function cancelEliteMeasure(
  uid: string
): Promise<{ ok: boolean; error?: string }> {
  if (!status.running) return { ok: false, error: "not_running" }
  if (status.startedBy !== uid && !(await isAdmin(uid))) {
    return { ok: false, error: "forbidden" }
  }
  cancelRequested = true
  return { ok: true }
}

function beginStatus(
  mode: "single" | "all",
  uid: string,
  batchCount: number
): void {
  status.running = true
  status.mode = mode
  status.designId = null
  status.designName = null
  status.done = 0
  status.total = 0
  status.batchIndex = 0
  status.batchCount = batchCount
  status.startedBy = uid
  status.completedCount = 0
  status.finished = null
  cancelRequested = false
}

function endStatus(finished: string): void {
  status.running = false
  status.finished = finished
}

// Measures one design in the background. Resolves once the batch has STARTED
// (or refused); the fights run after the HTTP response goes out.
export async function startEliteMeasure(
  uid: string,
  designId: string
): Promise<{ ok: boolean; error?: string }> {
  if (isGuestUid(uid)) return { ok: false, error: "guest" }
  const doc = await getEliteDesignById(designId)
  if (!doc) return { ok: false, error: "not_found" }
  if (!acquireEliteMeasureLatch()) return { ok: false, error: "busy" }
  beginStatus("single", uid, 1)
  runBatch([doc]).catch((e) => {
    logger.error("elite measure (single) crashed:", e)
    endStatus("internal")
    releaseEliteMeasureLatch()
  })
  return { ok: true }
}

// Measures every design in the library (optionally narrowed to one act and/or
// stage range) in the background. Admin only — a full library is minutes of
// sustained CPU on the 2-vCPU droplet.
export async function startEliteMeasureAll(
  uid: string,
  filters?: { act?: number; stageRange?: string }
): Promise<{ ok: boolean; error?: string; count?: number }> {
  if (isGuestUid(uid)) return { ok: false, error: "guest" }
  if (!(await isAdmin(uid))) return { ok: false, error: "forbidden" }
  const designs = (await listEliteDesigns()).filter(
    (d) =>
      (filters?.act === undefined || d.act === filters.act) &&
      (filters?.stageRange === undefined || d.stageRange === filters.stageRange)
  )
  if (designs.length === 0) return { ok: false, error: "no_designs" }
  if (!acquireEliteMeasureLatch()) return { ok: false, error: "busy" }
  beginStatus("all", uid, designs.length)
  runBatch(designs).catch((e) => {
    logger.error("elite measure (all) crashed:", e)
    endStatus("internal")
    releaseEliteMeasureLatch()
  })
  return { ok: true, count: designs.length }
}

// The batch loop. Caller holds the latch (skipLatch below); this releases it.
// One headless room + one pool cache serve the whole batch, so designs sharing
// a bracket never re-fetch the same pools.
async function runBatch(
  designs: { id: string; name: string; act: number; stageRange: string; designJson: string }[]
): Promise<void> {
  const room = createHeadlessMeasureRoom()
  const poolCache = new Map<string, AsyncFightOpponent[]>()
  try {
    for (let i = 0; i < designs.length; i++) {
      if (cancelRequested) {
        endStatus("cancelled")
        return
      }
      const design = designs[i]
      status.batchIndex = i + 1
      status.designId = design.id
      status.designName = design.name
      status.done = 0
      status.total = 0
      const outcome = await measureEliteDesign(
        room,
        design.designJson,
        design.act,
        design.stageRange,
        (done, total) => {
          status.done = done
          status.total = total
        },
        {
          shouldAbort: () => cancelRequested,
          poolCache,
          skipLatch: true
        }
      )
      if (Array.isArray(outcome)) {
        // designJson guard: skip the write if the design changed mid-measure.
        await saveEliteDesignResults(design.id, outcome, design.designJson)
        status.completedCount++
      } else if (outcome.error === "aborted") {
        endStatus("cancelled")
        return
      } else if (designs.length === 1) {
        // Single-design run: surface the error to the poller instead of a
        // hollow "done".
        endStatus(outcome.error)
        return
      } else {
        // Per-design failure (empty_design/bad_stage on a stale doc) — log and
        // move on; one broken design must not kill a bulk run.
        logger.warn(
          `elite measure: design ${design.name} (${design.id}) skipped: ${outcome.error}`
        )
      }
    }
    endStatus("done")
  } finally {
    releaseEliteMeasureLatch()
    status.running = false
  }
}
