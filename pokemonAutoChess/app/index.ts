import { Encoder } from "@colyseus/schema"
import { listen } from "@colyseus/tools"
import { logger } from "colyseus"
import { server as app } from "./app.config"

Encoder.BUFFER_SIZE = 512 * 1024

async function main() {
  await listen(app, process.env.PORT ? parseInt(process.env.PORT) : 9000)
  logger.info("PokemonAutoSpire server started")
}

main()
