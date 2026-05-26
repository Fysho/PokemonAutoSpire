import dotenv from "dotenv"
dotenv.config()

import { Encoder } from "@colyseus/schema"
import { listen } from "@colyseus/tools"
import admin from "firebase-admin"
import mongoose from "mongoose"
import { logger } from "colyseus"
import { server as app } from "./app.config"

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
  logger.info("PokemonAutoSpire server started")
}

main()
