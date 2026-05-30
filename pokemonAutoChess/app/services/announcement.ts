import { matchMaker } from "colyseus"
import type { Response } from "express"
import { logger } from "../utils/logger"

const sseClients = new Set<Response>()

export function broadcastAnnouncement(message: string) {
  logger.info(`Broadcasting server announcement: ${message}`)

  // Push to all SSE clients (lobby)
  const payload = `data: ${JSON.stringify({ message })}\n\n`
  sseClients.forEach((res) => {
    try {
      if (res.writableEnded) {
        sseClients.delete(res)
        return
      }
      res.write(payload)
    } catch {
      sseClients.delete(res)
    }
  })

  // Push to all game rooms via Colyseus presence
  matchMaker.presence.publish("server-announcement", message)
}

export function addSSEClient(res: Response) {
  sseClients.add(res)
}

export function removeSSEClient(res: Response) {
  sseClients.delete(res)
}
