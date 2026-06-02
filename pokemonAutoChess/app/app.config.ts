import { readFile } from "node:fs/promises"
import { monitor } from "@colyseus/monitor"
import type { SavedRunData } from "./services/run-save"
import { defineRoom, defineServer, matchMaker, ServerOptions } from "colyseus"
import { WebSocketTransport } from "@colyseus/ws-transport"
import cors from "cors"
import express from "express"
import basicAuth from "express-basic-auth"
import helmet from "helmet"
import { marked } from "marked"
import path from "path"
import pkg from "../package.json"
import { SynergyTriggers } from "./config"
import { USERNAME_REGEXP } from "./config/server/rules"
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

const CCU_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CCU History — Pokemon Auto Spire</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; background: #1b1b22; color: #eee; }
    header { padding: 16px 24px; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    h1 { font-size: 18px; margin: 0; }
    .stat { font-size: 13px; color: #aaa; }
    .stat b { color: #f1c40f; font-size: 15px; }
    .controls { margin-left: auto; display: flex; gap: 8px; }
    button { background: #2a2a33; color: #eee; border: 1px solid #444; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px; }
    button.active { background: #f1c40f; color: #1b1b22; border-color: #f1c40f; }
    .chart-box { padding: 16px 24px; }
    .chart-box h2 { font-size: 14px; margin: 0 0 8px; color: #ccc; font-weight: 600; }
    .canvas-wrap { height: 38vh; }
  </style>
</head>
<body>
  <header>
    <h1>Server Metrics</h1>
    <span class="stat">Players: <b id="now">–</b></span>
    <span class="stat">Peak: <b id="peak">–</b></span>
    <span class="stat">CPU: <b id="cpu">–</b></span>
    <span class="stat">Mem: <b id="mem">–</b></span>
    <span class="stat">Sys mem: <b id="sysmem">–</b></span>
    <span class="stat">Samples: <b id="count">–</b></span>
    <span class="stat">Updated: <b id="updated">–</b></span>
    <div class="controls">
      <button data-h="6">6h</button>
      <button data-h="24" class="active">24h</button>
      <button data-h="72">3d</button>
      <button data-h="168">7d</button>
    </div>
  </header>
  <div class="chart-box">
    <h2>Concurrent Users</h2>
    <div class="canvas-wrap"><canvas id="chart"></canvas></div>
  </div>
  <div class="chart-box">
    <h2>CPU & Memory</h2>
    <div class="canvas-wrap"><canvas id="resChart"></canvas></div>
  </div>
  <script>
    let all = [];
    let hours = 24;
    let chart, resChart;

    function fmt(v, suffix) { return (v === undefined || v === null) ? '–' : v + suffix; }

    function render() {
      const cutoff = Date.now() - hours * 3600 * 1000;
      const data = all.filter(s => s.t >= cutoff);
      const peak = data.reduce((m, s) => Math.max(m, s.ccu), 0);
      const last = all[all.length - 1];
      document.getElementById('now').textContent = last ? last.ccu : '–';
      document.getElementById('peak').textContent = peak;
      document.getElementById('cpu').textContent = last ? fmt(last.cpu, '%') : '–';
      document.getElementById('mem').textContent = last ? fmt(last.memMB, ' MB') : '–';
      document.getElementById('sysmem').textContent = last ? fmt(last.sysMemPct, '%') : '–';
      document.getElementById('count').textContent = data.length;
      document.getElementById('updated').textContent = last ? new Date(last.t).toLocaleTimeString() : '–';

      const points = data.map(s => ({ x: s.t, y: s.ccu }));
      const roomPoints = data.map(s => ({ x: s.t, y: s.rooms }));
      const cpuPoints = data.map(s => ({ x: s.t, y: s.cpu }));
      const sysMemPoints = data.map(s => ({ x: s.t, y: s.sysMemPct }));
      const memPoints = data.map(s => ({ x: s.t, y: s.memMB }));

      if (chart) {
        chart.data.datasets[0].data = points;
        chart.data.datasets[1].data = roomPoints;
        chart.update();
        resChart.data.datasets[0].data = cpuPoints;
        resChart.data.datasets[1].data = sysMemPoints;
        resChart.data.datasets[2].data = memPoints;
        resChart.update();
        return;
      }

      const xAxis = { type: 'time', time: { tooltipFormat: 'MMM d, HH:mm' }, ticks: { color: '#999' }, grid: { color: '#2a2a33' } };

      chart = new Chart(document.getElementById('chart'), {
        type: 'line',
        data: { datasets: [
          { label: 'Players', data: points, borderColor: '#f1c40f', backgroundColor: 'rgba(241,196,15,0.15)', fill: true, tension: 0, pointRadius: 0, borderWidth: 2 },
          { label: 'Active rooms', data: roomPoints, borderColor: '#3498db', fill: false, tension: 0, pointRadius: 0, borderWidth: 1.5 }
        ]},
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: xAxis,
            y: { beginAtZero: true, ticks: { color: '#999', precision: 0 }, grid: { color: '#2a2a33' } }
          },
          plugins: { legend: { labels: { color: '#ccc' } } }
        }
      });

      resChart = new Chart(document.getElementById('resChart'), {
        type: 'line',
        data: { datasets: [
          { label: 'CPU %', data: cpuPoints, yAxisID: 'pct', borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.12)', fill: true, tension: 0, pointRadius: 0, borderWidth: 2 },
          { label: 'System mem %', data: sysMemPoints, yAxisID: 'pct', borderColor: '#9b59b6', fill: false, tension: 0, pointRadius: 0, borderWidth: 1.5 },
          { label: 'Process RSS (MB)', data: memPoints, yAxisID: 'mb', borderColor: '#2ecc71', fill: false, tension: 0, pointRadius: 0, borderWidth: 1.5 }
        ]},
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: xAxis,
            pct: { position: 'left', beginAtZero: true, max: 100, ticks: { color: '#999', callback: v => v + '%' }, grid: { color: '#2a2a33' } },
            mb: { position: 'right', beginAtZero: true, ticks: { color: '#999', callback: v => v + ' MB' }, grid: { drawOnChartArea: false } }
          },
          plugins: { legend: { labels: { color: '#ccc' } } }
        }
      });
    }

    async function load() {
      try {
        const r = await fetch('/api/ccu-history');
        all = await r.json();
        render();
      } catch (e) { console.error(e); }
    }

    document.querySelectorAll('.controls button').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('.controls button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        hours = +b.dataset.h;
        render();
      };
    });

    load();
    setInterval(load, 60 * 1000); // refresh every minute
  </script>
