import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { Tooltip } from "react-tooltip"
import pkg from "../../../../package.json"
import { SynergyTriggers } from "../../../config"
import { RELICS } from "../../../core/relics"
import { ALL_SPIRE_CLASSES, SpireClass } from "../../../core/spire-classes"
import { computeSynergies } from "../../../models/colyseus-models/synergies"
import PokemonFactory from "../../../models/pokemon-factory"
import { DungeonPMDO } from "../../../types/enum/Dungeon"
import { EloRank } from "../../../types/enum/EloRank"
import { type SynergyGem, SynergyGivenByGem } from "../../../types/enum/Item"
import { Pkm, PkmIndex } from "../../../types/enum/Pokemon"
import { Synergy } from "../../../types/enum/Synergy"
import { getAvatarSrc, getPortraitSrc } from "../../../utils/avatar"
import { useAppDispatch, useAppSelector } from "../hooks"
import {
  authenticateUser,
  clearGameReconnection,
  client,
  createAutoWaveRoom,
  getIdToken,
  joinGame,
  spectateGame,
  waitForFirebaseAuth
} from "../network"
import { changeName } from "../stores/NetworkStore"
import SynergyIcon from "./component/icons/synergy-icon"
import { MainSidebar } from "./component/main-sidebar/main-sidebar"
import { addIconsToDescription } from "./utils/descriptions"
import { cc } from "./utils/jsx"
import { LocalStoreKeys, localStore } from "./utils/store"
import "./lobby.css"

interface SavedRunSummary {
  odToken: string
  savedAt: string
  currentAct: number
  currentFloor: number
  difficultyMode: number
  runHP: number
  teamPreview: string[]
  isEndless?: boolean
}

const DIFFICULTY_LABELS: Record<number, string> = {
  0: "Easy",
  1: "Normal",
  2: "Hard",
  3: "Impossible"
}

const ASCENSION_RANKS: { rank: EloRank; name: string; description: string }[] =
  [
    {
      rank: EloRank.LEVEL_BALL,
      name: "Level Ball",
      description: "Coming soon."
    },
    { rank: EloRank.NET_BALL, name: "Net Ball", description: "Coming soon." },
    {
      rank: EloRank.SAFARI_BALL,
      name: "Safari Ball",
      description: "Coming soon."
    },
    { rank: EloRank.LOVE_BALL, name: "Love Ball", description: "Coming soon." },
    {
      rank: EloRank.PREMIER_BALL,
      name: "Premier Ball",
      description: "Coming soon."
    },
    {
      rank: EloRank.QUICK_BALL,
      name: "Quick Ball",
      description: "Coming soon."
    },
    { rank: EloRank.POKE_BALL, name: "Poke Ball", description: "Coming soon." },
    {
      rank: EloRank.SUPER_BALL,
      name: "Super Ball",
      description: "Coming soon."
    },
    {
      rank: EloRank.ULTRA_BALL,
      name: "Ultra Ball",
      description: "Coming soon."
    },
    {
      rank: EloRank.MASTER_BALL,
      name: "Master Ball",
      description: "Coming soon."
    },
    {
      rank: EloRank.BEAST_BALL,
      name: "Beast Ball",
      description: "Coming soon."
    }
  ]

const HATCH_POOL: Pkm[] = [
  Pkm.TYMPOLE,
  Pkm.AXEW,
  Pkm.DREEPY,
  Pkm.SNIVY,
  Pkm.SCORBUNNY,
  Pkm.POPPLIO,
  Pkm.GOTHITA,
  Pkm.ROWLET,
  Pkm.FROAKIE,
  Pkm.TEPIG,
  Pkm.GRUBBIN,
  Pkm.SCATTERBUG
]
const UNIQUE_POOL: Pkm[] = [
  Pkm.ABSOL,
  Pkm.LAPRAS,
  Pkm.SCYTHER,
  Pkm.HERACROSS,
  Pkm.ROTOM,
  Pkm.MIMIKYU,
  Pkm.SPIRITOMB,
  Pkm.HAWLUCHA,
  Pkm.KANGASKHAN,
  Pkm.PINSIR,
  Pkm.MAWILE,
  Pkm.SKARMORY,
  Pkm.TORKOAL,
  Pkm.TROPIUS,
  Pkm.DRAMPA
]
const LEGENDARY_POOL: Pkm[] = [
  Pkm.MEWTWO,
  Pkm.RAYQUAZA,
  Pkm.KYOGRE,
  Pkm.GROUDON,
  Pkm.LUGIA,
  Pkm.CELEBI,
  Pkm.DARKRAI,
  Pkm.GIRATINA,
  Pkm.DIALGA,
  Pkm.PALKIA,
  Pkm.RESHIRAM,
  Pkm.ZEKROM,
  Pkm.XERNEAS,
  Pkm.YVELTAL,
  Pkm.ZACIAN
]
const CURRENT_VERSION = pkg.version
const CURRENT_PATCH = CURRENT_VERSION.split(".").slice(0, 2).join(".")

function pickRandFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function eliteSpriteSrc(pkm: Pkm): string {
  const idx = PkmIndex[pkm] ?? "0000"
  return `assets/ui/elite-sprites-v2/${idx}.png`
}

// Reverse lookup from a stored avatar sprite string (e.g. "0019/Normal" or
// "0019/0001/Normal") back to its Pkm, for loading the saved avatar from the DB.
const INDEX_TO_PKM: Record<string, Pkm> = {}
for (const [pkm, idx] of Object.entries(PkmIndex))
  INDEX_TO_PKM[idx] = pkm as Pkm
function avatarStringToPkm(avatar: string): Pkm | undefined {
  const parts = avatar.split("/")
  if (parts.length < 2) return undefined
  // Drop the trailing emotion (e.g. "Normal"); rejoin index parts with "-".
  return INDEX_TO_PKM[parts.slice(0, -1).join("-")]
}

const PAC_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  buffed: { bg: "#2d6a2d", text: "#7fff7f" },
  nerfed: { bg: "#6a2d2d", text: "#ff7f7f" },
  changed: { bg: "#6a5a2d", text: "#ffd27f" },
  removed: { bg: "#4a2d4a", text: "#d07fd0" },
  info: { bg: "#2d4a6a", text: "#7fbfff" },
  new: { bg: "#1d6e6e", text: "#6ffaff" }
}

function PacTag({
  type
}: {
  type: "buffed" | "nerfed" | "changed" | "removed" | "info" | "new"
}) {
  const colors = PAC_TAG_COLORS[type]
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        backgroundColor: colors.bg,
        color: colors.text,
        verticalAlign: "middle"
      }}
    >
      {type}
    </span>
  )
}

