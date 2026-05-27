import {
  AttachmentBuilder,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionsBitField,
  TextChannel,
  WebhookClient
} from "discord.js"
import * as path from "path"
import { Jimp, loadFont } from "jimp"
import { SynergyTriggers } from "../config"
import { BASE_URL } from "../config"
import { computeSynergies } from "../models/colyseus-models/synergies"
import PokemonFactory from "../models/pokemon-factory"
import { AbilityPerTM, Emotion, TMs } from "../types"
import { IUserMetadataMongo } from "../types/interfaces/UserMetadata"
import { Item, SynergyGem, SynergyGivenByGem } from "../types/enum/Item"
import { Pkm, PkmIndex } from "../types/enum/Pokemon"
import { Synergy } from "../types/enum/Synergy"
import type { IBot } from "../types/models/bot-v2"
import { getAvatarSrc } from "../utils/avatar"
import { logger } from "../utils/logger"
import { TeamSnapshot, SnapshotPokemon } from "./team-snapshot"
import { DifficultyMode, formatDuration, LongestReign } from "./champion-data"
import type { ArceusRecord } from "./arceus-record"

let discordWebhook: WebhookClient | undefined
let discordBanWebhook: WebhookClient | undefined

if (process.env.DISCORD_WEBHOOK_URL) {
  discordWebhook = new WebhookClient({
    url: process.env.DISCORD_WEBHOOK_URL
  })
}

if (process.env.DISCORD_BAN_WEBHOOK_URL) {
  discordBanWebhook = new WebhookClient({
    url: process.env.DISCORD_BAN_WEBHOOK_URL
  })
}

let discordBot: Client | undefined
const championChannelId = process.env.DISCORD_CHAMPION_CHANNEL_ID
const arceusChannelId = process.env.DISCORD_ARCEUS_CHANNEL_ID || "1509158620430860349"
const adminChannelId = process.env.DISCORD_ADMIN_CHANNEL_ID || "1509190218690068510"
let cachedChannel: TextChannel | undefined
let cachedArceusChannel: TextChannel | undefined

const pendingResets = new Map<string, NodeJS.Timeout>()

if (process.env.DISCORD_BOT_TOKEN && (championChannelId || arceusChannelId || adminChannelId)) {
  discordBot = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  })

  discordBot.on("messageCreate", (message) => {
    if (message.author.bot) return
    if (!adminChannelId || message.channelId !== adminChannelId) return

    const member = message.member
    if (!member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return
    }

    const content = message.content.trim().toLowerCase()

    if (content === "/reset-leaderboards") {
      const timeout = setTimeout(() => {
        pendingResets.delete(message.author.id)
      }, 30000)
      pendingResets.set(message.author.id, timeout)
      message.reply(
        "Are you sure you want to reset **all** Champion/E4 and Arceus damage leaderboards for all difficulties? Type `/confirm-reset` within 30 seconds to proceed."
      )
      return
    }

    if (content === "/confirm-reset") {
      const pending = pendingResets.get(message.author.id)
      if (!pending) {
        message.reply("No pending reset. Use `/reset-leaderboards` first.")
        return
      }
      clearTimeout(pending)
      pendingResets.delete(message.author.id)

      const { resetChampionData } = require("./champion-data")
      const { resetArceusLeaderboard } = require("./arceus-record")
      resetChampionData()
      resetArceusLeaderboard()

      message.reply("All Champion/E4 and Arceus damage leaderboards have been reset for all difficulties.")
      logger.info(`Leaderboards reset by Discord user ${message.author.tag}`)
      return
    }
  })

  discordBot.login(process.env.DISCORD_BOT_TOKEN).catch((err) => {
    logger.error("Discord bot login failed:", err)
    discordBot = undefined
  })
}

const DIFFICULTY_LABEL: Record<number, string> = { 0: "Easy", 1: "Normal", 2: "Hard" }
const DIFFICULTY_COLOR: Record<number, number> = { 0: 0x44bb44, 1: 0xffbb33, 2: 0xff4444 }

