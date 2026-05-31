import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { matchMaker } from "colyseus"
import { logger } from "../utils/logger"

/**
 * CCU (concurrent users) + server-resource history sampler.
 * Samples connected clients, CPU usage and memory every SAMPLE_INTERVAL_MS,
 * persists to a JSON file (rolling window), and exposes the series for graphing.
 */

export interface CcuSample {
  t: number // epoch ms
  ccu: number // total connected clients
  rooms: number // active game rooms (clients > 0)
  cpu: number // process CPU usage % over the interval, normalized to all cores (0-100)
  memMB: number // process resident memory (RSS) in MB
  sysMemPct: number // system-wide memory used %
}

const CPU_CORES = Math.max(1, os.cpus().length)

const DATA_DIR = path.resolve(__dirname, "../../")
const DATA_FILE = path.join(DATA_DIR, "ccu-history.json")

const SAMPLE_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000 // keep last 7 days

let samples: CcuSample[] = []
let timer: NodeJS.Timeout | null = null

// CPU% is derived from the delta in cumulative process CPU time vs wall-clock
// time between two samples, so we keep the previous reading around.
let lastCpu = process.cpuUsage()
let lastCpuAt = Date.now()

function sampleCpuPercent(): number {
  const now = Date.now()
  const usage = process.cpuUsage(lastCpu) // micros of user+system since lastCpu
  const wallMs = now - lastCpuAt
  lastCpu = process.cpuUsage()
  lastCpuAt = now
  if (wallMs <= 0) return 0
  const cpuMs = (usage.user + usage.system) / 1000
  // percent of a single core, then spread across all cores
  const pct = (cpuMs / wallMs) * 100 / CPU_CORES
  return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10
}

function load(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
      if (Array.isArray(raw)) samples = raw
    }
  } catch (e) {
    logger.error("Failed to load CCU history:", e)
    samples = []
  }
}

function save(): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(samples))
  } catch (e) {
    logger.error("Failed to save CCU history:", e)
  }
}

async function sample(): Promise<void> {
  try {
    const rooms = await matchMaker.query({})
    const ccu = rooms.reduce((sum, r) => sum + (r.clients ?? 0), 0)
    const activeRooms = rooms.filter((r) => (r.clients ?? 0) > 0).length
    const now = Date.now()

    const cpu = sampleCpuPercent()
    const memMB = Math.round(process.memoryUsage().rss / (1024 * 1024))
    const sysMemPct =
      Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 1000) / 10

    samples.push({ t: now, ccu, rooms: activeRooms, cpu, memMB, sysMemPct })

    // prune anything older than the retention window
    const cutoff = now - RETENTION_MS
    samples = samples.filter((s) => s.t >= cutoff)

    save()
  } catch (e) {
    logger.error("Failed to sample CCU:", e)
  }
}

export function getCcuHistory(): CcuSample[] {
  return samples
}

export function startCcuSampler(): void {
  if (timer) return
  load()
  // take one immediately so the graph isn't empty after a restart
  void sample()
  timer = setInterval(() => void sample(), SAMPLE_INTERVAL_MS)
  logger.info("CCU sampler started (every 5 min)")
}
