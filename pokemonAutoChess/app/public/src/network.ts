import { Client, type Room } from "@colyseus/sdk"
import firebase from "firebase/compat/app"
import "firebase/compat/auth"
import type { server } from "../../app.config.ts"
import { FIREBASE_CONFIG } from "../../config"
import type GameState from "../../rooms/states/game-state"
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

// After a page refresh, firebase.auth().currentUser is null until Firebase
// finishes restoring the session asynchronously. Reading it synchronously
// misidentifies signed-in users as guests. This resolves once the initial
// auth state is known (with the restored user, or null for true guests).
let authReadyPromise: Promise<firebase.User | null> | null = null
export function waitForFirebaseAuth(): Promise<firebase.User | null> {
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        unsubscribe()
        resolve(user)
      })
    })
  }
  return authReadyPromise
}

export async function authenticateUser() {
  const user = firebase.auth().currentUser ?? (await waitForFirebaseAuth())
  if (user) {
    store.dispatch(logIn(user as any))
    store.dispatch(
      setProfile({
        uid: user.uid,
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
  // Spire is single-player: lobby/preparation/after rooms are never joined, but the
  // (dead) multiplayer UI files still reference them, so they're typed as always-undefined.
  lobby: Room | undefined
  preparation: Room | undefined
  after: Room | undefined
} = {
  game: undefined,
  lobby: undefined,
  preparation: undefined,
  after: undefined
}

// --- Elite Designer test sandbox -------------------------------------------
// State for the ELITE_TEST room (a special GameRoom that runs AI-vs-AI elite
// design test fights). Module-level so it survives client-side route changes.
let eliteTestActive = false
let autoWaveActive = false
type EliteTestDifficulty = 0 | 1 | 2 | 3
export type EliteTestOpponent =
  | { type: "stage"; stage: string; difficulty: EliteTestDifficulty }
  | { type: "design"; designId: string }
let lastEliteTest: {
  design: string
  opponent: EliteTestOpponent
} | null = null

export async function leaveRoom(
  roomName: keyof typeof rooms,
  allowReconnect = false
): Promise<number> {
  if (roomName === "game") {
    eliteTestActive = false
    autoWaveActive = false
    lastEliteTest = null
  }
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
    localStorage.setItem(
      "spire_reconnect",
      JSON.stringify({
        reconnectionToken: room.reconnectionToken,
        roomId: room.roomId
      })
    )
  } catch {
    /* localStorage unavailable */
  }
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
  try {
    localStorage.removeItem("spire_reconnect")
  } catch {
    /* noop */
  }
}

// Creates (and joins) the Elite Designer test sandbox: a GameRoom with eliteTest
// set, which runs no real run and only spawns AI-vs-AI elite test fights. The
// sandbox is ephemeral, so no reconnect token is persisted.
export async function createEliteTestRoom(identity: {
  uid: string
  displayName: string
  avatar: string
}): Promise<Room<GameState>> {
  const idToken = await getIdToken()
  const odToken = identity.uid || "local-player"
  const name = identity.displayName || "EliteTester"
  const room = await client.create<GameState>("game", {
    idToken,
    odToken,
    displayName: name,
    users: {
      [odToken]: {
        uid: odToken,
        name,
        elo: 1000,
        games: 0,
        avatar: identity.avatar || "0019/Normal",
        isBot: false
      }
    },
    preparationId: "elite-test",
    name: "EliteTest",
    ownerName: name,
    noElo: true,
    gameMode: "CUSTOM_LOBBY",
    specialGameRule: null,
    minRank: null,
    maxRank: null,
    tournamentId: null,
    bracketId: null,
    difficultyMode: 1,
    resume: false,
    isEndless: false,
    eliteTest: true
  } as any)
  await leaveAllRooms()
  rooms.game = room
  eliteTestActive = true
  clearGameReconnection()
  return room
}

// Creates the ephemeral admin-only AutoWave sandbox. The server performs the
// admin check and chooses each matchup; the client only submits predictions.
export async function createAutoWaveRoom(identity: {
  uid: string
  displayName: string
  avatar: string
}): Promise<Room<GameState>> {
  const idToken = await getIdToken()
  const odToken = identity.uid || "local-player"
  const name = identity.displayName || "AutoWavePlayer"
  const room = await client.create<GameState>("game", {
    idToken,
    odToken,
    displayName: name,
    users: {
      [odToken]: {
        uid: odToken,
        name,
        elo: 1000,
        games: 0,
        avatar: identity.avatar || "0019/Normal",
        isBot: false
      }
    },
    preparationId: "autowave",
    name: "AutoWave",
    ownerName: name,
    noElo: true,
    gameMode: "CUSTOM_LOBBY",
    specialGameRule: null,
    minRank: null,
    maxRank: null,
    tournamentId: null,
    bracketId: null,
    difficultyMode: 1,
    resume: false,
    isEndless: false,
    autoWave: true
  })
  await leaveAllRooms()
  rooms.game = room
  eliteTestActive = true
  autoWaveActive = true
  clearGameReconnection()
  return room
}

export function isAutoWaveActive(): boolean {
  return autoWaveActive && !!rooms.game && rooms.game.connection.isOpen
}

export function isEliteTestActive(): boolean {
  return eliteTestActive && !!rooms.game && rooms.game.connection.isOpen
}

export function sendEliteTest(design: string, opponent: EliteTestOpponent) {
  lastEliteTest = { design, opponent }
  rooms.game?.send(Transfer.TEST_ELITE_DESIGN, lastEliteTest)
}

export function resendLastEliteTest() {
  if (lastEliteTest) rooms.game?.send(Transfer.TEST_ELITE_DESIGN, lastEliteTest)
}

export function beginEliteTest() {
  rooms.game?.send(Transfer.BEGIN_ELITE_TEST)
}

export function hasLastEliteTest(): boolean {
  return lastEliteTest != null
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
export const sendMaintenanceOrder = noop
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