const PORTRAITS_DIR = path.resolve(process.cwd(), "app/public/src/assets/portraits")
const ITEMS_DIR = path.resolve(process.cwd(), "app/public/src/assets/item{tps}")
const SYNERGY_ICONS_DIR = path.resolve(process.cwd(), "app/public/src/assets/types-png")
const FONT_SM_PATH = path.resolve(process.cwd(), "node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-16-white/open-sans-16-white.fnt")
const FONT_LG_PATH = path.resolve(process.cwd(), "node_modules/@jimp/plugin-print/fonts/open-sans/open-sans-32-white/open-sans-32-white.fnt")
const PORTRAIT_SIZE = 60
const PORTRAIT_PADDING = 6
const ITEM_ICON_SIZE = 18
const SYNERGY_ICON_SIZE = 30
const SYNERGY_SLOT_WIDTH = 46
const ROW_GAP = 8
const MAX_TEAM_SIZE = 10
const MIN_WIDTH = MAX_TEAM_SIZE * PORTRAIT_SIZE + (MAX_TEAM_SIZE - 1) * PORTRAIT_PADDING

const toAbsoluteURL = (url: string) => {
  if (url.startsWith("http")) return url
  return `${BASE_URL || "http://localhost:3000"}${url}`
}

async function getChampionChannel(): Promise<TextChannel | undefined> {
  if (cachedChannel) return cachedChannel
  if (!discordBot || !championChannelId) return undefined
  try {
    const channel = await discordBot.channels.fetch(championChannelId)
    if (channel?.isTextBased() && "send" in channel) {
      cachedChannel = channel as TextChannel
      return cachedChannel
    }
    logger.error(`Discord channel ${championChannelId} is not a text channel`)
  } catch (err) {
    logger.error("Failed to fetch Discord champion channel:", err)
  }
  return undefined
}

async function getArceusChannel(): Promise<TextChannel | undefined> {
  if (cachedArceusChannel) return cachedArceusChannel
  if (!discordBot || !arceusChannelId) return undefined
  try {
    const channel = await discordBot.channels.fetch(arceusChannelId)
    if (channel?.isTextBased() && "send" in channel) {
      cachedArceusChannel = channel as TextChannel
      return cachedArceusChannel
    }
    logger.error(`Discord channel ${arceusChannelId} is not a text channel`)
  } catch (err) {
    logger.error("Failed to fetch Discord Arceus channel:", err)
  }
  return undefined
}

function getPortraitPath(pkmName: Pkm, shiny?: boolean): string {
  const index = PkmIndex[pkmName] ?? PkmIndex[Pkm.DEFAULT]
  const indexPath = index.replace(/-/g, "/")
  const shinyPad = shiny
    ? (index.length === 4 ? "/0000/0001" : "/0001")
    : ""
  return path.join(PORTRAITS_DIR, `${indexPath}${shinyPad}/Normal.png`)
}

