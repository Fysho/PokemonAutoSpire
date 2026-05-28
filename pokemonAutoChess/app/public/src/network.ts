import { Client, Room } from "@colyseus/sdk"
import firebase from "firebase/compat/app"
import "firebase/compat/auth"
import type { server } from "../../app.config.ts"
import { FIREBASE_CONFIG } from "../../config"
import GameState from "../../rooms/states/game-state"
import { Role, Transfer } from "../../types"
import { logger } from "../../utils/logger"
import store from "./stores"
import { logIn, setProfile } from "./stores/NetworkStore"

const endpoint = `${window.location.protocol.replace("http", "ws")}//${
  window.location.host
}`
logger.info(`Colyseus endpoint: ${endpoint}`)

export const client = new Client<typeof server>(endpoint)

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG)
}

export { firebase }

export async function getIdToken(): Promise<string | undefined> {
  const user = firebase.auth().currentUser
  if (user) {
    return user.getIdToken()
  }
  return undefined
}

export function authenticateUser() {
  const user = firebase.auth().currentUser
  if (user) {
    store.dispatch(logIn(user as any))
    store.dispatch(
      setProfile({
        uid: user.uid,
        displayName: user.displayName || "Player",
        avatar: "0019/Normal",
        elo: 1000,
        maxElo: 1000,
        games: 0,
        wins: 0,
        exp: 0,
        level: 1,
        donor: false,
        titles: [],
        title: "",
        role: Role.BASIC,
        pokemonCollection: {},
        booster: 0,
        eventPoints: 0,
        maxEventPoints: 0,
        eventFinishTime: null,
        language: "en",
        twitchInfo: null
      } as any)
    )
    return Promise.resolve(user)
  }
  const mockUser = {
    uid: "local-player",
    displayName: "Player",
    email: "player@local"
  } as any
  store.dispatch(logIn(mockUser))
  store.dispatch(
    setProfile({
      uid: "local-player",
      displayName: "Player",
      avatar: "0019/Normal",
      elo: 1000,
      maxElo: 1000,
      games: 0,
      wins: 0,
      exp: 0,
      level: 1,
      donor: false,
      titles: [],
      title: "",
      role: Role.BASIC,
      pokemonCollection: {},
      booster: 0,
      eventPoints: 0,
      maxEventPoints: 0,
      eventFinishTime: null,
      language: "en",
      twitchInfo: null
    } as any)
  )
  return Promise.resolve(mockUser)
}

export const rooms: {
  game: Room<GameState> | undefined
} = {
  game: undefined
}

export async function leaveRoom(
  roomName: keyof typeof rooms,
  allowReconnect = false
): Promise<number> {
  const room = rooms[roomName]
  if (room) {
    rooms[roomName] = undefined
    if (room.connection.isOpen) {
      return await room.leave(!allowReconnect)
    }
  }
  return Promise.resolve(-1)
}

export async function leaveAllRooms() {
  return await Promise.allSettled([leaveRoom("game")])
}

export function joinGame(room: Room<GameState>) {
  leaveAllRooms()
  rooms.game = room
  try {
    localStorage.setItem("spire_reconnect", JSON.stringify({
      reconnectionToken: room.reconnectionToken,
      roomId: room.roomId
    }))
  } catch { /* localStorage unavailable */ }
}

export async function spectateGame(roomId: string): Promise<Room<GameState>> {
  const idToken = await getIdToken()
  const uid = store.getState().network.uid || "local-player"
  const room = await client.joinById<GameState>(roomId, {
    idToken,
    odToken: uid,
    isSpectator: true
  })
  leaveAllRooms()
  rooms.game = room
  return room
}

export function clearGameReconnection() {
  try { localStorage.removeItem("spire_reconnect") } catch { /* noop */ }
}

export function lockShop() {
  rooms.game?.send(Transfer.LOCK)
}

export function levelClick() {
  rooms.game?.send(Transfer.LEVEL_UP)
}

export function buyInShop(id: number) {
  rooms.game?.send(Transfer.SHOP, { id })
}

export function pickChoice(choiceId: string, choiceIndex: number) {
  rooms.game?.send(Transfer.CHOICE, { choiceId, choiceIndex })
}

export function showEmote(emote?: string) {
  rooms.game?.send(Transfer.SHOW_EMOTE, emote)
}

// Stubs for removed multiplayer features — these are imported by components
// still in the dependency graph (main-sidebar → profile, booster, etc.)
// but never called in single-player mode.
const noop = (() => {}) as any
const noopAsync = (() => Promise.resolve()) as any
export const fetchProfile = noopAsync
export const openBooster = noopAsync
export const buyBooster = noopAsync
export const buyEmotion = noopAsync
export const changeSelectedEmotion = noopAsync
export const startTwitchVerification = noopAsync
export const unlinkTwitchVerification = noopAsync
export const deleteAccount = noop
export const heapSnapshot = noop
export const searchById = noop
export const searchMessages = noopAsync
export const renameAccount = noopAsync
export const getTwitchBlacklist = noopAsync
export const addTwitchBlacklist = noopAsync
export const removeTwitchBlacklist = noopAsync
export const ban = noop
export const unban = noop
export const giveBooster = noop
export const giveRole = noop
export const giveTitle = noop
export const kick = noop
export const sendMessage = noop
export const removeMessage = noop
export const addBot = noop
export const removeBot = noop
export const toggleReady = noop
export const setNoElo = noop
export const gameStartRequest = noop
export const changeRoomName = noop
export const changeRoomPassword = noop
export const changeRoomMinMaxRanks = noop
export const setSpecialRule = noop
export const createTournament = noop
export const deleteTournament = noop
export const remakeTournamentLobby = noop
export const participateInTournament = noop
export const joinLobby = noop
export const joinPreparation = noop
export const joinAfter = noop
export type ChatRoom = "lobby" | "preparation"
export type TwitchBlacklistEntry = {
  streamerLogin: string
  reason?: string
  createdBy: string
  createdAt?: string
  updatedAt?: string
}
export type TwitchVerificationStartResponse = {
  authorizeUrl: string
  expiresAt: string
}
