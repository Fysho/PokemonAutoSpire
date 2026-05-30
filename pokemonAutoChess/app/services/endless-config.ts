import * as fs from "fs"
import * as path from "path"
import { logger } from "../utils/logger"

// Global, admin-controlled toggle for whether players may start Endless mode.
// Persisted to a JSON file (mirrors the arceus-record / endless-record pattern)
// so the setting survives server restarts. Defaults to enabled.

const CONFIG_FILE = path.join(path.resolve(__dirname, "../../"), "endless-config.json")

let cachedEnabled: boolean | null = null

export function isEndlessEnabled(): boolean {
  if (cachedEnabled !== null) return cachedEnabled
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"))
      cachedEnabled = raw?.enabled !== false
    } else {
      cachedEnabled = true
    }
  } catch (e) {
    logger.error("Failed to read endless config:", e)
    cachedEnabled = true
  }
  return cachedEnabled
}

export function setEndlessEnabled(enabled: boolean): void {
  cachedEnabled = enabled
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ enabled }, null, 2))
    logger.info(`Endless mode ${enabled ? "enabled" : "disabled"} for players`)
  } catch (e) {
    logger.error("Failed to write endless config:", e)
  }
}
