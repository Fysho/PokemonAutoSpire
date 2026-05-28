import { readFile } from "node:fs/promises"
import { monitor } from "@colyseus/monitor"
import { defineRoom, defineServer, ServerOptions } from "colyseus"
import { WebSocketTransport } from "@colyseus/ws-transport"
import cors from "cors"
import express from "express"
import basicAuth from "express-basic-auth"
import helmet from "helmet"
import { marked } from "marked"
import path from "path"
import pkg from "../package.json"
import { SynergyTriggers } from "./config"
import { initTilemap } from "./core/design"
import { PRECOMPUTED_POKEMONS_PER_TYPE } from "./models/precomputed/precomputed-types"
import GameRoom from "./rooms/game-room"
import { DungeonPMDO } from "./types/enum/Dungeon"
import { Item } from "./types/enum/Item"
import { Pkm, PkmIndex } from "./types/enum/Pokemon"
import { logger } from "./utils/logger"

const clientSrc = __dirname.includes("server")
  ? path.join(__dirname, "..", "..", "client")
  : path.join(__dirname, "public", "dist", "client")
const viewsSrc = path.join(clientSrc, "index.html")
const isDevelopment = process.env.MODE === "dev"

const legalPageStyle = `
      :root {
        color-scheme: light;
      }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        background: #f7f7f7;
        color: #1b1b1b;
      }
      main {
        box-sizing: border-box;
        max-width: 900px;
        margin: 0 auto;
        padding: 24px 16px 48px;
        background: #fff;
        min-height: 100vh;
      }
      h1,
      h2,
      h3 {
        line-height: 1.25;
      }
      p,
      li {
        line-height: 1.6;
      }
`

