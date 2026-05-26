import { readFile } from "node:fs/promises"
import { defineRoom, defineServer, ServerOptions } from "colyseus"
import cors from "cors"
import express from "express"
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

let gameOptions: ServerOptions = {}

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

    app.get("/status", (req, res) => {
      const version = pkg.version
      res.send({ ccu: 1, maxCcu: 1, version })
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
  }
})