async function generateTeamImage(
  pokemon: SnapshotPokemon[],
  activeSynergies: { synergy: string; count: number }[],
  playerName: string
): Promise<Buffer> {
  const boardPokemon = pokemon.filter((p) => p.y > 0)
  const pkmCount = boardPokemon.length
  if (pkmCount === 0) return Buffer.alloc(0)

  const pkmRowWidth = pkmCount * PORTRAIT_SIZE + (pkmCount - 1) * PORTRAIT_PADDING
  const synergyRowWidth = activeSynergies.length * SYNERGY_SLOT_WIDTH
  const width = Math.max(MIN_WIDTH, pkmRowWidth, synergyRowWidth)
  const hasSynergies = activeSynergies.length > 0

  const HEADER_HEIGHT = 36
  const HEADER_GAP = 4
  let totalHeight = HEADER_HEIGHT + HEADER_GAP + PORTRAIT_SIZE
  if (hasSynergies) totalHeight += ROW_GAP + SYNERGY_ICON_SIZE
  const canvas = new Jimp({ width, height: totalHeight, color: 0x00000000 })

  const fontSm = await loadFont(FONT_SM_PATH)
  const fontLg = await loadFont(FONT_LG_PATH)

  // Header: centered player name
  const nameText = playerName
  const charMap: Record<number, any> = {}
  for (const key of Object.keys((fontLg as any).chars)) {
    const ch = (fontLg as any).chars[key]
    charMap[ch.id] = ch
  }
  let textWidth = 0
  for (let i = 0; i < nameText.length; i++) {
    const ch = charMap[nameText.charCodeAt(i)]
    if (ch) textWidth += ch.xadvance
  }
  canvas.print({ font: fontLg, x: Math.floor((width - textWidth) / 2), y: 0, text: nameText })

  // Pokemon row
  const pkmY = HEADER_HEIGHT + HEADER_GAP
  const pkmOffsetX = Math.floor((width - pkmRowWidth) / 2)
  for (let i = 0; i < boardPokemon.length; i++) {
    const p = boardPokemon[i]
    const px = pkmOffsetX + i * (PORTRAIT_SIZE + PORTRAIT_PADDING)
    try {
      const portraitPath = getPortraitPath(p.name as Pkm, p.shiny)
      const sprite = await Jimp.read(portraitPath)
      sprite.resize({ w: PORTRAIT_SIZE, h: PORTRAIT_SIZE })
      canvas.composite(sprite, px, pkmY)
    } catch (err) {
      logger.warn(`Portrait not found for ${p.name}`)
    }

    if (p.items.length > 0) {
      const itemCount = Math.min(p.items.length, 3)
      for (let j = 0; j < itemCount; j++) {
        try {
          const itemIcon = await Jimp.read(path.join(ITEMS_DIR, `${p.items[j]}.png`))
          itemIcon.resize({ w: ITEM_ICON_SIZE, h: ITEM_ICON_SIZE })
          const ix = px + PORTRAIT_SIZE - itemCount * ITEM_ICON_SIZE + j * ITEM_ICON_SIZE
          const iy = pkmY + PORTRAIT_SIZE - ITEM_ICON_SIZE
          canvas.composite(itemIcon, ix, iy)
        } catch (err) {
          logger.warn(`Item icon not found for ${p.items[j]}`)
        }
      }
    }
  }

  // Synergy row
  if (hasSynergies) {
    const synergyY = pkmY + PORTRAIT_SIZE + ROW_GAP
    const synergyOffsetX = Math.floor((width - synergyRowWidth) / 2)

    for (let i = 0; i < activeSynergies.length; i++) {
      const { synergy, count } = activeSynergies[i]
      const x = synergyOffsetX + i * SYNERGY_SLOT_WIDTH
      try {
        const iconPath = path.join(SYNERGY_ICONS_DIR, `${synergy}.png`)
        const icon = await Jimp.read(iconPath)
        icon.resize({ w: SYNERGY_ICON_SIZE, h: SYNERGY_ICON_SIZE })
        canvas.composite(icon, x, synergyY)
      } catch (err) {
        logger.warn(`Synergy icon not found for ${synergy}`)
      }
      canvas.print({ font: fontSm, x: x + SYNERGY_ICON_SIZE + 2, y: synergyY + 7, text: `${count}` })
    }
  }

  return canvas.getBuffer("image/png")
}

function computeSnapshotSynergies(snapshot: TeamSnapshot): Map<Synergy, number> {
  const boardPokemon: any[] = []

  for (const snap of snapshot.pokemon) {
    if (snap.y <= 0) continue
    const pkm = PokemonFactory.createPokemonFromName(snap.name as Pkm, {
      shiny: !!snap.shiny,
      emotion: snap.emotion ?? Emotion.NORMAL
    })
    pkm.positionX = snap.x
    pkm.positionY = snap.y

    if (snap.items) {
      for (const item of snap.items) {
        if (TMs.includes(item)) {
          const ability = AbilityPerTM[item]
          if (ability && pkm.types.has(Synergy.HUMAN)) {
            pkm.skill = ability
          }
        } else if (!pkm.items.has(item)) {
          pkm.items.add(item)
        }
      }
    }

    boardPokemon.push(pkm)
  }

  const bonusSynergies = new Map<Synergy, number>()
  if (snapshot.inventory) {
    for (const item of snapshot.inventory) {
      const synType = SynergyGivenByGem[item as SynergyGem]
      if (synType) {
        bonusSynergies.set(synType, (bonusSynergies.get(synType) ?? 0) + 1)
      }
    }
  }

  return computeSynergies(
    boardPokemon,
    bonusSynergies.size > 0 ? bonusSynergies : undefined
  )
}