async function renderLegalPage(
  res: express.Response,
  markdownFile: string,
  pageTitle: string,
  unavailableMessage: string
) {
  try {
    const markdown = await readFile(
      path.resolve(process.cwd(), markdownFile),
      "utf8"
    )
    const html = await marked.parse(markdown)

    res.type("html").send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${pageTitle} | Pokemon Auto Chess</title>
    <style>${legalPageStyle}</style>
  </head>
  <body>
    <main>
      ${html}
    </main>
  </body>
</html>`)
  } catch (error) {
    logger.error(`Failed to load ${markdownFile}`, error)
    res.status(500).send(unavailableMessage)
  }
}

let gameOptions: ServerOptions = {
  transport: new WebSocketTransport({
    pingInterval: 15000,
    pingMaxRetries: 4
  })
}

export const server = defineServer({
  ...gameOptions,

  rooms: {
    game: defineRoom(GameRoom).enableRealtimeListing()
  },

  express: (app) => {
    app.use(
      helmet({
        crossOriginOpenerPolicy: false,
        contentSecurityPolicy: false
      })
    )

    app.use(cors())
    app.use(express.json())
    app.use(express.static(clientSrc))

    app.get("/", (req, res) => {
      res.sendFile(viewsSrc)
    })

    app.get("/lobby", (req, res) => {
      res.sendFile(viewsSrc)
    })

    app.get("/game", (req, res) => {
      res.sendFile(viewsSrc)
    })

    app.get("/privacy-policy", async (req, res) => {
      await renderLegalPage(
        res,
        "policy.md",
        "Privacy Policy",
        "Privacy policy is temporarily unavailable"
      )
    })

    app.get("/terms-of-service", async (req, res) => {
      await renderLegalPage(
        res,
        "terms-of-service.md",
        "Terms of Service",
        "Terms of service are temporarily unavailable"
      )
    })

    app.get("/pokemons", (req, res) => {
      res.send(Pkm)
    })

    app.get("/pokemons-index", (req, res) => {
      res.send(PkmIndex)
    })

    app.get("/types", (req, res) => {
      res.send(PRECOMPUTED_POKEMONS_PER_TYPE)
    })

    app.get("/items", (req, res) => {
      res.send(Item)
    })

    app.get("/types-trigger", (req, res) => {
      res.send(SynergyTriggers)
    })

    app.get("/tilemap/:map", async (req, res) => {
      try {
        if (
          !req.params.map ||
          !Object.values(DungeonPMDO).includes(req.params.map as DungeonPMDO)
        ) {
          return res.status(400).send({ error: "Invalid map parameter" })
        }
        const tilemap = initTilemap(req.params.map as DungeonPMDO)
        res.send(tilemap)
      } catch (error) {
        logger.error("Error generating tilemap", { error, map: req.params.map })
        res.status(500).send({ error: "Error generating tilemap" })
      }
    })

    app.get("/titles", (req, res) => {
      res.json([])
    })

    app.get("/status", async (req, res) => {
      try {
        const { matchMaker } = await import("colyseus")
        const rooms = await matchMaker.query({})
        const ccu = rooms.reduce((sum, r) => sum + (r.clients ?? 0), 0)
        const UserMetadata = (await import("./models/mongo-models/user-metadata")).default
        const totalAccounts = await UserMetadata.countDocuments()
        const version = pkg.version
        res.send({ ccu, totalAccounts, version })
      } catch (error) {
        res.send({ ccu: 0, totalAccounts: 0, version: pkg.version })
      }
    })

    app.get("/api/public-runs", async (req, res) => {
      try {
        const { matchMaker } = await import("colyseus")
        const rooms = await matchMaker.query({})
        const runs = rooms
          .filter((r) => r.clients > 0 && r.metadata?.ownerName && r.metadata?.type === "game")
          .map((r) => ({
            roomId: r.roomId,
            ownerName: r.metadata?.ownerName ?? "Unknown",
            difficultyMode: r.metadata?.difficultyMode ?? 1,
            currentAct: r.metadata?.currentAct ?? 1,
            currentFloor: r.metadata?.currentFloor ?? 0,
            runHP: r.metadata?.runHP ?? 100,
            spectatorCount: r.metadata?.spectatorCount ?? 0,
            clients: r.clients ?? 1
          }))
        res.json(runs)
      } catch (error) {
        res.json([])
      }
    })

    app.get("/api/saved-run/:uid", async (req, res) => {
      try {
        const { getSavedRunSummary } = await import("./services/run-save")
        const summary = await getSavedRunSummary(req.params.uid)
        res.json(summary ?? null)
      } catch (error) {
        logger.error("Error fetching saved run:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    app.get("/api/spire-region/:uid", async (req, res) => {
      try {
        const UserMetadata = (await import("./models/mongo-models/user-metadata")).default
        const user = await UserMetadata.findOne({ uid: req.params.uid }, { spireRegion: 1 }).lean()
        res.json({ region: user?.spireRegion ?? "town" })
      } catch (error) {
        logger.error("Error fetching spire region:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    app.put("/api/spire-region/:uid", async (req, res) => {
      try {
        const region = req.body?.region
        if (typeof region !== "string") {
          return res.status(400).json({ error: "Invalid region" })
        }
        const UserMetadata = (await import("./models/mongo-models/user-metadata")).default
        await UserMetadata.updateOne(
          { uid: req.params.uid },
          { $set: { spireRegion: region } },
          { upsert: true }
        )
        res.json({ ok: true })
      } catch (error) {
        logger.error("Error saving spire region:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    app.get("/api/user-role/:uid", async (req, res) => {
      try {
        const UserMetadata = (await import("./models/mongo-models/user-metadata")).default
        const user = await UserMetadata.findOne({ uid: req.params.uid }, { role: 1 }).lean()
        res.json({ role: user?.role || "BASIC" })
      } catch (error) {
        res.json({ role: "BASIC" })
      }
    })

    app.get("/api/spire-stats/:uid", async (req, res) => {
      try {
        const UserMetadata = (await import("./models/mongo-models/user-metadata")).default
        const user = await UserMetadata.findOne({ uid: req.params.uid }, { spireStats: 1 }).lean()
        res.json(user?.spireStats ?? {
          easy: { runsStarted: 0, wins: 0, champion: 0, arceusDamage: 0 },
          normal: { runsStarted: 0, wins: 0, champion: 0, arceusDamage: 0 },
          hard: { runsStarted: 0, wins: 0, champion: 0, arceusDamage: 0 },
          impossible: { runsStarted: 0, wins: 0, champion: 0, arceusDamage: 0 }
        })
      } catch (error) {
        logger.error("Error fetching spire stats:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    app.get("/api/champion-data/:difficulty", async (req, res) => {
      try {
        const { loadChampionData } = await import("./services/champion-data")
        const mode = parseInt(req.params.difficulty) as 0 | 1 | 2 | 3
        if (mode !== 0 && mode !== 1 && mode !== 2 && mode !== 3) {
          return res.status(400).json({ error: "Invalid difficulty" })
        }
        const data = loadChampionData(mode)
        const simplify = (snap: any) => ({
          name: snap.name,
          avatar: snap.avatar,
          pokemon: snap.pokemon.filter((p: any) => p.y > 0).map((p: any) => ({
            name: p.name,
            items: p.items || []
          })),
          inventory: snap.inventory || []
        })
        res.json({
          champion: simplify(data.champion),
          eliteFour: data.eliteFour.map(simplify),
          championSince: data.championSince ?? null,
          longestReign: data.longestReign
            ? { name: data.longestReign.name, durationMs: data.longestReign.durationMs }
            : null
        })
      } catch (error) {
        logger.error("Error fetching champion data:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    app.get("/api/arceus-record/:difficulty", async (req, res) => {
      try {
        const { getArceusLeaderboardForClient } = await import("./services/arceus-record")
        const mode = parseInt(req.params.difficulty) as 0 | 1 | 2 | 3
        if (mode !== 0 && mode !== 1 && mode !== 2 && mode !== 3) {
          return res.status(400).json({ error: "Invalid difficulty" })
        }
        res.json(getArceusLeaderboardForClient(mode))
      } catch (error) {
        logger.error("Error fetching Arceus record:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    app.get("/api/run-history/:uid", async (req, res) => {
      try {
        const { getRunHistory } = await import("./services/run-save")
        const page = parseInt(req.query.page as string) || 1
        const history = await getRunHistory(req.params.uid, page)
        res.json(history)
      } catch (error) {
        logger.error("Error fetching run history:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    app.delete("/api/saved-run/:uid", async (req, res) => {
      try {
        const { deleteSavedRun } = await import("./services/run-save")
        const deleted = await deleteSavedRun(req.params.uid)
        res.json({ deleted })
      } catch (error) {
        logger.error("Error deleting saved run:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    const monitorPassword = process.env.MONITOR_PASSWORD
    if (monitorPassword) {
      app.use(
        "/colyseus",
        basicAuth({ users: { admin: monitorPassword }, challenge: true }),
        monitor()
      )
      logger.info("Colyseus monitor available at /colyseus")
    }
  }
})