</body>
</html>`

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

    // Whether this signed-in account already has a live game room (used by the
    // lobby to warn that starting/resuming here will kick the existing session).
    app.get("/api/active-game/:uid", async (req, res) => {
      try {
        const uid = req.params.uid
        if (!uid || uid === "local-player") {
          res.json({ active: false })
          return
        }
        const rooms = await matchMaker.query({})
        const active = rooms.some((r) => {
          if (r.name !== "game" || (r.clients ?? 0) <= 0) return false
          const meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata
          return meta?.ownerUid === uid
        })
        res.json({ active })
      } catch (error) {
        res.json({ active: false })
      }
    })

    app.get("/api/public-runs-debug", async (req, res) => {
      try {
        const rooms = await matchMaker.query({})
        res.json(rooms.map((r) => ({ roomId: r.roomId, clients: r.clients, name: r.name, metadataType: typeof r.metadata, metadata: r.metadata })))
      } catch (error) {
        res.json({ error: String(error) })
      }
    })

    app.get("/api/public-runs", async (req, res) => {
      try {
        const rooms = await matchMaker.query({})
        const runs = rooms
          .filter((r) => r.clients > 0)
          .map((r) => {
            const meta = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata
            return meta?.ownerName ? {
              roomId: r.roomId,
              ownerName: meta.ownerName ?? "Unknown",
              difficultyMode: meta.difficultyMode ?? 1,
              isEndless: meta.isEndless ?? false,
              currentAct: meta.currentAct ?? 1,
              currentFloor: meta.currentFloor ?? 0,
              runHP: meta.runHP ?? 100,
              spectatorCount: meta.spectatorCount ?? 0,
              clients: r.clients ?? 1
            } : null
          })
          .filter(Boolean)
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

    // Persist a player's chosen lobby name to UserMetadata.displayName.
    // Mirrors the validation used at run start; never accepts auth-derived names.
    app.put("/api/player-name/:uid", async (req, res) => {
      try {
        const name = typeof req.body?.name === "string" ? req.body.name.trim() : ""
        if (!USERNAME_REGEXP.test(name) || name === "Player" || name === "Username") {
          return res.status(400).json({ error: "Invalid name" })
        }
        const UserMetadata = (await import("./models/mongo-models/user-metadata")).default
        await UserMetadata.updateOne(
          { uid: req.params.uid },
          { $set: { displayName: name }, $setOnInsert: { uid: req.params.uid } },
          { upsert: true }
        )
        res.json({ ok: true })
      } catch (error) {
        logger.error("Error saving player name:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    // Read the player's saved name (source of truth for the lobby input).
    app.get("/api/player-name/:uid", async (req, res) => {
      try {
        const UserMetadata = (await import("./models/mongo-models/user-metadata")).default
        const user = await UserMetadata.findOne({ uid: req.params.uid }, { displayName: 1 }).lean()
        res.json({ name: (user as any)?.displayName ?? null })
      } catch (error) {
        logger.error("Error fetching player name:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    // Read the player's saved avatar (sprite string, e.g. "0019/Normal").
    app.get("/api/player-avatar/:uid", async (req, res) => {
      try {
        const UserMetadata = (await import("./models/mongo-models/user-metadata")).default
        const user = await UserMetadata.findOne({ uid: req.params.uid }, { avatar: 1 }).lean()
        res.json({ avatar: (user as any)?.avatar ?? null })
      } catch (error) {
        logger.error("Error fetching player avatar:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    // Persist the player's chosen avatar (sprite string form) to UserMetadata.avatar.
    app.put("/api/player-avatar/:uid", async (req, res) => {
      try {
        const avatar = typeof req.body?.avatar === "string" ? req.body.avatar.trim() : ""
        if (!/^[0-9]{3,4}(\/[0-9]{3,4})*\/[A-Za-z]+$/.test(avatar)) {
          return res.status(400).json({ error: "Invalid avatar" })
        }
        const UserMetadata = (await import("./models/mongo-models/user-metadata")).default
        await UserMetadata.updateOne(
          { uid: req.params.uid },
          { $set: { avatar }, $setOnInsert: { uid: req.params.uid } },
          { upsert: true }
        )
        res.json({ ok: true })
      } catch (error) {
        logger.error("Error saving player avatar:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    // Case-insensitive prefix search by player name. Uses the existing
    // collation index on displayName (locale "en", strength 2).
    app.get("/api/player-search", async (req, res) => {
      try {
        const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
        if (q.length < 1) return res.json([])
        const UserMetadata = (await import("./models/mongo-models/user-metadata")).default
        const results = await UserMetadata.find(
          { displayName: { $gte: q, $lt: q + "￿" } },
          { uid: 1, displayName: 1, avatar: 1, _id: 0 }
        )
          .collation({ locale: "en", strength: 2 })
          .sort({ displayName: 1 })
          .limit(20)
          .lean()
        res.json(results)
      } catch (error) {
        logger.error("Error searching players:", error)
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
        const e4Victories = data.eliteFourVictories ?? [0, 0, 0, 0]
        const e4Ties = data.eliteFourTies ?? [0, 0, 0, 0]
        res.json({
          champion: { ...simplify(data.champion), victories: data.championVictories ?? 0, ties: data.championTies ?? 0 },
          eliteFour: data.eliteFour.map((snap, i) => ({ ...simplify(snap), victories: e4Victories[i] ?? 0, ties: e4Ties[i] ?? 0 })),
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

    app.get("/api/endless-record", async (req, res) => {
      try {
        const { getEndlessLeaderboardForClient } = await import("./services/endless-record")
        res.json(getEndlessLeaderboardForClient())
      } catch (error) {
        logger.error("Error fetching endless record:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    app.get("/api/endless-enabled", async (req, res) => {
      try {
        const { isEndlessEnabled } = await import("./services/endless-config")
        res.json({ enabled: isEndlessEnabled() })
      } catch (error) {
        logger.error("Error fetching endless-enabled flag:", error)
        res.json({ enabled: true })
      }
    })

    app.get("/api/victory-leaderboard/:difficulty", async (req, res) => {
      try {
        const { getVictoryLeaderboard } = await import("./services/victory-record")
        const mode = parseInt(req.params.difficulty)
        if (mode !== 0 && mode !== 1 && mode !== 2 && mode !== 3) {
          return res.status(400).json({ error: "Invalid difficulty" })
        }
        res.json(await getVictoryLeaderboard(mode))
      } catch (error) {
        logger.error("Error fetching victory leaderboard:", error)
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
        const { loadRun, deleteSavedRun, saveRunHistoryFromSavedRun, updateVictoryRecord } = await import("./services/run-save")
        const savedRun = await loadRun(req.params.uid)
        if (savedRun?.data) {
          await saveRunHistoryFromSavedRun(req.params.uid, savedRun.data as SavedRunData)
          await updateVictoryRecord(
            req.params.uid,
            savedRun.data.team?.name ?? "Unknown",
            savedRun.data.team?.avatar ?? "0129/Normal",
            savedRun.difficultyMode,
            savedRun.currentAct,
            savedRun.isEndless ?? false
          )
        }
        const deleted = await deleteSavedRun(req.params.uid)
        res.json({ deleted })
      } catch (error) {
        logger.error("Error deleting saved run:", error)
        res.status(500).json({ error: "Internal server error" })
      }
    })

    app.get("/api/announcements/stream", async (req, res) => {
      const { addSSEClient, removeSSEClient } = await import("./services/announcement")
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      })
      addSSEClient(res)
      req.on("close", () => {
        removeSSEClient(res)
      })
    })

    const monitorPassword = process.env.MONITOR_PASSWORD
    if (monitorPassword) {
      app.use(
        "/colyseus",
        basicAuth({ users: { admin: monitorPassword }, challenge: true }),
        monitor()
      )
      logger.info("Colyseus monitor available at /colyseus")

      const ccuAuth = basicAuth({ users: { admin: monitorPassword }, challenge: true })

      app.get("/api/ccu-history", ccuAuth, async (req, res) => {
        const { getCcuHistory } = await import("./services/ccu-history")
        res.json(getCcuHistory())
      })

      app.get("/ccu", ccuAuth, (req, res) => {
        res.send(CCU_PAGE_HTML)
      })
      logger.info("CCU graph available at /ccu")
    }
  }
})