export const discordService = {
  announceBan(
    user: IUserMetadataMongo,
    bannedUser: IUserMetadataMongo,
    reason: string
  ) {
    const dsEmbed = new EmbedBuilder()
      .setTitle(
        `${user.displayName} banned the user ${bannedUser.displayName} (User ID: ${bannedUser.uid})`
      )
      .setAuthor({
        name: user.displayName,
        iconURL: toAbsoluteURL(getAvatarSrc(user.avatar))
      })
      .setDescription(`Reason: ${reason}`)
      .setThumbnail(toAbsoluteURL(getAvatarSrc(bannedUser.avatar)))
    try {
      discordBanWebhook?.send({
        embeds: [dsEmbed]
      })
    } catch (error) {
      logger.error(error)
    }
  },

  announceUnban(
    user: IUserMetadataMongo,
    unbannedUser: IUserMetadataMongo,
    reason: string
  ) {
    const dsEmbed = new EmbedBuilder()
      .setTitle(
        `${user.displayName} unbanned the user ${unbannedUser.displayName} (User ID: ${unbannedUser.uid})`
      )
      .setAuthor({
        name: user.displayName,
        iconURL: toAbsoluteURL(getAvatarSrc(user.avatar))
      })
      .setDescription(`Reason: ${reason}`)
      .setThumbnail(toAbsoluteURL(getAvatarSrc(user.avatar)))
    try {
      discordBanWebhook?.send({
        embeds: [dsEmbed]
      })
    } catch (error) {
      logger.error(error)
    }
  },

  announceBotCreation(bot: IBot) {
    const dsEmbed = new EmbedBuilder()
      .setTitle(`BOT ${bot.name} created by ${bot.author}`)
      .setAuthor({
        name: bot.author,
        iconURL: toAbsoluteURL(getAvatarSrc(bot.avatar))
      })
      .setDescription(
        `A new bot has been created by ${bot.author}, pending approval by a Bot Manager.`
      )
      .setThumbnail(toAbsoluteURL(getAvatarSrc(bot.avatar)))

    try {
      discordWebhook?.send({
        embeds: [dsEmbed]
      })
    } catch (error) {
      logger.error(error)
    }
  },

  announceBotApproval(botData: IBot, approver: IUserMetadataMongo) {
    const dsEmbed = new EmbedBuilder()
      .setTitle(
        `BOT ${botData.name} by @${botData.author} approved by ${approver.displayName}`
      )
      .setAuthor({
        name: approver.displayName,
        iconURL: toAbsoluteURL(getAvatarSrc(approver.avatar))
      })
      .setDescription(
        `BOT ${botData.name} by @${botData.author} approved by ${approver.displayName}`
      )
      .setThumbnail(toAbsoluteURL(getAvatarSrc(botData.avatar)))
    try {
      discordWebhook?.send({
        embeds: [dsEmbed]
      })
    } catch (error) {
      logger.error(error)
    }
  },

  async announceNewChampion(
    snapshot: TeamSnapshot,
    difficultyMode: DifficultyMode,
    defeatedChampion: string,
    newE4: string[],
    reignDurationMs: number | null
  ) {
    if (!discordBot || !championChannelId) return

    try {
      const channel = await getChampionChannel()
      if (!channel) return

      const synergyCounts = computeSnapshotSynergies(snapshot)
      const activeSynergies: { synergy: string; count: number }[] = []
      synergyCounts.forEach((count, synergy) => {
        const triggers = SynergyTriggers[synergy]
        if (triggers && count >= triggers[0]) {
          activeSynergies.push({ synergy, count })
        }
      })
      activeSynergies.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        const stepsA = SynergyTriggers[a.synergy]?.filter((n: number) => n <= a.count).length ?? 0
        const stepsB = SynergyTriggers[b.synergy]?.filter((n: number) => n <= b.count).length ?? 0
        return stepsB - stepsA
      })

      const imageBuffer = await generateTeamImage(snapshot.pokemon, activeSynergies, snapshot.name)
      const attachment = imageBuffer.length > 0
        ? new AttachmentBuilder(imageBuffer, { name: "team.png" })
        : null

      const diffLabel = DIFFICULTY_LABEL[difficultyMode] ?? "Normal"
      const reignStr = reignDurationMs != null ? ` ${defeatedChampion} held the title for ${formatDuration(reignDurationMs)}.` : ""

      const embed = new EmbedBuilder()
        .setTitle(`**${snapshot.name}** has defeated **${defeatedChampion}** to become the new Champion of ${diffLabel}!`)
        .setDescription(reignStr || null)
        .setColor(DIFFICULTY_COLOR[difficultyMode] ?? 0xffbb33)
        .setTimestamp()

      if (attachment) {
        embed.setImage("attachment://team.png")
      }

      const e4Lines = [...newE4].reverse().map((name, i) => `#${4 - i} ${name}`).join("\n")
      embed.addFields({
        name: "The New Elite Four",
        value: e4Lines,
        inline: false
      })

      const sendOptions: any = { embeds: [embed] }
      if (attachment) sendOptions.files = [attachment]

      await channel.send(sendOptions)
    } catch (err) {
      logger.error("Failed to announce new champion:", err)
    }
  },

  async announceArceusRecord(
    snapshot: TeamSnapshot,
    damage: number,
    difficultyMode: DifficultyMode,
    previousRecord: ArceusRecord | null
  ) {
    if (!discordBot || !arceusChannelId) return

    try {
      const channel = await getArceusChannel()
      if (!channel) return

      const synergyCounts = computeSnapshotSynergies(snapshot)
      const activeSynergies: { synergy: string; count: number }[] = []
      synergyCounts.forEach((count, synergy) => {
        const triggers = SynergyTriggers[synergy]
        if (triggers && count >= triggers[0]) {
          activeSynergies.push({ synergy, count })
        }
      })
      activeSynergies.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        const stepsA = SynergyTriggers[a.synergy]?.filter((n: number) => n <= a.count).length ?? 0
        const stepsB = SynergyTriggers[b.synergy]?.filter((n: number) => n <= b.count).length ?? 0
        return stepsB - stepsA
      })

      const imageBuffer = await generateTeamImage(snapshot.pokemon, activeSynergies, snapshot.name)
      const attachment = imageBuffer.length > 0
        ? new AttachmentBuilder(imageBuffer, { name: "team.png" })
        : null

      const diffLabel = DIFFICULTY_LABEL[difficultyMode] ?? "Normal"

      const title = previousRecord
        ? `**${snapshot.name}** set a new Arceus damage record on ${diffLabel}, taking the title from **${previousRecord.playerName}**!`
        : `**${snapshot.name}** set the first Arceus damage record on ${diffLabel}!`

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(0x9b59b6)
        .setTimestamp()

      embed.addFields({
        name: "Damage Dealt",
        value: `**${damage.toLocaleString()}**`,
        inline: true
      })

      if (previousRecord) {
        embed.addFields({
          name: "Previous Record",
          value: `${previousRecord.damage.toLocaleString()} by ${previousRecord.playerName}`,
          inline: true
        })
      }

      if (attachment) {
        embed.setImage("attachment://team.png")
      }

      const sendOptions: any = { embeds: [embed] }
      if (attachment) sendOptions.files = [attachment]

      await channel.send(sendOptions)
    } catch (err) {
      logger.error("Failed to announce Arceus record:", err)
    }
  },

  async announceNewLongestReign(
    championName: string,
    durationMs: number,
    difficultyMode: DifficultyMode,
    previousRecord: LongestReign | null
  ) {
    if (!discordBot || !championChannelId) return

    try {
      const channel = await getChampionChannel()
      if (!channel) return

      const diffLabel = DIFFICULTY_LABEL[difficultyMode] ?? "Normal"
      const durationStr = formatDuration(durationMs)

      const title = previousRecord
        ? `**${championName}** now holds the longest champion reign on ${diffLabel}, taking the record from **${previousRecord.name}**!`
        : `**${championName}** set the first longest reign record on ${diffLabel}!`

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(0xf1c40f)
        .setTimestamp()

      embed.addFields({
        name: "Reign Duration",
        value: `**${durationStr}**`,
        inline: true
      })

      if (previousRecord) {
        embed.addFields({
          name: "Previous Record",
          value: `${formatDuration(previousRecord.durationMs)} by ${previousRecord.name}`,
          inline: true
        })
      }

      await channel.send({ embeds: [embed] })
    } catch (err) {
      logger.error("Failed to announce longest reign:", err)
    }
  }
}
