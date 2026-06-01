// ecosystem.config.js
const os = require("os")
require("dotenv").config()

module.exports = {
  apps: [
    {
      name: "colyseus",
      script: "./app/public/dist/server/app/index.js", // your entrypoint file
      instances: os.cpus().length,
      exec_mode: "fork", // IMPORTANT: do not use cluster mode.
      watch: false,
      time: true,
      wait_ready: true,
      // Safety net only — recycles a process before a leak bloats it to multi-GB and
      // V8 OOM-aborts. NOT a fix; real leaks must be fixed at the source (unsubscribe
      // presence handlers on dispose). See AI-MEMORY-LEAKS.md. Tune to your droplet:
      // this is PER PROCESS, and `instances: os.cpus().length` runs one per core, so
      // keep (instances x this limit) comfortably under total RAM.
      max_memory_restart: "1500M",
      env_production: {
        NODE_ENV: "production"
      },
      interpreter: "node@24.11.1"
    }
  ],
  deploy: {
    production: {
      user: "root",
      host: process.env.DEPLOY_HOSTS?.split(",") || [],
      ref: "origin/prod",
      repo: "https://github.com/keldaanCommunity/pokemonAutoChess.git",
      path: "/home/deploy",
      "post-deploy":
        "source ~/.nvm/nvm.sh && nvm install 24.11.1 && nvm use 24.11.1 && npm install && npm run assetpack && npm run build" //nvm use 20.12.0 && npm run assetpack && nvm use 22.14.0 &&
    }
  }
}