export default function SpireLobby() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const uid = useAppSelector((state) => state.network.uid)
  // NOTE: do NOT read state.network.displayName — it is the Firebase/Google real
  // name (doxxing risk). The in-game name lives in `playerName` (DB-backed).
  const dispatch = useAppDispatch()
  const [starting, setStarting] = useState(false)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [serverStatus, setServerStatus] = useState<{
    ccu: number
    totalAccounts: number
  } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [playerName, setPlayerName] = useState(
    () => localStore.get(LocalStoreKeys.SPIRE_PLAYER_NAME) ?? "Username"
  )
  const [avatarPkm, setAvatarPkm] = useState<Pkm>(
    () =>
      (localStore.get(LocalStoreKeys.SPIRE_PLAYER_AVATAR) as Pkm) || Pkm.RATTATA
  )
  const [playerRegion, setPlayerRegion] = useState(
    () => localStore.get(LocalStoreKeys.SPIRE_PLAYER_REGION) ?? "town"
  )
  const [regionLoaded, setRegionLoaded] = useState(false)
  const [nameLoaded, setNameLoaded] = useState(false)
  const [avatarLoaded, setAvatarLoaded] = useState(false)
  const [savedRun, setSavedRun] = useState<SavedRunSummary | null>(null)
  const [loadingSave, setLoadingSave] = useState(true)
  const [confirmOverwrite, setConfirmOverwrite] = useState<number | null>(null)
  // Spire-class chosen for the run being launched, carried through the saved-run / active-session confirm dialogs
  const [pendingSpireClass, setPendingSpireClass] = useState<SpireClass | null>(
    null
  )
  const [confirmActiveSession, setConfirmActiveSession] = useState<{
    difficultyMode: number
    resume: boolean
    isEndless: boolean
    spireClass: SpireClass | null
  } | null>(null)
  const [lostRunPopup, setLostRunPopup] = useState<
    "found" | "not-found" | "error" | "searching" | null
  >(null)
  const [hasHardWin, setHasHardWin] = useState(false)
  const [endlessEnabled, setEndlessEnabled] = useState(true)
  const [publicRuns, setPublicRuns] = useState<
    {
      roomId: string
      ownerName: string
      difficultyMode: number
      isEndless?: boolean
      currentAct: number
      currentFloor: number
      runHP: number
      spectatorCount: number
    }[]
  >([])
  const [joiningSpectate, setJoiningSpectate] = useState(false)

  useEffect(() => {
    // On a page refresh Redux resets and Firebase restores the session
    // asynchronously. Wait for the initial auth state: a restored user is
    // logged back in (stays in the lobby); no user → back to the login page.
    // Guests reaching the lobby via "Play as Guest" already have a uid here.
    if (uid) return
    let cancelled = false
    waitForFirebaseAuth().then((user) => {
      if (cancelled) return
      if (user) {
        authenticateUser()
      } else {
        navigate("/")
      }
    })
    return () => {
      cancelled = true
    }
  }, [uid])

  useEffect(() => {
    fetch("/status")
      .then((r) => r.json())
      .then((data) => setServerStatus(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch("/api/endless-enabled")
      .then((r) => r.json())
      .then((data) => setEndlessEnabled(data?.enabled !== false))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!uid || uid === "local-player") return
    fetch(`/api/user-role/${uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.role === "ADMIN") setIsAdmin(true)
      })
      .catch(() => {})
  }, [uid])

  useEffect(() => {
    if (!uid || uid === "local-player") return
    fetch(`/api/spire-stats/${uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.hard?.wins > 0) setHasHardWin(true)
      })
      .catch(() => {})
  }, [uid])

  useEffect(() => {
    localStore.set(LocalStoreKeys.SPIRE_PLAYER_NAME, playerName)
    const trimmed = playerName.trim()
    if (trimmed && trimmed !== "Username" && trimmed !== "Player") {
      dispatch(changeName(trimmed))
      // Persist the chosen name to the DB (debounced) so it's searchable
      // even if the player never starts a run. Guests are not saved.
      // Gated on nameLoaded so the local value can't overwrite the DB before
      // the DB load completes (and so a wiped "Player" name isn't re-seeded).
      if (nameLoaded && uid && uid !== "local-player") {
        const handle = setTimeout(() => {
          fetch(`/api/player-name/${uid}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmed })
          }).catch(() => {})
        }, 600)
        return () => clearTimeout(handle)
      }
    }
  }, [playerName, uid, nameLoaded])

  useEffect(() => {
    localStore.set(LocalStoreKeys.SPIRE_PLAYER_AVATAR, avatarPkm)
    // Persist avatar to the DB (sprite-string form), gated on avatarLoaded so
    // the local value can't overwrite the DB before the load completes.
    if (avatarLoaded && uid && uid !== "local-player") {
      const idx = PkmIndex[avatarPkm]
      if (idx) {
        fetch(`/api/player-avatar/${uid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar: `${idx.replace("-", "/")}/Normal` })
        }).catch(() => {})
      }
    }
  }, [avatarPkm, uid, avatarLoaded])

  useEffect(() => {
    localStore.set(LocalStoreKeys.SPIRE_PLAYER_REGION, playerRegion)
    if (regionLoaded && uid && uid !== "local-player") {
      fetch(`/api/spire-region/${uid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: playerRegion })
      }).catch(() => {})
    }
  }, [playerRegion])

  useEffect(() => {
    clearGameReconnection()
  }, [])

  useEffect(() => {
    const es = new EventSource("/api/announcements/stream")
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.message) setAnnouncement(data.message)
      } catch {}
    }
    return () => es.close()
  }, [])

  function refreshRuns() {
    fetch("/api/public-runs")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPublicRuns(data)
      })
      .catch(() => {})
  }

  useEffect(() => {
    refreshRuns()
  }, [])

  useEffect(() => {
    const id = setInterval(refreshRuns, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!uid || uid === "local-player") {
      setRegionLoaded(true)
      return
    }
    fetch(`/api/spire-region/${uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.region) {
          setPlayerRegion(data.region)
          localStore.set(LocalStoreKeys.SPIRE_PLAYER_REGION, data.region)
        }
      })
      .catch(() => {})
      .finally(() => setRegionLoaded(true))
  }, [uid])

  // Load the saved player name from the DB. The DB wins for real names (so
  // names follow the account across devices), but the placeholder sentinels
  // ("Player"/"Username") are treated as unset — we keep the local name, which
  // the save effect then re-persists to the DB.
  useEffect(() => {
    if (!uid || uid === "local-player") {
      setNameLoaded(true)
      return
    }
    fetch(`/api/player-name/${uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (
          typeof data?.name === "string" &&
          data.name.length > 0 &&
          data.name !== "Player" &&
          data.name !== "Username"
        ) {
          setPlayerName(data.name)
          localStore.set(LocalStoreKeys.SPIRE_PLAYER_NAME, data.name)
        }
      })
      .catch(() => {})
      .finally(() => setNameLoaded(true))
  }, [uid])

  // Load the saved avatar from the DB and map the sprite string back to a Pkm.
  useEffect(() => {
    if (!uid || uid === "local-player") {
      setAvatarLoaded(true)
      return
    }
    fetch(`/api/player-avatar/${uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.avatar === "string") {
          const pkm = avatarStringToPkm(data.avatar)
          if (pkm) {
            setAvatarPkm(pkm)
            localStore.set(LocalStoreKeys.SPIRE_PLAYER_AVATAR, pkm)
          }
        }
      })
      .catch(() => {})
      .finally(() => setAvatarLoaded(true))
  }, [uid])

  useEffect(() => {
    if (!uid || uid === "local-player") {
      setLoadingSave(false)
      return
    }
    const controller = new AbortController()
    fetch(`/api/saved-run/${uid}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) setSavedRun(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setSavedRun(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSave(false)
      })
    return () => controller.abort()
  }, [uid])

  const avatarIndex = PkmIndex[avatarPkm] ?? PkmIndex[Pkm.RATTATA]
  const avatarString = `${avatarIndex.replace("-", "/")}/Normal`

  const [nameWarning, setNameWarning] = useState(false)

  async function createRoom(
    difficultyMode: number,
    resume: boolean,
    isEndless: boolean = false,
    skipActiveCheck: boolean = false,
    spireClass: SpireClass | null = null,
    isTutorial: boolean = false
  ) {
    if (starting) return
    const name = playerName.trim()
    if (!name || name === "Username" || name === "Player") {
      setNameWarning(true)
      return
    }
    const odToken = uid || "local-player"
    // One active session per account: warn before kicking another open tab/session.
    if (!skipActiveCheck && odToken !== "local-player") {
      try {
        const res = await fetch(`/api/active-game/${odToken}`)
        const { active } = await res.json()
        if (active) {
          setConfirmActiveSession({
            difficultyMode,
            resume,
            isEndless,
            spireClass
          })
          return
        }
      } catch {
        // If the check fails, fall through — the server still enforces one room.
      }
    }
    setStarting(true)
    const idToken = await getIdToken()
    try {
      const room = await client.create("game", {
        idToken,
        odToken,
        displayName: name,
        users: {
          [odToken]: {
            uid: odToken,
            name,
            elo: 1000,
            games: 0,
            avatar: avatarString,
            isBot: false
          }
        },
        preparationId: "spire-local",
        name: "PokemonAutoSpire",
        ownerName: name,
        noElo: true,
        gameMode: "CUSTOM_LOBBY",
        specialGameRule: null,
        minRank: null,
        maxRank: null,
        tournamentId: null,
        bracketId: null,
        difficultyMode,
        resume,
        isEndless,
        isSpire: spireClass != null,
        spireClass,
        isTutorial
      })
      joinGame(room as any)
      navigate("/game")
    } catch (err) {
      console.error("Failed to start game:", err)
      setStarting(false)
    }
  }

  function startRun(difficultyMode: number) {
    setPendingSpireClass(null)
    if (savedRun) {
      setConfirmOverwrite(difficultyMode)
    } else {
      createRoom(difficultyMode, false)
    }
  }

  // Tutorial: a guided scripted run. It is never saved and never overwrites the
  // player's real saved run, so it skips the overwrite confirmation entirely.
  function startTutorial() {
    setPendingSpireClass(null)
    // skipActiveCheck=true: the active-session confirm path doesn't carry the
    // tutorial flag, and a tutorial is unsaved/harmless, so bypass it entirely.
    createRoom(1, false, false, true, null, true)
  }

  // Spire Mode: launch a run with the chosen class (difficulty defaults to Normal for now).
  function startSpireRun(spireClass: SpireClass) {
    setPendingSpireClass(spireClass)
    if (savedRun) {
      setConfirmOverwrite(1)
    } else {
      createRoom(1, false, false, false, spireClass)
    }
  }

  async function startAutoWave() {
    if (starting) return
    const name = playerName.trim()
    if (!name || name === "Username" || name === "Player") {
      setNameWarning(true)
      return
    }
    setStarting(true)
    try {
      await createAutoWaveRoom({
        uid: uid || "local-player",
        displayName: name,
        avatar: avatarString
      })
      navigate("/game")
    } catch (err) {
      console.error("Failed to start AutoWave:", err)
      setStarting(false)
    }
  }

  function confirmNewRun() {
    if (confirmOverwrite === null) return
    const diff = confirmOverwrite
    const endless = diff === -1
    const spireClass = pendingSpireClass
    setConfirmOverwrite(null)
    setPendingSpireClass(null)
    fetch(`/api/saved-run/${uid}`, { method: "DELETE" })
      .then(() => {
        setSavedRun(null)
        createRoom(endless ? 1 : diff, false, endless, false, spireClass)
      })
      .catch(() =>
        createRoom(endless ? 1 : diff, false, endless, false, spireClass)
      )
  }

  function confirmKickActiveSession() {
    if (!confirmActiveSession) return
    const c = confirmActiveSession
    setConfirmActiveSession(null)
    createRoom(c.difficultyMode, c.resume, c.isEndless, true, c.spireClass)
  }

  function startEndlessRun() {
    setPendingSpireClass(null)
    if (savedRun) {
      setConfirmOverwrite(-1)
    } else {
      createRoom(1, false, true)
    }
  }

  function resumeRun() {
    if (!savedRun) return
    createRoom(savedRun.difficultyMode, true, savedRun.isEndless ?? false)
  }

  function findLostRun() {
    if (!uid || uid === "local-player") {
      setLostRunPopup("error")
      return
    }
    setLostRunPopup("searching")
    fetch(`/api/saved-run/${uid}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.odToken) {
          setSavedRun(data)
          setLostRunPopup("found")
        } else {
          setLostRunPopup("not-found")
        }
      })
      .catch(() => setLostRunPopup("error"))
  }

  function abandonRun() {
    if (!uid) return
    fetch(`/api/saved-run/${uid}`, { method: "DELETE" })
      .then(() => setSavedRun(null))
      .catch(() => {})
  }

  async function watchRun(roomId: string) {
    if (joiningSpectate) return
    setJoiningSpectate(true)
    try {
      const room = await spectateGame(roomId)
      navigate("/game")
    } catch (err) {
      console.error("Failed to spectate:", err)
      setJoiningSpectate(false)
    }
  }

  return (
    <main className="lobby">
      <MainSidebar page="main_lobby" leave={() => {}} leaveLabel="Exit" />
      <div
        style={{
          position: "fixed",
          bottom: "16px",
          right: "16px",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
      >
        {isAdmin && serverStatus && (
          <span
            style={{
              fontSize: "12px",
              color: "#aaa",
              background: "rgba(0,0,0,0.5)",
              padding: "6px 10px",
              borderRadius: "6px"
            }}
          >
            {serverStatus.ccu} in game &middot; {serverStatus.totalAccounts}{" "}
            accounts
          </span>
        )}
        <a
          href="https://discord.gg/EXnfYhwZte"
          target="_blank"
          rel="noopener noreferrer"
          className="lobby-discord-button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "6px",
            background: "#5865F2",
            color: "white",
            textDecoration: "none",
            fontWeight: "bold",
            fontSize: "14px"
          }}
        >
          <img
            src="assets/ui/discord.svg"
            alt=""
            style={{ width: 20, height: 20 }}
          />
          Discord
        </a>
      </div>
      <div className="lobby-container">
        <SpireLobbyContent
          startRun={startRun}
          startSpireRun={startSpireRun}
          startAutoWave={startAutoWave}
          startEndlessRun={startEndlessRun}
          startTutorial={startTutorial}
          resumeRun={resumeRun}
          abandonRun={abandonRun}
          starting={starting}
          playerName={playerName}
          setPlayerName={setPlayerName}
          avatarPkm={avatarPkm}
          setAvatarPkm={setAvatarPkm}
          avatarIndex={avatarIndex}
          savedRun={savedRun}
          loadingSave={loadingSave}
          confirmOverwrite={confirmOverwrite}
          setConfirmOverwrite={setConfirmOverwrite}
          confirmNewRun={confirmNewRun}
          confirmActiveSession={confirmActiveSession}
          setConfirmActiveSession={setConfirmActiveSession}
          confirmKickActiveSession={confirmKickActiveSession}
          findLostRun={findLostRun}
          lostRunPopup={lostRunPopup}
          setLostRunPopup={setLostRunPopup}
          playerRegion={playerRegion}
          setPlayerRegion={setPlayerRegion}
          hasHardWin={hasHardWin}
          endlessEnabled={endlessEnabled}
          isAdmin={isAdmin}
          nameWarning={nameWarning}
          setNameWarning={setNameWarning}
          publicRuns={publicRuns}
          joiningSpectate={joiningSpectate}
          watchRun={watchRun}
          refreshRuns={refreshRuns}
          announcement={announcement}
          setAnnouncement={setAnnouncement}
        />
      </div>
    </main>
  )
}

