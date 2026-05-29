import dotenv from "dotenv"
dotenv.config()

import { Encoder } from "@colyseus/schema"
import { listen } from "@colyseus/tools"
import admin from "firebase-admin"
import mongoose from "mongoose"
import { logger } from "colyseus"
import { server as app } from "./app.config"
import pkg from "../package.json"
import UserMetadata from "./models/mongo-models/user-metadata"
import { RunHistory } from "./models/mongo-models/run-history"
import { SavedRun } from "./models/mongo-models/saved-run"
import { startLongestReignChecker } from "./services/cronjobs"

Encoder.BUFFER_SIZE = 512 * 1024

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  })
})

mongoose.set("returnDocument", "after")

async function main() {
  const mongoUri = process.env.MONGO_URI
  if (mongoUri) {
    await mongoose.connect(mongoUri)
    logger.info("Connected to MongoDB")
  } else {
    logger.warn("MONGO_URI not set — running without database")
  }

  await listen(app, process.env.PORT ? parseInt(process.env.PORT) : 9000)
  const port = process.env.PORT || 9000
  logger.info(`PokemonAutoSpire v${pkg.version} server started on port ${port}`)
  logger.info(`Colyseus monitor: http://localhost:${port}/colyseus`)

  if (mongoUri) {
    const [accounts, runs, activeRuns] = await Promise.all([
      UserMetadata.countDocuments(),
      RunHistory.countDocuments(),
      SavedRun.countDocuments()
    ])
    logger.info(`Database: ${accounts} accounts, ${runs} completed runs, ${activeRuns} active saves`)
  }

  startLongestReignChecker()
}

main()