function SpireLobbyContent({
  startRun,
  startSpireRun,
  startAutoWave,
  startEndlessRun,
  startTutorial,
  resumeRun,
  abandonRun,
  starting,
  playerName,
  setPlayerName,
  avatarPkm,
  setAvatarPkm,
  avatarIndex,
  savedRun,
  loadingSave,
  confirmOverwrite,
  setConfirmOverwrite,
  confirmNewRun,
  confirmActiveSession,
  setConfirmActiveSession,
  confirmKickActiveSession,
  findLostRun,
  lostRunPopup,
  setLostRunPopup,
  playerRegion,
  setPlayerRegion,
  hasHardWin,
  endlessEnabled,
  isAdmin,
  nameWarning,
  setNameWarning,
  publicRuns,
  joiningSpectate,
  watchRun,
  refreshRuns,
  announcement,
  setAnnouncement
}: {
  startRun: (difficultyMode: number) => void
  startSpireRun: (spireClass: SpireClass) => void
  startAutoWave: () => void
  startEndlessRun: () => void
  startTutorial: () => void
  resumeRun: () => void
  abandonRun: () => void
  starting: boolean
  playerName: string
  setPlayerName: (name: string) => void
  avatarPkm: Pkm
  setAvatarPkm: (pkm: Pkm) => void
  avatarIndex: string
  savedRun: SavedRunSummary | null
  loadingSave: boolean
  confirmOverwrite: number | null
  setConfirmOverwrite: (v: number | null) => void
  confirmNewRun: () => void
  confirmActiveSession: {
    difficultyMode: number
    resume: boolean
    isEndless: boolean
    spireClass: SpireClass | null
  } | null
  setConfirmActiveSession: (
    v: {
      difficultyMode: number
      resume: boolean
      isEndless: boolean
      spireClass: SpireClass | null
    } | null
  ) => void
  confirmKickActiveSession: () => void
  findLostRun: () => void
  lostRunPopup: "found" | "not-found" | "error" | "searching" | null
  setLostRunPopup: (
    v: "found" | "not-found" | "error" | "searching" | null
  ) => void
  playerRegion: string
  setPlayerRegion: (region: string) => void
  hasHardWin: boolean
  endlessEnabled: boolean
  isAdmin: boolean
  nameWarning: boolean
  setNameWarning: (v: boolean) => void
  publicRuns: {
    roomId: string
    ownerName: string
    difficultyMode: number
    isEndless?: boolean
    currentAct: number
    currentFloor: number
    runHP: number
    spectatorCount: number
  }[]
  joiningSpectate: boolean
  watchRun: (roomId: string) => void
  refreshRuns: () => void
  announcement: string | null
  setAnnouncement: (v: string | null) => void
}) {
  const [activeSection, setActive] = useState<string>("rooms")
  const [ascensionIndex, setAscensionIndex] = useState(0)
  const [runSortBy, setRunSortBy] = useState<"stage" | "difficulty">(
    () =>
      (localStore.get(LocalStoreKeys.SPIRE_RUN_SORT_BY) as
        | "stage"
        | "difficulty") ?? "stage"
  )
  const [runSortAsc, setRunSortAsc] = useState<boolean>(
    () => localStore.get(LocalStoreKeys.SPIRE_RUN_SORT_ASC) ?? false
  )
  const [runFilterDifficulty, setRunFilterDifficulty] = useState<number | null>(
    () => localStore.get(LocalStoreKeys.SPIRE_RUN_FILTER_DIFFICULTY) ?? null
  )
  // Left panel sub-tab: leaderboards (default) vs live runs
  const [boardTab, setBoardTab] = useState<"leaderboards" | "runs">(
    "leaderboards"
  )
  // Central Play panel tab: play (default) vs leaderboards (wider layout)
  const [playTab, setPlayTab] = useState<"play" | "leaderboards">("play")
  // Spire Mode: currently selected class card
  const [selectedSpireClass, setSelectedSpireClass] = useState<SpireClass>(
    SpireClass.IRONCLAD
  )
  const [showPatchPopup, setShowPatchPopup] = useState(false)
  const [showHotfixButton, setShowHotfixButton] = useState(false)
  const { t } = useTranslation()
  const selectedAscension = ASCENSION_RANKS[ascensionIndex]

  // Persist the Live Runs sort/filter preferences across sessions
  useEffect(() => {
    localStore.set(LocalStoreKeys.SPIRE_RUN_SORT_BY, runSortBy)
  }, [runSortBy])
  useEffect(() => {
    localStore.set(LocalStoreKeys.SPIRE_RUN_SORT_ASC, runSortAsc)
  }, [runSortAsc])
  useEffect(() => {
    localStore.set(
      LocalStoreKeys.SPIRE_RUN_FILTER_DIFFICULTY,
      runFilterDifficulty
    )
  }, [runFilterDifficulty])

  const uid = useAppSelector((state) => state.network.uid)
  const isGuest = !uid || uid === "local-player"

  useEffect(() => {
    if (isGuest) return
    const lastPatch = localStore.get(LocalStoreKeys.SPIRE_LAST_PATCH_SEEN)
    const lastVersion = localStore.get(LocalStoreKeys.SPIRE_LAST_VERSION_SEEN)
    if (lastPatch !== CURRENT_PATCH) {
      setShowPatchPopup(true)
    } else if (lastVersion !== CURRENT_VERSION) {
      setShowHotfixButton(true)
    }
    localStore.set(LocalStoreKeys.SPIRE_LAST_VERSION_SEEN, CURRENT_VERSION)
  }, [])

  return (
    <div className="main-lobby">
      <nav className="main-lobby-nav">
        <ul>
          <li
            onClick={() => setActive("leaderboard")}
            className={cc({ active: activeSection === "leaderboard" })}
          >
            <img width={32} height={32} src={`assets/ui/meta.svg`} />
            Leaderboards
          </li>
          <li
            onClick={() => setActive("rooms")}
            className={cc({ active: activeSection === "rooms" })}
          >
            <img width={32} height={32} src={`assets/ui/room.svg`} />
            Play
          </li>
          <li
            onClick={() => setActive("events")}
            className={cc({ active: activeSection === "events" })}
          >
            <img width={32} height={32} src={`assets/ui/chat.svg`} />
            Dev Notes
          </li>
        </ul>
      </nav>

      <section
        className={cc("leaderboard", {
          active: activeSection === "leaderboard"
        })}
      >
        <div
          className="my-container custom-bg hidden-scrollable"
          style={{
            padding: "12px 16px",
            color: "var(--color-fg-primary)",
            height: "100%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {/* Sub-tab toggle: Leaderboards (default) | Live Runs */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "10px" }}>
            <button
              className="bubbly"
              onClick={() => setBoardTab("leaderboards")}
              style={{
                flex: 1,
                fontSize: "13px",
                padding: "5px 10px",
                background: boardTab === "leaderboards" ? "#c0392b" : "#555",
                fontWeight: boardTab === "leaderboards" ? "bold" : "normal"
              }}
            >
              Leaderboards
            </button>
            <button
              className="bubbly"
              onClick={() => setBoardTab("runs")}
              style={{
                flex: 1,
                fontSize: "13px",
                padding: "5px 10px",
                background: boardTab === "runs" ? "#c0392b" : "#555",
                fontWeight: boardTab === "runs" ? "bold" : "normal"
              }}
            >
              Live Runs
            </button>
          </div>

          {boardTab === "leaderboards" && (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <ChampionDisplay />
              <ArceusRecordDisplay />
              <EndlessLeaderboardDisplay />
              <VictoryLeaderboardDisplay />
            </div>
          )}

          {boardTab === "runs" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px"
                }}
              >
                <h2 style={{ margin: 0, flex: 1 }}>Live Runs</h2>
                <button
                  className="bubbly"
                  onClick={refreshRuns}
                  style={{
                    fontSize: "11px",
                    padding: "3px 10px",
                    background: "#555"
                  }}
                >
                  Refresh
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "8px",
                  alignItems: "center",
                  flexWrap: "wrap"
                }}
              >
                <label style={{ fontSize: "12px" }}>Sort:</label>
                <select
                  value={runSortBy}
                  onChange={(e) =>
                    setRunSortBy(e.target.value as "stage" | "difficulty")
                  }
                  style={{
                    padding: "2px 6px",
                    fontSize: "12px",
                    background: "rgba(0,0,0,0.3)",
                    color: "white",
                    border: "1px solid #555",
                    borderRadius: "4px"
                  }}
                >
                  <option value="stage">Stage</option>
                  <option value="difficulty">Difficulty</option>
                </select>
                <button
                  onClick={() => setRunSortAsc((v) => !v)}
                  style={{
                    padding: "2px 6px",
                    fontSize: "12px",
                    background: "rgba(0,0,0,0.3)",
                    color: "white",
                    border: "1px solid #555",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  {runSortAsc ? "▲" : "▼"}
                </button>
                <label style={{ fontSize: "12px", marginLeft: "8px" }}>
                  Filter:
                </label>
                <select
                  value={runFilterDifficulty ?? "all"}
                  onChange={(e) =>
                    setRunFilterDifficulty(
                      e.target.value === "all" ? null : Number(e.target.value)
                    )
                  }
                  style={{
                    padding: "2px 6px",
                    fontSize: "12px",
                    background: "rgba(0,0,0,0.3)",
                    color: "white",
                    border: "1px solid #555",
                    borderRadius: "4px"
                  }}
                >
                  <option value="all">All</option>
                  <option value="0">Easy</option>
                  <option value="1">Normal</option>
                  <option value="2">Hard</option>
                  <option value="3">Impossible</option>
                  <option value="-1">Endless</option>
                </select>
                <span
                  style={{ marginLeft: "auto", fontSize: "12px", opacity: 0.6 }}
                >
                  {publicRuns.length} active
                </span>
              </div>

              {(() => {
                const filtered = publicRuns
                  .filter((r) => {
                    if (runFilterDifficulty === null) return true
                    if (runFilterDifficulty === -1) return !!r.isEndless
                    return (
                      !r.isEndless && r.difficultyMode === runFilterDifficulty
                    )
                  })
                  .sort((a, b) => {
                    const dir = runSortAsc ? 1 : -1
                    const stageA = a.currentAct * 100 + a.currentFloor
                    const stageB = b.currentAct * 100 + b.currentFloor
                    if (runSortBy === "difficulty") {
                      // Primary: difficulty group (toggle flips only this order).
                      const diff = (a.difficultyMode - b.difficultyMode) * dir
                      if (diff !== 0) return diff
                      // Secondary: stage, always furthest-first within a difficulty group.
                      return stageB - stageA
                    }
                    // Stage sort: furthest-first by default; toggle flips it.
                    return (stageA - stageB) * dir
                  })
                return filtered.length === 0 ? (
                  <span style={{ fontSize: "13px", opacity: 0.5 }}>
                    {publicRuns.length === 0
                      ? "No active runs"
                      : "No runs match filter"}
                  </span>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      flex: 1,
                      overflowY: "auto"
                    }}
                  >
                    {filtered.map((run) => (
                      <div
                        key={run.roomId}
                        className="my-box"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "6px 10px",
                          flexWrap: "wrap"
                        }}
                      >
                        <span
                          style={{
                            fontWeight: "bold",
                            fontSize: "13px",
                            minWidth: "90px",
                            display: "inline-block"
                          }}
                        >
                          {run.ownerName}
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "white",
                            minWidth: "65px",
                            display: "inline-block"
                          }}
                        >
                          {run.isEndless
                            ? "Endless"
                            : (DIFFICULTY_LABELS[run.difficultyMode] ??
                              "Normal")}
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            opacity: 0.8,
                            minWidth: "100px",
                            display: "inline-block"
                          }}
                        >
                          Act {run.currentAct} &middot; Floor {run.currentFloor}
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: run.runHP <= 30 ? "#e74c3c" : "#2ecc71"
                          }}
                        >
                          {run.runHP} HP
                        </span>
                        {run.spectatorCount > 0 && (
                          <span style={{ fontSize: "11px", opacity: 0.5 }}>
                            {run.spectatorCount} watching
                          </span>
                        )}
                        <button
                          disabled={joiningSpectate}
                          onClick={() => watchRun(run.roomId)}
                          style={{
                            marginLeft: "auto",
                            fontSize: "11px",
                            padding: "3px 6px",
                            background: "none",
                            border: "none",
                            color: "white",
                            cursor: "pointer"
                          }}
                        >
                          {joiningSpectate ? "Joining..." : "Watch"}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </section>

      <section className={cc("rooms", { active: activeSection === "rooms" })}>
        <div className="my-container room-menu custom-bg hidden-scrollable">
          {/* Central panel tabs: Play (default) | Leaderboards */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "10px" }}>
            <button
              className="bubbly"
              onClick={() => setPlayTab("play")}
              style={{
                flex: 1,
                fontSize: "13px",
                padding: "5px 10px",
                background: playTab === "play" ? "#c0392b" : "#555",
                fontWeight: playTab === "play" ? "bold" : "normal"
              }}
            >
              Play
            </button>
            <button
              className="bubbly"
              onClick={() => setPlayTab("leaderboards")}
              style={{
                flex: 1,
                fontSize: "13px",
                padding: "5px 10px",
                background: playTab === "leaderboards" ? "#c0392b" : "#555",
                fontWeight: playTab === "leaderboards" ? "bold" : "normal"
              }}
            >
              Leaderboards
            </button>
          </div>

          {playTab === "leaderboards" && (
            <div style={{ overflowY: "auto" }}>
              <ChampionDisplay wide />
              <ArceusRecordDisplay wide />
              <EndlessLeaderboardDisplay />
              <VictoryLeaderboardDisplay />
            </div>
          )}

          {playTab === "play" && (
            <>
              {/* Player identity bar (name / avatar / Home Town) — kept at the top
              of the Play tab, above the Saved Run panel */}
              <div
                className="my-box"
                style={{
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  flexWrap: "wrap"
                }}
              >
                <img
                  src={getPortraitSrc(avatarIndex)}
                  alt="avatar"
                  style={{ width: 40, height: 40, imageRendering: "pixelated" }}
                />
                <div
                  style={{ flex: 1, minWidth: "100px", position: "relative" }}
                >
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => {
                      setPlayerName(e.target.value)
                      setNameWarning(false)
                    }}
                    placeholder="Player Name"
                    maxLength={20}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      border: nameWarning
                        ? "1px solid #e74c3c"
                        : "1px solid #555",
                      background: "rgba(0,0,0,0.3)",
                      color: "white",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      boxSizing: "border-box"
                    }}
                  />
                  {nameWarning && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: "4px",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        backgroundColor: "#e74c3c",
                        color: "white",
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                        zIndex: 10
                      }}
                    >
                      Please choose a name before starting
                    </div>
                  )}
                </div>
                <select
                  value={avatarPkm}
                  onChange={(e) => {
                    const val = e.target.value as Pkm
                    if (val) setAvatarPkm(val)
                  }}
                  className="pokemon-typeahead"
                  style={{ maxWidth: "180px" }}
                >
                  <option value="" disabled>
                    {t("search_pokemon")}
                  </option>
                  {Object.keys(PkmIndex)
                    .filter((p) => p !== "DEFAULT" && p !== "EGG")
                    .sort((a, b) =>
                      t(`pkm.${a}` as any).localeCompare(t(`pkm.${b}` as any))
                    )
                    .map((p) => (
                      <option key={p} value={p}>
                        {t(`pkm.${p}` as any)}
                      </option>
                    ))}
                </select>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      opacity: 0.7,
                      whiteSpace: "nowrap"
                    }}
                  >
                    Home Town
                  </span>
                  <span
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "14px",
                      height: "14px",
                      borderRadius: "50%",
                      border: "1px solid #888",
                      fontSize: "10px",
                      color: "#aaa",
                      cursor: "pointer",
                      flexShrink: 0
                    }}
                    className="hometown-help"
                  >
                    ?
                    <span className="hometown-help-tooltip">
                      Your Home Town is the background shown when you start a
                      run. If you become Champion or Elite Four, challengers
                      will fight you here. Check the wiki for region previews.
                      It's purely cosmetic.
                    </span>
                  </span>
                </div>
                <select
                  value={playerRegion}
                  onChange={(e) => setPlayerRegion(e.target.value)}
                  className="pokemon-typeahead"
                  style={{ maxWidth: "180px" }}
                >
                  <option value="town">Default (Town)</option>
                  {Object.values(DungeonPMDO)
                    .sort((a, b) => a.localeCompare(b))
                    .map((d) => (
                      <option key={d} value={d}>
                        {d
                          .replace(/([A-Z])/g, " $1")
                          .replace(/(\d+)/g, " $1")
                          .trim()}
                      </option>
                    ))}
                </select>
              </div>

              <ul
                className="room-list"
                style={{
                  padding: 0,
                  marginTop: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                {/* Resume Run Panel */}
                <li style={{ listStyle: "none" }}>
                  <div
                    className="room-item my-box"
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: "12px",
                      alignItems: "center",
                      flexWrap: "wrap"
                    }}
                  >
                    <span
                      className="room-name"
                      style={{ color: savedRun ? "#f39c12" : "#888" }}
                    >
                      Saved Run
                    </span>
                    {savedRun ? (
                      <>
                        <div
                          style={{
                            display: "flex",
                            gap: "16px",
                            alignItems: "center",
                            fontSize: "13px",
                            opacity: 0.9
                          }}
                        >
                          <span>
                            Act {savedRun.currentAct} &middot; Floor{" "}
                            {savedRun.currentFloor}
                          </span>
                          <span>
                            {savedRun.isEndless
                              ? "Endless"
                              : (DIFFICULTY_LABELS[savedRun.difficultyMode] ??
                                "Normal")}
                          </span>
                          <span
                            style={{
                              color:
                                savedRun.runHP <= 30 ? "#e74c3c" : "#2ecc71"
                            }}
                          >
                            {savedRun.runHP} HP
                          </span>
                        </div>
                        {savedRun.teamPreview?.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              gap: "4px",
                              alignItems: "center"
                            }}
                          >
                            {savedRun.teamPreview.slice(0, 6).map((pkm, i) => {
                              const idx = PkmIndex[pkm as Pkm]
                              return idx ? (
                                <img
                                  key={i}
                                  src={getPortraitSrc(idx)}
                                  alt={pkm}
                                  title={t(`pkm.${pkm}` as any)}
                                  style={{
                                    width: 32,
                                    height: 32,
                                    imageRendering: "pixelated"
                                  }}
                                />
                              ) : null
                            })}
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginLeft: "auto"
                          }}
                        >
                          <button
                            className={cc("bubbly yellow", {
                              loading: starting
                            })}
                            disabled={starting}
                            onClick={resumeRun}
                          >
                            {starting ? "Loading..." : "Resume Run"}
                          </button>
                          <button
                            className="bubbly red"
                            onClick={abandonRun}
                            style={{ fontSize: "12px", padding: "4px 12px" }}
                          >
                            Abandon
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: "13px", opacity: 0.6 }}>
                          No saved run
                        </span>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginLeft: "auto"
                          }}
                        >
                          <button
                            className="bubbly"
                            onClick={findLostRun}
                            disabled={lostRunPopup === "searching"}
                            style={{
                              backgroundColor: "#2980b9",
                              fontSize: "12px",
                              padding: "4px 12px"
                            }}
                          >
                            {lostRunPopup === "searching"
                              ? "Searching..."
                              : "Find Lost Run"}
                          </button>
                          <button
                            className="bubbly"
                            disabled
                            style={{
                              backgroundColor: "#555",
                              cursor: "not-allowed"
                            }}
                          >
                            Resume Run
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </li>

                {/* New Run Panel */}
                <li style={{ listStyle: "none" }}>
                  <div
                    className="room-item my-box"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      alignItems: "center"
                    }}
                  >
                    <span
                      className="room-name"
                      style={{
                        width: "100%",
                        position: "relative",
                        textAlign: "center"
                      }}
                    >
                      <span
                        style={{
                          fontSize: "clamp(14px, 1.25vw, 20px)",
                          fontWeight: "bold"
                        }}
                      >
                        Pokemon Auto Spire
                      </span>
                      <span
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "50%",
                          transform: "translateY(-50%)",
                          display: "inline-flex",
                          alignItems: "center"
                        }}
                      >
                        v{CURRENT_VERSION}
                        {showHotfixButton && (
                          <span
                            style={{
                              marginLeft: "8px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: "bold",
                              backgroundColor: "#2d6a2d",
                              color: "#7fff7f",
                              verticalAlign: "middle",
                              cursor: "pointer"
                            }}
                            onClick={() => setShowHotfixButton(false)}
                          >
                            NEW HOTFIX
                          </span>
                        )}
                      </span>
                    </span>
                    <div
                      className="difficulty-buttons-row"
                      style={{ display: "flex", gap: "8px", maxWidth: "100%" }}
                    >
                      <button
                        className={cc("bubbly", { loading: starting })}
                        disabled={starting}
                        onClick={() => startRun(0)}
                        style={{
                          backgroundColor: "#27ae60",
                          minWidth: "150px"
                        }}
                      >
                        {starting ? t("loading") : "Start Easy"}
                      </button>
                      <button
                        className={cc("bubbly yellow", { loading: starting })}
                        disabled={starting}
                        onClick={() => startRun(1)}
                        style={{ minWidth: "150px" }}
                      >
                        {starting ? t("loading") : "Start Normal"}
                      </button>
                      <button
                        className={cc("bubbly red", { loading: starting })}
                        disabled={starting}
                        onClick={() => startRun(2)}
                        style={{ minWidth: "150px" }}
                      >
                        {starting ? t("loading") : "Start Hard"}
                      </button>
                      <button
                        className={cc("bubbly", { loading: starting })}
                        disabled={starting || (!hasHardWin && !isAdmin)}
                        onClick={() => startRun(3)}
                        style={{
                          backgroundColor: "#222222",
                          minWidth: "150px",
                          opacity: !hasHardWin && !isAdmin ? 0.4 : 1,
                          cursor:
                            !hasHardWin && !isAdmin ? "not-allowed" : "pointer"
                        }}
                      >
                        {starting ? t("loading") : "Start Impossible"}
                      </button>
                    </div>
                    {/* Shown below the row (not a hover tooltip) — the scrollable
                    button row clips overflowing content, and touch devices
                    can't hover anyway. */}
                    {!hasHardWin && !isAdmin && (
                      <span style={{ fontSize: "11px", opacity: 0.6 }}>
                        Defeat Hard mode to unlock Impossible
                      </span>
                    )}
                  </div>
                </li>

                {/* Tutorial + Endless Row (stacks vertically on phones via .lobby-mode-row) */}
                <li
                  className="lobby-mode-row"
                  style={{ listStyle: "none", display: "flex", gap: "8px" }}
                >
                  <div
                    className="room-item my-box"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      alignItems: "center",
                      flex: 1
                    }}
                  >
                    <span className="room-name">Tutorial</span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px"
                      }}
                    >
                      <button
                        className={cc("bubbly", { loading: starting })}
                        disabled={starting}
                        onClick={startTutorial}
                        style={{ backgroundColor: "#3498db" }}
                      >
                        {starting ? t("loading") : "Start Tutorial"}
                      </button>
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        opacity: 0.7,
                        textAlign: "center",
                        maxWidth: "400px"
                      }}
                    >
                      Learn how to play Pokemon Auto Spire, great for all new
                      players whether you have pokemon auto chess experience or
                      not.
                    </span>
                  </div>

                  <div
                    className="room-item my-box"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      alignItems: "center",
                      flex: 1
                    }}
                  >
                    <span className="room-name">Endless Mode (test demo)</span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px"
                      }}
                    >
                      <span
                        style={{
                          position: "relative",
                          display: "inline-block"
                        }}
                        className={
                          !endlessEnabled && !isAdmin ? "hometown-help" : ""
                        }
                      >
                        <button
                          className={cc("bubbly", { loading: starting })}
                          disabled={starting || (!endlessEnabled && !isAdmin)}
                          onClick={startEndlessRun}
                          style={{
                            backgroundColor: "#1abc9c",
                            opacity: !endlessEnabled && !isAdmin ? 0.4 : 1,
                            cursor:
                              !endlessEnabled && !isAdmin
                                ? "not-allowed"
                                : "pointer"
                          }}
                        >
                          {starting ? "Loading..." : "Start Endless"}
                        </button>
                        {!endlessEnabled && !isAdmin && (
                          <span className="hometown-help-tooltip">
                            Endless mode is currently disabled
                          </span>
                        )}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        opacity: 0.7,
                        textAlign: "center",
                        maxWidth: "400px"
                      }}
                    >
                      Battle through endless acts of scaling difficulty. Fight
                      teams from other players who reached the same stage. I
                      expect this to be a catastrophe.
                    </span>
                  </div>
                </li>
              </ul>

              {/* Spire Mode — class selection. Admin-only while in development
              (server enforces the same gate in game-room.ts onCreate). */}
              {isAdmin && (
                <div
                  className="my-box"
                  style={{ marginTop: "12px", padding: "12px 14px" }}
                >
                  <h2 style={{ margin: "0 0 8px" }}>Spire Mode</h2>
                  <h3
                    style={{
                      margin: "0 0 6px",
                      fontSize: "18px",
                      opacity: 0.85
                    }}
                  >
                    Choose your class
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      overflowX: "auto",
                      paddingBottom: "6px"
                    }}
                  >
                    {ALL_SPIRE_CLASSES.map((cls) => {
                      const selected = selectedSpireClass === cls.id
                      const relic = RELICS[cls.startingRelic]
                      return (
                        <div
                          key={cls.id}
                          onClick={() => setSelectedSpireClass(cls.id)}
                          style={{
                            cursor: "pointer",
                            flex: "1 0 200px",
                            minWidth: "200px",
                            border: selected
                              ? "2px solid #f1c40f"
                              : "2px solid #444",
                            borderRadius: "6px",
                            padding: "8px 10px",
                            background: selected
                              ? "rgba(241,196,15,0.12)"
                              : "rgba(0,0,0,0.25)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "6px"
                            }}
                          >
                            <strong style={{ fontSize: "14px" }}>
                              {cls.name}
                            </strong>
                            <span style={{ fontSize: "11px", opacity: 0.6 }}>
                              {cls.theme}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              gap: "3px",
                              alignItems: "center"
                            }}
                          >
                            {cls.synergies.map((syn) => (
                              <SynergyIcon key={syn} type={syn} size="22px" />
                            ))}
                          </div>
                          <div
                            data-tooltip-id="spire-relic-tooltip"
                            data-relic-id={cls.startingRelic}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              cursor: "help"
                            }}
                          >
                            <img
                              src={`/assets/relics/${cls.startingRelic}.png`}
                              alt={relic.name}
                              style={{
                                width: 28,
                                height: 28,
                                imageRendering: "pixelated"
                              }}
                              onError={(e) => {
                                ;(
                                  e.target as HTMLImageElement
                                ).style.visibility = "hidden"
                              }}
                            />
                            <span style={{ fontSize: "11px" }}>
                              <span style={{ opacity: 0.6 }}>
                                Starting Relic:
                              </span>{" "}
                              {relic.name}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <Tooltip
                    id="spire-relic-tooltip"
                    className="custom-theme-tooltip"
                    render={({ activeAnchor }) => {
                      const id = activeAnchor?.getAttribute("data-relic-id")
                      const r = id
                        ? RELICS[id as keyof typeof RELICS]
                        : undefined
                      if (!r) return null
                      return (
                        <div style={{ maxWidth: 240 }}>
                          <strong>{r.name}</strong>
                          <p
                            className="relic-effect-desc"
                            style={{ margin: "4px 0 0" }}
                          >
                            {addIconsToDescription(r.description)}
                          </p>
                        </div>
                      )
                    }}
                  />
                  {/* Ascension selection — choose after your class, before entering */}
                  <div
                    style={{
                      marginTop: "16px",
                      paddingTop: "12px",
                      borderTop: "1px solid #444"
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 8px",
                        fontSize: "18px",
                        opacity: 0.85
                      }}
                    >
                      Ascension Level
                    </h3>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          flexShrink: 0
                        }}
                      >
                        <img
                          src={`assets/ranks/${selectedAscension.rank}.svg`}
                          alt={selectedAscension.name}
                          style={{ width: "32px", height: "32px" }}
                        />
                        <select
                          value={ascensionIndex}
                          onChange={(e) =>
                            setAscensionIndex(Number(e.target.value))
                          }
                          style={{
                            padding: "6px 10px",
                            borderRadius: "4px",
                            border: "1px solid #555",
                            background: "rgba(0,0,0,0.3)",
                            color: "white",
                            fontSize: "14px",
                            fontFamily: "inherit",
                            minWidth: "140px"
                          }}
                        >
                          {ASCENSION_RANKS.map((r, i) => (
                            <option key={r.rank} value={i}>
                              {i + 1}. {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span style={{ fontSize: "12px", opacity: 0.7, flex: 1 }}>
                        {selectedAscension.description}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      marginTop: "12px"
                    }}
                  >
                    <button
                      className={cc("bubbly green", { loading: starting })}
                      disabled={starting}
                      onClick={() => startSpireRun(selectedSpireClass)}
                      style={{ fontSize: "16px", padding: "8px 24px" }}
                    >
                      {starting ? "Loading..." : "Enter the Spire"}
                    </button>
                  </div>
                </div>
              )}
              {isAdmin && (
                <div
                  className="my-box"
                  style={{
                    marginTop: "12px",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap"
                  }}
                >
                  <div>
                    <h2 style={{ margin: "0 0 6px" }}>AutoWave</h2>
                    <p style={{ margin: 0, fontSize: "13px", opacity: 0.75 }}>
                      Predict the outcome of elite fights
                    </p>
                  </div>
                  <button
                    className={cc("bubbly blue", { loading: starting })}
                    disabled={starting}
                    onClick={startAutoWave}
                    style={{ fontSize: "16px", padding: "8px 24px" }}
                  >
                    {starting ? "Loading..." : "Play AutoWave"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section
        className={cc("events", {
          active: activeSection === "events"
        })}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          overflow: "auto"
        }}
      >
        <div
          className="my-container custom-bg"
          style={{ padding: "12px 16px", fontSize: "14px", lineHeight: "1.6" }}
        >
          <h2>Dev Notes</h2>
          <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
            <li>
              Join the{" "}
              <a
                href="https://discord.gg/EXnfYhwZte"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#7289da" }}
              >
                Pokemon Auto Spire Discord
              </a>
            </li>
            <li>
              Made by Fish. Join the Discord to provide feedback / suggestions /
              bug fixes.
            </li>
            <li>Server hosted in NA. Currently everything is stable.</li>
            <li>Please know that this is an early alpha.</li>
            <li>Your data may be wiped at any time.</li>
          </ul>
        </div>

        <div
          className="my-container custom-bg"
          style={{ padding: "12px 16px", fontSize: "14px", lineHeight: "1.6" }}
        >
          <h2>PAC Diversions</h2>
          <p style={{ margin: "4px 0 8px", opacity: 0.7, fontSize: "12px" }}>
            Balance changes from upstream Pokemon Auto Chess v6.9
          </p>

          <h3 style={{ marginTop: "8px", fontSize: "13px" }}>Changes</h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              margin: "4px 0"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0132")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="changed" /> <strong>Evolution</strong> — Pokemon
                need 6 copies to reach 3★ instead of 9.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0000-0004")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" /> <strong>Hatch Mons</strong> — Take 5
                stages to hatch and 8 stages to evolve.
              </span>
            </div>
          </div>

          <h3 style={{ marginTop: "8px", fontSize: "13px" }}>Items</h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              margin: "4px 0"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src="assets/item/PUNCHING_GLOVE.png"
                style={{
                  width: "28px",
                  height: "28px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" /> <strong>Punching Glove</strong> —
                On-hit bonus damage capped at 200.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src="assets/item/GOLD_BOTTLE_CAP.png"
                style={{
                  width: "28px",
                  height: "28px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" /> <strong>Gold Bottle Cap</strong> — Crit
                power bonus caps at 200 gold. Gold generation is capped at 3 per
                round, with no last-enemy jackpot.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src="assets/item/TEA.png"
                style={{
                  width: "28px",
                  height: "28px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" /> <strong>Tea</strong> — PP reduced from
                80 to 40.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src="assets/item/SMOKED_FILET.png"
                style={{
                  width: "28px",
                  height: "28px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" /> <strong>Smoked Filet</strong> — ATK
                reduced from 5 to 3, AP reduced from 10 to 5.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src="assets/item/RAINBOW_SWIRL_FLAVOR.png"
                style={{
                  width: "28px",
                  height: "28px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" /> <strong>Rainbow Swirl</strong> —
                Decorate PP buff reduced from 60 to 50.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src="assets/item/GOLD_DOJO_TICKET.png"
                style={{
                  width: "28px",
                  height: "28px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="changed" /> <strong>Dojo Tickets</strong> — Apply
                stat boosts instantly instead of after 3 fights. Only one per
                Pokemon per act.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src="assets/item/REPEAT_BALL.png"
                style={{
                  width: "28px",
                  height: "28px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="removed" /> <strong>Repeat Ball</strong> — Removed
                from the game.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src="assets/item/RED_SCALE.png"
                style={{
                  width: "28px",
                  height: "28px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="removed" /> <strong>Red Scale</strong> — Removed
                from the game.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src="assets/item/LEGEND_PLATE.png"
                style={{
                  width: "28px",
                  height: "28px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="new" /> <strong>Legend Plate</strong> — A new
                Arceus-only item: its items and stat boosts can't be stolen or
                knocked off (Thief, Knock Off, Spectral Thief, etc.), and any
                single instance of damage it takes is capped at 1000.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src="assets/item/ORAN_BERRY.png"
                style={{
                  width: "28px",
                  height: "28px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="changed" /> <strong>Berries</strong> — All berries
                are now removable: benching a Pokemon returns its berries to
                your inventory.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src="assets/item/BIG_MUSHROOM.png"
                style={{
                  width: "28px",
                  height: "28px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="changed" /> <strong>Mushrooms</strong> —
                Tiny/Big/Balm Mushrooms are automatically sold for gold (1/2/5g)
                when you reach a PokeMart or Pokemon Center.
              </span>
            </div>
          </div>

          <h3 style={{ marginTop: "8px", fontSize: "13px" }}>Pokemon</h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              margin: "4px 0"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0143")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" /> <strong>Munchlax / Snorlax</strong> —
                Glutton grants 5 max HP per berry, 5 per dish, and 10 when
                cooking as a Chef.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0200")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" /> <strong>Misdreavus / Mismagius</strong>{" "}
                — Night Shade damage capped at 500.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0869-0056")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" />{" "}
                <strong>Alcremie (Rainbow Swirl)</strong> — Decorate PP buff
                reduced from 60 to 50.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  display: "flex",
                  gap: "2px",
                  flexShrink: 0,
                  flexWrap: "wrap"
                }}
              >
                <img
                  src={getPortraitSrc("0671")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
                <img
                  src={getPortraitSrc("0869-0056")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
                <img
                  src={getPortraitSrc("0788")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
                <img
                  src={getPortraitSrc("0351-0002")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
                <img
                  src={getPortraitSrc("1017-0001")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
                <img
                  src={getPortraitSrc("0876")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
                <img
                  src={getPortraitSrc("0930")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
                <img
                  src={getPortraitSrc("0563")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
              </div>
              <span>
                <PacTag type="nerfed" /> <strong>PP Batteries</strong> — The PP
                these Pokemon grant to allies no longer scales with AP.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0242")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" />{" "}
                <strong>Happiny / Chansey / Blissey</strong> — Soft-Boiled
                shield AP scaling reduced from 1× to 0.5×.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0983")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" />{" "}
                <strong>Pawniard / Bisharp / Kingambit</strong> — Max PP
                increased from 60 to 80.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0405")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" /> <strong>Shinx / Luxio / Luxray</strong>{" "}
                — Max PP increased from 70 to 80.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0810")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" />{" "}
                <strong>Grookey / Thwackey / Rillaboom</strong> — Max PP
                increased from 60 to 80, so the Drummer line takes longer to
                cast its own ability while it feeds PP to adjacent allies.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0282")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" />{" "}
                <strong>Ralts / Kirlia / Gardevoir (Future Sight)</strong> —
                Hits up to 5 selected enemies after 2 seconds, with no damage to
                adjacent enemies.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0911")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="changed" />{" "}
                <strong>Fuecoco / Crocalor / Skeledirge (Torch Song)</strong> —
                Flame count is capped at 20, and each flame's 50% ATK damage is
                capped at 70. The per-flame AP buff is unchanged from upstream.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0479-0008")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="changed" />{" "}
                <strong>Rotom Drone (Plasma Flash)</strong> — Flash count capped
                at 20, so it no longer ramps without limit over a long fight
                (fixes a runaway command-queue buildup).
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                <img
                  src={getPortraitSrc("0111")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
                <img
                  src={getPortraitSrc("0460")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
                <img
                  src={getPortraitSrc("0062")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
              </div>
              <span>
                <PacTag type="info" /> <strong>Execute Abilities</strong> — Horn
                Drill, Sheer Cold, and Crabhammer deal 9999 damage on execute.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                <img
                  src={getPortraitSrc("0789")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
                <img
                  src={getPortraitSrc("0790")}
                  style={{
                    width: "40px",
                    height: "40px",
                    imageRendering: "pixelated"
                  }}
                />
              </div>
              <span>
                <PacTag type="buffed" /> <strong>Cosmog / Cosmoem</strong> —
                Evolve after 3 evolutions instead of 8, and gain 30 permanent
                max HP per evolution instead of 10.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0924")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="changed" /> <strong>Tandemaus / Maushold</strong>{" "}
                — Each stage now evolves 5 fights after it is acquired, instead
                of on fixed turns 15 and 20.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0935")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="changed" /> <strong>Charcadet</strong> — Receives
                its Auspicious / Malicious Armor for defeating any act-end boss,
                instead of a fixed PvE stage.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0888")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="changed" /> <strong>Zacian</strong> — Receives its
                Rusted Sword for defeating any act-end boss, instead of a fixed
                PvE stage.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={getPortraitSrc("0399")}
                style={{
                  width: "40px",
                  height: "40px",
                  imageRendering: "pixelated",
                  flexShrink: 0
                }}
              />
              <span>
                <PacTag type="nerfed" /> <strong>Bidoof / Bibarel</strong> —
                Super Fang damage capped at 500.
              </span>
            </div>
          </div>

          <h3 style={{ marginTop: "8px", fontSize: "13px" }}>Synergies</h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              margin: "4px 0"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SynergyIcon type={Synergy.LIGHT} size="28px" />
              <span>
                <PacTag type="nerfed" /> <strong>Light</strong> — Triggers
                raised from 2/3/4/5 to 3/4/5/6.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SynergyIcon type={Synergy.FLORA} size="28px" />
              <span>
                <PacTag type="buffed" /> <strong>Flora</strong> — Triggers
                lowered from 3/4/5/6 to 2/3/4/5.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SynergyIcon type={Synergy.FIGHTING} size="28px" />
              <span>
                <PacTag type="buffed" /> <strong>Fighting</strong> — Damage
                blocked raised from 3/6/9/12 to 4/8/12/16.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SynergyIcon type={Synergy.GRASS} size="28px" />
              <span>
                <PacTag type="buffed" /> <strong>Grass</strong> — Healing per 2s
                raised from 5/15/25 to 5/20/35.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SynergyIcon type={Synergy.WATER} size="28px" />
              <span>
                <PacTag type="changed" /> <strong>Fishing Rods</strong> — You
                catch mons when traveling to a wild battle.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                <SynergyIcon type={Synergy.AMORPHOUS} size="28px" />
                <SynergyIcon type={Synergy.LIGHT} size="28px" />
                <SynergyIcon type={Synergy.GOURMET} size="28px" />
                <SynergyIcon type={Synergy.ARTIFICIAL} size="28px" />
              </div>
              <span>
                <PacTag type="removed" /> <strong>Gyms</strong> — Amorphous,
                Light, Gourmet, and Artificial gyms are not available.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Find Lost Run Popup */}
      {lostRunPopup && lostRunPopup !== "searching" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
          onClick={() => setLostRunPopup(null)}
        >
          <div
            className="my-container my-box"
            style={{
              padding: "24px",
              maxWidth: "400px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {lostRunPopup === "found" ? (
              <>
                <h3 style={{ color: "#2ecc71" }}>Run Found!</h3>
                <p style={{ fontSize: "14px", opacity: 0.9 }}>
                  Your saved run was recovered from the database. You can now
                  resume it.
                </p>
              </>
            ) : lostRunPopup === "error" ? (
              <>
                <h3 style={{ color: "#f1c40f" }}>Inconclusive</h3>
                <p style={{ fontSize: "14px", opacity: 0.9 }}>
                  You're not connected to the server or the server is down.
                  Refresh the page and try again.
                </p>
              </>
            ) : (
              <>
                <h3 style={{ color: "#e74c3c" }}>No Run Found</h3>
                <p style={{ fontSize: "14px", opacity: 0.9 }}>
                  No saved run was found in the database for your account.
                </p>
              </>
            )}
            <button
              className="bubbly"
              onClick={() => setLostRunPopup(null)}
              style={{ backgroundColor: "#555" }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* New Patch Welcome Popup */}
      {showPatchPopup && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
          onClick={() => {
            setShowPatchPopup(false)
            localStore.set(LocalStoreKeys.SPIRE_LAST_PATCH_SEEN, CURRENT_PATCH)
            localStore.set(
              LocalStoreKeys.SPIRE_LAST_VERSION_SEEN,
              CURRENT_VERSION
            )
          }}
        >
          <div
            className="my-container my-box"
            style={{
              padding: "24px",
              maxWidth: "420px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: "#f1c40f" }}>
              Welcome to Patch {CURRENT_VERSION}!
            </h3>
            <p style={{ fontSize: "14px", opacity: 0.9 }}>
              A new update is live. Join the Discord for full patch notes and
              discussion!
            </p>
            <button
              className="bubbly"
              onClick={() => {
                setShowPatchPopup(false)
                localStore.set(
                  LocalStoreKeys.SPIRE_LAST_PATCH_SEEN,
                  CURRENT_PATCH
                )
                localStore.set(
                  LocalStoreKeys.SPIRE_LAST_VERSION_SEEN,
                  CURRENT_VERSION
                )
              }}
              style={{ backgroundColor: "#555" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Confirm Overwrite Dialog */}
      {confirmOverwrite !== null && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
          onClick={() => setConfirmOverwrite(null)}
        >
          <div
            className="my-container my-box"
            style={{
              padding: "24px",
              maxWidth: "400px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Overwrite Saved Run?</h3>
            <p style={{ fontSize: "14px", opacity: 0.9 }}>
              You have a saved run (Act {savedRun?.currentAct}, Floor{" "}
              {savedRun?.currentFloor}). Starting a new run will delete it.
            </p>
            <div
              style={{ display: "flex", gap: "8px", justifyContent: "center" }}
            >
              <button className="bubbly red" onClick={confirmNewRun}>
                Delete & Start New
              </button>
              <button
                className="bubbly"
                onClick={() => setConfirmOverwrite(null)}
                style={{ backgroundColor: "#555" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Session Warning Dialog */}
      {confirmActiveSession !== null && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
          onClick={() => setConfirmActiveSession(null)}
        >
          <div
            className="my-container my-box"
            style={{
              padding: "24px",
              maxWidth: "400px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Active Session Detected</h3>
            <p style={{ fontSize: "14px", opacity: 0.9 }}>
              You already have a game open in another tab or device. Continuing
              here will disconnect that session. Make sure you don't lose
              unsaved progress.
            </p>
            <div
              style={{ display: "flex", gap: "8px", justifyContent: "center" }}
            >
              <button className="bubbly red" onClick={confirmKickActiveSession}>
                Disconnect & Continue
              </button>
              <button
                className="bubbly"
                onClick={() => setConfirmActiveSession(null)}
                style={{ backgroundColor: "#555" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {announcement && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
        >
          <div
            className="my-container"
            style={{
              padding: "24px",
              maxWidth: "450px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}
          >
            <h3 style={{ color: "#f1c40f", margin: 0 }}>Server Announcement</h3>
            <p
              style={{
                fontSize: "14px",
                opacity: 0.9,
                margin: 0,
                whiteSpace: "pre-wrap"
              }}
            >
              {announcement}
            </p>
            <button
              className="bubbly"
              onClick={() => setAnnouncement(null)}
              style={{ backgroundColor: "#555" }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface ChampionSlot {
  name: string
  avatar: string
  pokemon: { name: string; items: string[] }[]
  inventory: string[]
  victories: number
  ties: number
}

interface ChampionData {
  champion: ChampionSlot
  eliteFour: ChampionSlot[]
  championSince: string | null
  longestReign: { name: string; durationMs: number } | null
}

const DIFF_ORDER: { mode: number; label: string; color: string }[] = [
  { mode: 0, label: "Easy", color: "#ffffff" },
  { mode: 1, label: "Normal", color: "#ffffff" },
  { mode: 2, label: "Hard", color: "#ffffff" },
  { mode: 3, label: "Impossible", color: "#ffffff" }
]

function formatDurationClient(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  return `${Math.max(1, minutes)}m`
}

function ChampionDisplay({ wide }: { wide?: boolean }) {
  const [data, setData] = useState<Record<number, ChampionData>>({})
  const [expanded, setExpanded] = useState<number | null>(null)
  const { t } = useTranslation()

  useEffect(() => {
    DIFF_ORDER.forEach(({ mode }) => {
      fetch(`/api/champion-data/${mode}`)
        .then((r) => r.json())
        .then((d) => setData((prev) => ({ ...prev, [mode]: d })))
        .catch(() => {})
    })
  }, [])

  return (
    <div style={{ marginTop: "12px" }}>
      <h2 style={{ textAlign: "center", margin: "0 0 10px 0" }}>
        Champion & Elite Four
      </h2>
      {DIFF_ORDER.map(({ mode, label, color }) => {
        const d = data[mode]
        const isOpen = expanded === mode
        return (
          <div
            key={mode}
            className="my-box"
            style={{ marginBottom: "6px", padding: "0" }}
          >
            <div
              onClick={() => setExpanded(isOpen ? null : mode)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                cursor: "pointer",
                userSelect: "none"
              }}
            >
              <span
                style={{
                  fontWeight: "bold",
                  color,
                  flex: 1,
                  textAlign: "center"
                }}
              >
                {label}
              </span>
              <span style={{ fontSize: "12px", opacity: 0.6 }}>
                {isOpen ? "▲" : "▼"}
              </span>
            </div>
            {isOpen && d && (
              <div
                style={{
                  padding: "0 12px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}
              >
                <ChampionSlotRow
                  slot={d.champion}
                  title="Champion"
                  highlight
                  wide={wide}
                />
                {d.championSince && (
                  <div
                    style={{
                      fontSize: "12px",
                      opacity: 0.6,
                      textAlign: "center",
                      margin: "-2px 0"
                    }}
                  >
                    Champion for{" "}
                    {formatDurationClient(
                      Date.now() - new Date(d.championSince).getTime()
                    )}
                  </div>
                )}
                {[...d.eliteFour].reverse().map((e4, i, arr) => (
                  <ChampionSlotRow
                    key={i}
                    slot={e4}
                    title={`Elite Four ${arr.length - i}`}
                    wide={wide}
                  />
                ))}
                {d.longestReign && (
                  <div
                    style={{
                      fontSize: "12px",
                      textAlign: "center",
                      marginTop: "4px",
                      padding: "4px 8px",
                      background: "rgba(241,196,15,0.1)",
                      borderRadius: "4px"
                    }}
                  >
                    <span style={{ color: "#f1c40f" }}>Longest Reign:</span>{" "}
                    {d.longestReign.name} (
                    {formatDurationClient(d.longestReign.durationMs)})
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function getTopSynergiesFromSlot(
  pokemon: { name: string; items: string[] }[],
  inventory: string[] = []
): [Synergy, number][] {
  const bonusSynergies = new Map<Synergy, number>()
  for (const item of inventory) {
    const synType = SynergyGivenByGem[item as SynergyGem]
    if (synType) {
      bonusSynergies.set(synType, (bonusSynergies.get(synType) ?? 0) + 1)
    }
  }
  const synergies = computeSynergies(
    pokemon
      .filter((p) => p.name)
      .map((p) => {
        const pkm = PokemonFactory.createPokemonFromName(p.name as Pkm)
        pkm.positionY = 1
        p.items.forEach((item) => pkm.items.add(item as any))
        return pkm
      }),
    bonusSynergies.size > 0 ? bonusSynergies : undefined
  )
  return [...synergies.entries()]
    .sort((a, b) => {
      const aTrigger =
        SynergyTriggers[a[0]]?.filter((n) => a[1] >= n).length ?? 0
      const bTrigger =
        SynergyTriggers[b[0]]?.filter((n) => b[1] >= n).length ?? 0
      return aTrigger !== bTrigger ? bTrigger - aTrigger : b[1] - a[1]
    })
    .filter(([, v]) => v > 0)
    .slice(0, 3)
}

function ChampionSlotRow({
  slot,
  title,
  highlight,
  wide
}: {
  slot: ChampionSlot
  title: string
  highlight?: boolean
  wide?: boolean
}) {
  const { t } = useTranslation()
  const topSynergies = getTopSynergiesFromSlot(slot.pokemon, slot.inventory)

  // Header elements: title, avatar, name, win/draw badges, synergies.
  const header = (
    <>
      <span
        style={{
          fontSize: "14px",
          opacity: 0.7,
          minWidth: "80px",
          flexShrink: 0,
          fontWeight: "bold"
        }}
      >
        {title}
      </span>
      <img
        src={getAvatarSrc(slot.avatar)}
        alt={slot.name}
        style={{
          width: 50,
          height: 50,
          imageRendering: "pixelated",
          flexShrink: 0
        }}
      />
      <span
        style={{
          fontSize: "15px",
          fontWeight: highlight ? "bold" : "600",
          color: highlight ? "#f1c40f" : "inherit",
          minWidth: "90px",
          flexShrink: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }}
      >
        {slot.name}
      </span>
      {slot.victories > 0 && (
        <span
          style={{
            fontSize: "11px",
            opacity: 0.7,
            flexShrink: 0,
            padding: "1px 5px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.08)"
          }}
        >
          {slot.victories} win{slot.victories !== 1 ? "s" : ""}
        </span>
      )}
      {slot.ties > 0 && (
        <span
          style={{
            fontSize: "11px",
            opacity: 0.7,
            flexShrink: 0,
            padding: "1px 5px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.08)"
          }}
        >
          {slot.ties} draw{slot.ties !== 1 ? "s" : ""}
        </span>
      )}
      <div
        style={{
          display: "flex",
          gap: "2px",
          alignItems: "center",
          flexShrink: 0
        }}
      >
        {topSynergies.map(([type, value]) => (
          <div
            key={type}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}
          >
            <SynergyIcon type={type} size="32px" />
            <span style={{ fontSize: "11px", opacity: 0.7 }}>{value}</span>
          </div>
        ))}
      </div>
    </>
  )

  // Pokémon team. In the wide central panel it shares the row (flex:1); in the
  // narrow left panel it sits on its own row below the header so it isn't squeezed.
  const team = (
    <div
      style={{
        display: "flex",
        gap: "4px",
        flexWrap: "wrap",
        flex: wide ? 1 : undefined,
        alignItems: "center"
      }}
    >
      {slot.pokemon.map((p, i) => {
        const idx = PkmIndex[p.name as Pkm]
        return idx ? (
          <div key={i} style={{ position: "relative" }}>
            <img
              src={getPortraitSrc(idx)}
              alt={p.name}
              title={t(`pkm.${p.name}` as any)}
              style={{ width: 50, height: 50, imageRendering: "pixelated" }}
            />
            {p.items.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  display: "flex",
                  gap: "1px"
                }}
              >
                {p.items.map((item, j) => (
                  <img
                    key={j}
                    src={`/assets/item/${item}.png`}
                    alt={item}
                    title={t(`item.${item}` as any)}
                    style={{ width: 15, height: 15 }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null
      })}
    </div>
  )

  if (wide) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "4px 0",
          borderTop: "1px solid rgba(255,255,255,0.1)"
        }}
      >
        {header}
        {team}
      </div>
    )
  }

  // Stacked: header row on top, team on a row below.
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "4px 0",
        borderTop: "1px solid rgba(255,255,255,0.1)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {header}
      </div>
      {team}
    </div>
  )
}

interface ArceusLeaderboardEntry {
  name: string
  avatar: string
  damage: number
  pokemon: { name: string; items: string[] }[]
  inventory: string[]
}

function ArceusRecordDisplay({ wide }: { wide?: boolean }) {
  const [leaderboards, setLeaderboards] = useState<
    Record<number, ArceusLeaderboardEntry[]>
  >({})
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    DIFF_ORDER.forEach(({ mode }) => {
      fetch(`/api/arceus-record/${mode}`)
        .then((r) => r.json())
        .then((d) => setLeaderboards((prev) => ({ ...prev, [mode]: d })))
        .catch(() => {})
    })
  }, [])

  return (
    <div style={{ marginTop: "12px" }}>
      <h2 style={{ textAlign: "center", margin: "0 0 10px 0" }}>
        Arceus Damage Records
      </h2>
      {DIFF_ORDER.map(({ mode, label, color }) => {
        const lb = leaderboards[mode] ?? []
        const isOpen = expanded === mode
        return (
          <div
            key={mode}
            className="my-box"
            style={{ marginBottom: "6px", padding: "0" }}
          >
            <div
              onClick={() => setExpanded(isOpen ? null : mode)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                cursor: "pointer",
                userSelect: "none"
              }}
            >
              <span
                style={{
                  fontWeight: "bold",
                  color,
                  flex: 1,
                  textAlign: "center"
                }}
              >
                {label}
              </span>
              <span style={{ fontSize: "12px", opacity: 0.6 }}>
                {isOpen ? "▲" : "▼"}
              </span>
            </div>
            {isOpen && (
              <div
                style={{
                  padding: "0 12px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const entry = lb[i]
                  if (!entry) {
                    return (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "4px 0",
                          borderTop: "1px solid rgba(255,255,255,0.1)",
                          minHeight: "58px"
                        }}
                      >
                        <span
                          style={{
                            fontSize: "14px",
                            opacity: 0.3,
                            minWidth: "80px",
                            flexShrink: 0,
                            fontWeight: "bold"
                          }}
                        >
                          #{i + 1}
                        </span>
                      </div>
                    )
                  }
                  const slot: ChampionSlot = {
                    name: entry.name,
                    avatar: entry.avatar,
                    pokemon: entry.pokemon,
                    inventory: entry.inventory || [],
                    victories: 0,
                    ties: 0
                  }
                  return (
                    <ChampionSlotRow
                      key={i}
                      slot={slot}
                      title={entry.damage.toLocaleString()}
                      highlight={i === 0}
                      wide={wide}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface EndlessLeaderboardEntry {
  name: string
  avatar: string
  act: number
  floor: number
  pokemon: { name: string; items: string[] }[]
}

function EndlessLeaderboardDisplay() {
  const [leaderboard, setLeaderboard] = useState<EndlessLeaderboardEntry[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch("/api/endless-record")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setLeaderboard(data)
      })
      .catch(() => {})
  }, [])

  return (
    <div style={{ marginTop: "12px" }}>
      <h2 style={{ textAlign: "center", margin: "0 0 10px 0" }}>
        Endless Mode Records
      </h2>
      <div className="my-box" style={{ marginBottom: "6px", padding: "0" }}>
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            cursor: "pointer",
            userSelect: "none"
          }}
        >
          <span
            style={{
              fontWeight: "bold",
              color: "white",
              flex: 1,
              textAlign: "center"
            }}
          >
            Top Runs
          </span>
          <span style={{ fontSize: "12px", opacity: 0.6 }}>
            {expanded ? "▲" : "▼"}
          </span>
        </div>
        {expanded && (
          <div
            style={{
              padding: "0 12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}
          >
            {Array.from({ length: 5 }, (_, i) => {
              const entry = leaderboard[i]
              if (!entry) {
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "4px 0",
                      borderTop: "1px solid rgba(255,255,255,0.1)",
                      minHeight: "58px"
                    }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        opacity: 0.3,
                        minWidth: "80px",
                        flexShrink: 0,
                        fontWeight: "bold"
                      }}
                    >
                      #{i + 1}
                    </span>
                  </div>
                )
              }
              const slot: ChampionSlot = {
                name: entry.name,
                avatar: entry.avatar,
                pokemon: entry.pokemon,
                inventory: [],
                victories: 0,
                ties: 0
              }
              return (
                <ChampionSlotRow
                  key={i}
                  slot={slot}
                  title={`Act ${entry.act} F${entry.floor}`}
                  highlight={i === 0}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface VictoryLeaderboardEntry {
  name: string
  avatar: string
  value: number
}

function VictoryLeaderboardDisplay() {
  const [data, setData] = useState<
    Record<
      number,
      {
        totalVictories: VictoryLeaderboardEntry[]
        longestStreak: VictoryLeaderboardEntry[]
      }
    >
  >({})
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    DIFF_ORDER.forEach(({ mode }) => {
      fetch(`/api/victory-leaderboard/${mode}`)
        .then((r) => r.json())
        .then((d) => setData((prev) => ({ ...prev, [mode]: d })))
        .catch(() => {})
    })
  }, [])

  return (
    <div style={{ marginTop: "12px" }}>
      <h2 style={{ textAlign: "center", margin: "0 0 10px 0" }}>
        Victory Records
      </h2>
      {DIFF_ORDER.map(({ mode, label, color }) => {
        const d = data[mode]
        const isOpen = expanded === mode
        return (
          <div
            key={mode}
            className="my-box"
            style={{ marginBottom: "6px", padding: "0" }}
          >
            <div
              onClick={() => setExpanded(isOpen ? null : mode)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                cursor: "pointer",
                userSelect: "none"
              }}
            >
              <span
                style={{
                  fontWeight: "bold",
                  color,
                  flex: 1,
                  textAlign: "center"
                }}
              >
                {label}
              </span>
              <span style={{ fontSize: "12px", opacity: 0.6 }}>
                {isOpen ? "▲" : "▼"}
              </span>
            </div>
            {isOpen && d && (
              <div
                style={{ display: "flex", gap: "12px", padding: "0 12px 10px" }}
              >
                <VictoryColumn
                  title="Total Victories"
                  entries={d.totalVictories}
                />
                <VictoryColumn
                  title="Longest Streak"
                  entries={d.longestStreak}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function VictoryColumn({
  title,
  entries
}: {
  title: string
  entries: VictoryLeaderboardEntry[]
}) {
  return (
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontSize: "13px",
          fontWeight: "bold",
          textAlign: "center",
          marginBottom: "6px",
          opacity: 0.8
        }}
      >
        {title}
      </div>
      {Array.from({ length: 10 }, (_, i) => {
        const entry = entries[i]
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "2px 0",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              minHeight: "30px"
            }}
          >
            <span
              style={{
                fontSize: "12px",
                opacity: entry ? 0.5 : 0.2,
                minWidth: "22px",
                textAlign: "right",
                flexShrink: 0
              }}
            >
              #{i + 1}
            </span>
            {entry ? (
              <>
                <img
                  src={getAvatarSrc(entry.avatar)}
                  alt={entry.name}
                  style={{
                    width: 26,
                    height: 26,
                    imageRendering: "pixelated",
                    flexShrink: 0
                  }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: i === 0 ? "#f1c40f" : "inherit",
                    fontWeight: i === 0 ? "bold" : "normal"
                  }}
                >
                  {entry.name}
                </span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: "bold",
                    flexShrink: 0,
                    color: i === 0 ? "#f1c40f" : "inherit"
                  }}
                >
                  {entry.value}
                </span>
              </>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
