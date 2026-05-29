import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { clearGameReconnection, client, getIdToken, joinGame, spectateGame } from "../network"
import { useAppSelector, useAppDispatch } from "../hooks"
import { changeName } from "../stores/NetworkStore"
import { SynergyTriggers } from "../../../config"
import { computeSynergies } from "../../../models/colyseus-models/synergies"
import PokemonFactory from "../../../models/pokemon-factory"
import { EloRank } from "../../../types/enum/EloRank"
import { DungeonPMDO } from "../../../types/enum/Dungeon"
import { Pkm, PkmIndex } from "../../../types/enum/Pokemon"
import { SynergyGem, SynergyGivenByGem } from "../../../types/enum/Item"
import { Synergy } from "../../../types/enum/Synergy"
import { getPortraitSrc, getAvatarSrc } from "../../../utils/avatar"
import { MainSidebar } from "./component/main-sidebar/main-sidebar"
import SynergyIcon from "./component/icons/synergy-icon"
import { cc } from "./utils/jsx"
import { LocalStoreKeys, localStore } from "./utils/store"
import pkg from "../../../../package.json"
import "./lobby.css"

interface SavedRunSummary {
  odToken: string
  savedAt: string
  currentAct: number
  currentFloor: number
  difficultyMode: number
  runHP: number
  teamPreview: string[]
}

const DIFFICULTY_LABELS: Record<number, string> = {
  0: "Easy",
  1: "Normal",
  2: "Hard",
  3: "Impossible"
}

const ASCENSION_RANKS: { rank: EloRank; name: string; description: string }[] = [
  { rank: EloRank.LEVEL_BALL, name: "Level Ball", description: "Coming soon." },
  { rank: EloRank.NET_BALL, name: "Net Ball", description: "Coming soon." },
  { rank: EloRank.SAFARI_BALL, name: "Safari Ball", description: "Coming soon." },
  { rank: EloRank.LOVE_BALL, name: "Love Ball", description: "Coming soon." },
  { rank: EloRank.PREMIER_BALL, name: "Premier Ball", description: "Coming soon." },
  { rank: EloRank.QUICK_BALL, name: "Quick Ball", description: "Coming soon." },
  { rank: EloRank.POKE_BALL, name: "Poke Ball", description: "Coming soon." },
  { rank: EloRank.SUPER_BALL, name: "Super Ball", description: "Coming soon." },
  { rank: EloRank.ULTRA_BALL, name: "Ultra Ball", description: "Coming soon." },
  { rank: EloRank.MASTER_BALL, name: "Master Ball", description: "Coming soon." },
  { rank: EloRank.BEAST_BALL, name: "Beast Ball", description: "Coming soon." }
]

const HATCH_POOL: Pkm[] = [
  Pkm.TYMPOLE, Pkm.AXEW, Pkm.DREEPY, Pkm.SNIVY, Pkm.SCORBUNNY,
  Pkm.POPPLIO, Pkm.GOTHITA, Pkm.ROWLET, Pkm.FROAKIE, Pkm.TEPIG,
  Pkm.GRUBBIN, Pkm.SCATTERBUG
]
const UNIQUE_POOL: Pkm[] = [
  Pkm.ABSOL, Pkm.LAPRAS, Pkm.SCYTHER, Pkm.HERACROSS, Pkm.ROTOM,
  Pkm.MIMIKYU, Pkm.SPIRITOMB, Pkm.HAWLUCHA, Pkm.KANGASKHAN, Pkm.PINSIR,
  Pkm.MAWILE, Pkm.SKARMORY, Pkm.TORKOAL, Pkm.TROPIUS, Pkm.DRAMPA
]
const LEGENDARY_POOL: Pkm[] = [
  Pkm.MEWTWO, Pkm.RAYQUAZA, Pkm.KYOGRE, Pkm.GROUDON, Pkm.LUGIA,
  Pkm.CELEBI, Pkm.DARKRAI, Pkm.GIRATINA, Pkm.DIALGA, Pkm.PALKIA,
  Pkm.RESHIRAM, Pkm.ZEKROM, Pkm.XERNEAS, Pkm.YVELTAL, Pkm.ZACIAN
]
const CURRENT_VERSION = pkg.version
const CURRENT_PATCH = CURRENT_VERSION.split(".").slice(0, 2).join(".")

function pickRandFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function eliteSpriteSrc(pkm: Pkm): string {
  const idx = PkmIndex[pkm] ?? "0000"
  return `assets/ui/elite-sprites-v2/${idx}.png`
}

const PAC_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  buffed: { bg: "#2d6a2d", text: "#7fff7f" },
  nerfed: { bg: "#6a2d2d", text: "#ff7f7f" },
  changed: { bg: "#6a5a2d", text: "#ffd27f" },
  removed: { bg: "#4a2d4a", text: "#d07fd0" },
  info: { bg: "#2d4a6a", text: "#7fbfff" }
}

function PacTag({ type }: { type: "buffed" | "nerfed" | "changed" | "removed" | "info" }) {
  const colors = PAC_TAG_COLORS[type]
  return (
    <span style={{
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
    }}>
      {type}
    </span>
  )
}

export default function SpireLobby() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const uid = useAppSelector((state) => state.network.uid)
  const displayName = useAppSelector((state) => state.network.displayName)
  const dispatch = useAppDispatch()
  const [starting, setStarting] = useState(false)
  const [serverStatus, setServerStatus] = useState<{ ccu: number; totalAccounts: number } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [playerName, setPlayerName] = useState(() => localStore.get(LocalStoreKeys.SPIRE_PLAYER_NAME) ?? "Username")
  const [avatarPkm, setAvatarPkm] = useState<Pkm>(() => (localStore.get(LocalStoreKeys.SPIRE_PLAYER_AVATAR) as Pkm) || Pkm.RATTATA)
  const [playerRegion, setPlayerRegion] = useState(() => localStore.get(LocalStoreKeys.SPIRE_PLAYER_REGION) ?? "town")
  const [regionLoaded, setRegionLoaded] = useState(false)
  const [savedRun, setSavedRun] = useState<SavedRunSummary | null>(null)
  const [loadingSave, setLoadingSave] = useState(true)
  const [confirmOverwrite, setConfirmOverwrite] = useState<number | null>(null)
  const [lostRunPopup, setLostRunPopup] = useState<"found" | "not-found" | "error" | "searching" | null>(null)
  const [hasHardWin, setHasHardWin] = useState(false)
  const [publicRuns, setPublicRuns] = useState<{
    roomId: string
    ownerName: string
    difficultyMode: number
    currentAct: number
    currentFloor: number
    runHP: number
    spectatorCount: number
  }[]>([])
  const [joiningSpectate, setJoiningSpectate] = useState(false)

  useEffect(() => {
    if (!uid) {
      navigate("/")
    }
  }, [uid])


  useEffect(() => {
    fetch("/status")
      .then((r) => r.json())
      .then((data) => setServerStatus(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!uid || uid === "local-player") return
    fetch(`/api/user-role/${uid}`)
      .then((r) => r.json())
      .then((data) => { if (data?.role === "ADMIN") setIsAdmin(true) })
      .catch(() => {})
  }, [uid])

  useEffect(() => {
    if (!uid || uid === "local-player") return
    fetch(`/api/spire-stats/${uid}`)
      .then((r) => r.json())
      .then((data) => { if (data?.hard?.wins > 0) setHasHardWin(true) })
      .catch(() => {})
  }, [uid])

  useEffect(() => {
    localStore.set(LocalStoreKeys.SPIRE_PLAYER_NAME, playerName)
    const trimmed = playerName.trim()
    if (trimmed && trimmed !== "Username" && trimmed !== "Player") {
      dispatch(changeName(trimmed))
    }
  }, [playerName])

  useEffect(() => {
    localStore.set(LocalStoreKeys.SPIRE_PLAYER_AVATAR, avatarPkm)
  }, [avatarPkm])

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

  useEffect(() => { clearGameReconnection() }, [])

  function refreshRuns() {
    fetch("/api/public-runs")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPublicRuns(data) })
      .catch(() => {})
  }

  useEffect(() => { refreshRuns() }, [])

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

  useEffect(() => {
    if (!uid || uid === "local-player") {
      setLoadingSave(false)
      return
    }
    const controller = new AbortController()
    fetch(`/api/saved-run/${uid}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => { if (!controller.signal.aborted) setSavedRun(data) })
      .catch(() => { if (!controller.signal.aborted) setSavedRun(null) })
      .finally(() => { if (!controller.signal.aborted) setLoadingSave(false) })
    return () => controller.abort()
  }, [uid])

  const avatarIndex = PkmIndex[avatarPkm] ?? PkmIndex[Pkm.RATTATA]
  const avatarString = `${avatarIndex.replace("-", "/")}/Normal`

  const [nameWarning, setNameWarning] = useState(false)

  async function createRoom(difficultyMode: number, resume: boolean) {
    if (starting) return
    const name = playerName.trim()
    if (!name || name === "Username" || name === "Player") {
      setNameWarning(true)
      return
    }
    setStarting(true)
    const idToken = await getIdToken()
    const odToken = uid || "local-player"
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
        resume
      })
      joinGame(room as any)
      navigate("/game")
    } catch (err) {
      console.error("Failed to start game:", err)
      setStarting(false)
    }
  }

  function startRun(difficultyMode: number) {
    if (savedRun) {
      setConfirmOverwrite(difficultyMode)
    } else {
      createRoom(difficultyMode, false)
    }
  }

  function confirmNewRun() {
    if (confirmOverwrite === null) return
    const diff = confirmOverwrite
    setConfirmOverwrite(null)
    fetch(`/api/saved-run/${uid}`, { method: "DELETE" })
      .then(() => {
        setSavedRun(null)
        createRoom(diff, false)
      })
      .catch(() => createRoom(diff, false))
  }

  function resumeRun() {
    if (!savedRun) return
    createRoom(savedRun.difficultyMode, true)
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
      <MainSidebar
        page="main_lobby"
        leave={() => {}}
        leaveLabel="Exit"
      />
      <div style={{
        position: "fixed", bottom: "16px", right: "16px", zIndex: 100,
        display: "flex", alignItems: "center", gap: "8px"
      }}>
        {isAdmin && serverStatus && (
          <span style={{
            fontSize: "12px", color: "#aaa",
            background: "rgba(0,0,0,0.5)", padding: "6px 10px", borderRadius: "6px"
          }}>
            {serverStatus.ccu} in game &middot; {serverStatus.totalAccounts} accounts
          </span>
        )}
        <a
          href="https://discord.gg/cfytB2kA"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "8px 16px", borderRadius: "6px",
            background: "#5865F2", color: "white", textDecoration: "none",
            fontWeight: "bold", fontSize: "14px"
          }}
        >
          <img src="assets/ui/discord.svg" alt="" style={{ width: 20, height: 20 }} />
          Discord
        </a>
      </div>
      <div className="lobby-container">
        <SpireLobbyContent
          startRun={startRun}
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
          findLostRun={findLostRun}
          lostRunPopup={lostRunPopup}
          setLostRunPopup={setLostRunPopup}
          playerRegion={playerRegion}
          setPlayerRegion={setPlayerRegion}
          hasHardWin={hasHardWin}
          isAdmin={isAdmin}
          nameWarning={nameWarning}
          setNameWarning={setNameWarning}
          publicRuns={publicRuns}
          joiningSpectate={joiningSpectate}
          watchRun={watchRun}
          refreshRuns={refreshRuns}
        />
      </div>
    </main>
  )
}

function SpireLobbyContent({
  startRun,
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
  findLostRun,
  lostRunPopup,
  setLostRunPopup,
  playerRegion,
  setPlayerRegion,
  hasHardWin,
  isAdmin,
  nameWarning,
  setNameWarning,
  publicRuns,
  joiningSpectate,
  watchRun,
  refreshRuns
}: {
  startRun: (difficultyMode: number) => void
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
  findLostRun: () => void
  lostRunPopup: "found" | "not-found" | "error" | "searching" | null
  setLostRunPopup: (v: "found" | "not-found" | "error" | "searching" | null) => void
  playerRegion: string
  setPlayerRegion: (region: string) => void
  hasHardWin: boolean
  isAdmin: boolean
  nameWarning: boolean
  setNameWarning: (v: boolean) => void
  publicRuns: { roomId: string; ownerName: string; difficultyMode: number; currentAct: number; currentFloor: number; runHP: number; spectatorCount: number }[]
  joiningSpectate: boolean
  watchRun: (roomId: string) => void
  refreshRuns: () => void
}) {
  const [activeSection, setActive] = useState<string>("rooms")
  const [ascensionIndex, setAscensionIndex] = useState(0)
  const [runSortBy, setRunSortBy] = useState<"stage" | "difficulty">("difficulty")
  const [runSortAsc, setRunSortAsc] = useState(false)
  const [runFilterDifficulty, setRunFilterDifficulty] = useState<number | null>(null)
  const [showPatchPopup, setShowPatchPopup] = useState(false)
  const [showHotfixButton, setShowHotfixButton] = useState(false)
  const { t } = useTranslation()
  const selectedAscension = ASCENSION_RANKS[ascensionIndex]

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
            Live Runs
          </li>
          <li
            onClick={() => setActive("rooms")}
            className={cc({ active: activeSection === "rooms" })}
          >
            <img width={32} height={32} src={`assets/ui/room.svg`} />
            {t("rooms")}
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
        <div className="my-container custom-bg hidden-scrollable" style={{ padding: "12px 16px", color: "var(--color-fg-primary)", height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <h2 style={{ margin: 0, flex: 1 }}>Live Runs</h2>
            <button
              className="bubbly"
              onClick={refreshRuns}
              style={{ fontSize: "11px", padding: "3px 10px", background: "#555" }}
            >
              Refresh
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: "12px" }}>Sort:</label>
            <select
              value={runSortBy}
              onChange={(e) => setRunSortBy(e.target.value as "stage" | "difficulty")}
              style={{ padding: "2px 6px", fontSize: "12px", background: "rgba(0,0,0,0.3)", color: "white", border: "1px solid #555", borderRadius: "4px" }}
            >
              <option value="stage">Stage</option>
              <option value="difficulty">Difficulty</option>
            </select>
            <button
              onClick={() => setRunSortAsc((v) => !v)}
              style={{ padding: "2px 6px", fontSize: "12px", background: "rgba(0,0,0,0.3)", color: "white", border: "1px solid #555", borderRadius: "4px", cursor: "pointer" }}
            >
              {runSortAsc ? "▲" : "▼"}
            </button>
            <label style={{ fontSize: "12px", marginLeft: "8px" }}>Filter:</label>
            <select
              value={runFilterDifficulty ?? "all"}
              onChange={(e) => setRunFilterDifficulty(e.target.value === "all" ? null : Number(e.target.value))}
              style={{ padding: "2px 6px", fontSize: "12px", background: "rgba(0,0,0,0.3)", color: "white", border: "1px solid #555", borderRadius: "4px" }}
            >
              <option value="all">All</option>
              <option value="0">Easy</option>
              <option value="1">Normal</option>
              <option value="2">Hard</option>
              <option value="3">Impossible</option>
            </select>
            <span style={{ marginLeft: "auto", fontSize: "12px", opacity: 0.6 }}>
              {publicRuns.length} active
            </span>
          </div>

          {(() => {
            const filtered = publicRuns
              .filter((r) => runFilterDifficulty === null || r.difficultyMode === runFilterDifficulty)
              .sort((a, b) => {
                const dir = runSortAsc ? 1 : -1
                if (runSortBy === "difficulty") return (a.difficultyMode - b.difficultyMode) * dir
                return ((a.currentAct * 100 + a.currentFloor) - (b.currentAct * 100 + b.currentFloor)) * dir
              })
            return filtered.length === 0 ? (
              <span style={{ fontSize: "13px", opacity: 0.5 }}>
                {publicRuns.length === 0 ? "No active runs" : "No runs match filter"}
              </span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, overflowY: "auto" }}>
                {filtered.map((run) => (
                  <div key={run.roomId} className="my-box" style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", flexWrap: "wrap"
                  }}>
                    <span style={{ fontWeight: "bold", fontSize: "13px", minWidth: "90px", display: "inline-block" }}>{run.ownerName}</span>
                    <span style={{ fontSize: "12px", color: "white", minWidth: "65px", display: "inline-block" }}>
                      {DIFFICULTY_LABELS[run.difficultyMode] ?? "Normal"}
                    </span>
                    <span style={{ fontSize: "12px", opacity: 0.8, minWidth: "100px", display: "inline-block" }}>
                      Act {run.currentAct} &middot; Floor {run.currentFloor}
                    </span>
                    <span style={{ fontSize: "12px", color: run.runHP <= 30 ? "#e74c3c" : "#2ecc71" }}>
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
                      style={{ marginLeft: "auto", fontSize: "11px", padding: "3px 6px", background: "none", border: "none", color: "white", cursor: "pointer" }}
                    >
                      {joiningSpectate ? "Joining..." : "Watch"}
                    </button>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </section>

      <section className={cc("rooms", { active: activeSection === "rooms" })}>
        <div className="my-container room-menu custom-bg hidden-scrollable">
          <h2>Play</h2>
          <ul className="room-list" style={{ padding: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Resume Run Panel */}
            <li style={{ listStyle: "none" }}>
              <div className="room-item my-box" style={{ display: "flex", flexDirection: "row", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <span className="room-name" style={{ color: savedRun ? "#f39c12" : "#888" }}>Saved Run</span>
                {savedRun ? (
                  <>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "13px", opacity: 0.9 }}>
                      <span>Act {savedRun.currentAct} &middot; Floor {savedRun.currentFloor}</span>
                      <span>{DIFFICULTY_LABELS[savedRun.difficultyMode] ?? "Normal"}</span>
                      <span style={{ color: savedRun.runHP <= 30 ? "#e74c3c" : "#2ecc71" }}>
                        {savedRun.runHP} HP
                      </span>
                    </div>
                    {savedRun.teamPreview?.length > 0 && (
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        {savedRun.teamPreview.slice(0, 6).map((pkm, i) => {
                          const idx = PkmIndex[pkm as Pkm]
                          return idx ? (
                            <img
                              key={i}
                              src={getPortraitSrc(idx)}
                              alt={pkm}
                              title={t(`pkm.${pkm}`)}
                              style={{ width: 32, height: 32, imageRendering: "pixelated" }}
                            />
                          ) : null
                        })}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                      <button
                        className={cc("bubbly yellow", { loading: starting })}
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
                    <span style={{ fontSize: "13px", opacity: 0.6 }}>No saved run</span>
                    <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                      <button
                        className="bubbly"
                        onClick={findLostRun}
                        disabled={lostRunPopup === "searching"}
                        style={{ backgroundColor: "#2980b9", fontSize: "12px", padding: "4px 12px" }}
                      >
                        {lostRunPopup === "searching" ? "Searching..." : "Find Lost Run"}
                      </button>
                      <button
                        className="bubbly"
                        disabled
                        style={{ backgroundColor: "#555", cursor: "not-allowed" }}
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
              <div className="room-item my-box" style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                <span className="room-name">
                  Pokemon Auto Spire v{CURRENT_VERSION}
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
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    className={cc("bubbly", { loading: starting })}
                    disabled={starting}
                    onClick={() => startRun(0)}
                    style={{ backgroundColor: "#27ae60" }}
                  >
                    {starting ? t("loading") : "Start Easy"}
                  </button>
                  <button
                    className={cc("bubbly yellow", { loading: starting })}
                    disabled={starting}
                    onClick={() => startRun(1)}
                  >
                    {starting ? t("loading") : "Start Normal"}
                  </button>
                  <button
                    className={cc("bubbly red", { loading: starting })}
                    disabled={starting}
                    onClick={() => startRun(2)}
                  >
                    {starting ? t("loading") : "Start Hard"}
                  </button>
                  <span style={{ position: "relative", display: "inline-block" }} className={(!hasHardWin && !isAdmin) ? "hometown-help" : ""}>
                    <button
                      className={cc("bubbly", { loading: starting })}
                      disabled={starting || (!hasHardWin && !isAdmin)}
                      onClick={() => startRun(3)}
                      style={{
                        backgroundColor: "#222222",
                        opacity: (!hasHardWin && !isAdmin) ? 0.4 : 1,
                        cursor: (!hasHardWin && !isAdmin) ? "not-allowed" : "pointer"
                      }}
                    >
                      {starting ? t("loading") : "Start Impossible"}
                    </button>
                    {(!hasHardWin && !isAdmin) && (
                      <span className="hometown-help-tooltip">
                        Defeat Hard mode to unlock Impossible
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </li>

            {/* Ascension + Endless Row */}
            <li style={{ listStyle: "none", display: "flex", gap: "8px" }}>
              <div className="room-item my-box" style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", flex: 1 }}>
                <span className="room-name">Ascension Run</span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <img
                    src={`assets/ranks/${selectedAscension.rank}.svg`}
                    alt={selectedAscension.name}
                    style={{ width: "32px", height: "32px" }}
                  />
                  <select
                    value={ascensionIndex}
                    onChange={(e) => setAscensionIndex(Number(e.target.value))}
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
                  <button
                    className="bubbly"
                    disabled
                    style={{ backgroundColor: "#555", cursor: "not-allowed" }}
                  >
                    Coming Soon
                  </button>
                </div>
                <span style={{
                  fontSize: "12px",
                  opacity: 0.7,
                  textAlign: "center",
                  maxWidth: "400px"
                }}>
                  {selectedAscension.description}
                </span>
              </div>

              <div className="room-item my-box" style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", flex: 1 }}>
                <span className="room-name">Endless Mode</span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <img
                    src="assets/ui/room.svg"
                    alt="Endless"
                    style={{ width: "32px", height: "32px", opacity: 0.6 }}
                  />
                  <button
                    className="bubbly"
                    disabled
                    style={{ backgroundColor: "#555", cursor: "not-allowed" }}
                  >
                    Coming Soon
                  </button>
                </div>
                <span style={{
                  fontSize: "12px",
                  opacity: 0.7,
                  textAlign: "center",
                  maxWidth: "400px"
                }}>
                  Survive as long as you can in an endless gauntlet of increasingly difficult encounters.
                </span>
              </div>
            </li>
          </ul>

          <div className="my-box" style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", flexWrap: "wrap" }}>
            <img
              src={getPortraitSrc(avatarIndex)}
              alt="avatar"
              style={{ width: 40, height: 40, imageRendering: "pixelated" }}
            />
            <div style={{ flex: 1, minWidth: "100px", position: "relative" }}>
              <input
                type="text"
                value={playerName}
                onChange={(e) => { setPlayerName(e.target.value); setNameWarning(false) }}
                placeholder="Player Name"
                maxLength={20}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  border: nameWarning ? "1px solid #e74c3c" : "1px solid #555",
                  background: "rgba(0,0,0,0.3)",
                  color: "white",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  boxSizing: "border-box"
                }}
              />
              {nameWarning && (
                <div style={{
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
                }}>
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
              <option value="" disabled>{t("search_pokemon")}</option>
              {Object.keys(PkmIndex)
                .filter((p) => p !== "DEFAULT" && p !== "EGG")
                .sort((a, b) => t(`pkm.${a}`).localeCompare(t(`pkm.${b}`)))
                .map((p) => (
                  <option key={p} value={p}>{t(`pkm.${p}`)}</option>
                ))}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "12px", opacity: 0.7, whiteSpace: "nowrap" }}>Home Town</span>
              <span
                style={{
                  position: "relative",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: "14px", height: "14px", borderRadius: "50%",
                  border: "1px solid #888", fontSize: "10px", color: "#aaa",
                  cursor: "pointer", flexShrink: 0
                }}
                className="hometown-help"
              >
                ?
                <span className="hometown-help-tooltip">
                  Your Home Town is the background shown when you start a run. If you become Champion or Elite Four, challengers will fight you here. Check the wiki for region previews. It's purely cosmetic.
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
                    {d.replace(/([A-Z])/g, " $1").replace(/(\d+)/g, " $1").trim()}
                  </option>
                ))}
            </select>
          </div>
          <ChampionDisplay />
          <ArceusRecordDisplay />
        </div>
      </section>

      <section
        className={cc("events", {
          active: activeSection === "events"
        })}
        style={{ display: "flex", flexDirection: "column", gap: "8px", overflow: "auto" }}
      >
        <div className="my-container custom-bg" style={{ padding: "12px 16px", fontSize: "14px", lineHeight: "1.6" }}>
          <h2>Dev Notes</h2>
          <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
            <li>Join the <a href="https://discord.gg/cfytB2kA" target="_blank" rel="noopener noreferrer" style={{ color: "#7289da" }}>Pokemon Auto Spire Discord</a></li>
            <li>Made by Fish. Join the Discord to provide feedback / suggestions / bug fixes.</li>
            <li>Server hosted in NA. Currently everything is stable.</li>
            <li>Please know that this is an early alpha.</li>
            <li>Your data may be wiped at any time.</li>
          </ul>
        </div>

        <div className="my-container custom-bg" style={{ padding: "12px 16px", fontSize: "14px", lineHeight: "1.6" }}>
          <h2>PAC Diversions</h2>
          <p style={{ margin: "4px 0 8px", opacity: 0.7, fontSize: "12px" }}>
            Balance changes from upstream Pokemon Auto Chess v6.9
          </p>

          <h3 style={{ marginTop: "8px", fontSize: "13px" }}>Changes</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={getPortraitSrc("0132")} style={{ width: "40px", height: "40px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="changed" /> <strong>Evolution</strong> — Pokemon need 6 copies to reach 3★ instead of 9.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={getPortraitSrc("0000-0004")} style={{ width: "40px", height: "40px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="nerfed" /> <strong>Hatch Mons</strong> — Take 5 stages to hatch and 8 stages to evolve.</span>
            </div>
          </div>

          <h3 style={{ marginTop: "8px", fontSize: "13px" }}>Items</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/item/PUNCHING_GLOVE.png" style={{ width: "28px", height: "28px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="nerfed" /> <strong>Punching Glove</strong> — On-hit bonus damage capped at 200.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/item/GOLD_BOTTLE_CAP.png" style={{ width: "28px", height: "28px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="nerfed" /> <strong>Gold Bottle Cap</strong> — Crit power bonus now caps at 200 gold.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/item/TEA.png" style={{ width: "28px", height: "28px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="nerfed" /> <strong>Tea</strong> — PP reduced from 80 to 40.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/item/SMOKED_FILET.png" style={{ width: "28px", height: "28px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="nerfed" /> <strong>Smoked Filet</strong> — ATK reduced from 5 to 3, AP reduced from 10 to 5.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/item/RAINBOW_SWIRL_FLAVOR.png" style={{ width: "28px", height: "28px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="nerfed" /> <strong>Rainbow Swirl</strong> — Decorate PP buff reduced from 60 to 30, AP scaling halved.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/item/GOLD_DOJO_TICKET.png" style={{ width: "28px", height: "28px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="changed" /> <strong>Dojo Tickets</strong> — Apply stat boosts instantly instead of after 3 fights. Only one per Pokemon per act.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/item/REPEAT_BALL.png" style={{ width: "28px", height: "28px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="removed" /> <strong>Repeat Ball</strong> — Removed from the game.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/item/RED_SCALE.png" style={{ width: "28px", height: "28px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="removed" /> <strong>Red Scale</strong> — Removed from the game.</span>
            </div>
          </div>

          <h3 style={{ marginTop: "8px", fontSize: "13px" }}>Pokemon</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={getPortraitSrc("0143")} style={{ width: "40px", height: "40px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="nerfed" /> <strong>Snorlax</strong> — Glutton passive HP gains from berries and Gourmet effects halved.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={getPortraitSrc("0200")} style={{ width: "40px", height: "40px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="nerfed" /> <strong>Misdreavus / Mismagius</strong> — Night Shade damage capped at 150.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src={getPortraitSrc("0869-0056")} style={{ width: "40px", height: "40px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><PacTag type="nerfed" /> <strong>Alcremie (Rainbow Swirl)</strong> — Decorate PP buff reduced from 60 to 30, AP scaling halved.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                <img src={getPortraitSrc("0111")} style={{ width: "40px", height: "40px", imageRendering: "pixelated" }} />
                <img src={getPortraitSrc("0460")} style={{ width: "40px", height: "40px", imageRendering: "pixelated" }} />
                <img src={getPortraitSrc("0062")} style={{ width: "40px", height: "40px", imageRendering: "pixelated" }} />
              </div>
              <span><PacTag type="info" /> <strong>Execute Abilities</strong> — Horn Drill, Sheer Cold, and Crabhammer deal 9999 damage on execute.</span>
            </div>
          </div>

          <h3 style={{ marginTop: "8px", fontSize: "13px" }}>Synergies</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", margin: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SynergyIcon type={Synergy.LIGHT} size="28px" />
              <span><PacTag type="nerfed" /> <strong>Light</strong> — Triggers raised from 2/3/4/5 to 3/4/5/6.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SynergyIcon type={Synergy.AMORPHOUS} size="28px" />
              <span><PacTag type="nerfed" /> <strong>Amorphous</strong> — Speed and HP bonuses per active synergy halved.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SynergyIcon type={Synergy.WATER} size="28px" />
              <span><PacTag type="changed" /> <strong>Fishing Rods</strong> — You catch mons when traveling to a wild battle.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                <SynergyIcon type={Synergy.AMORPHOUS} size="28px" />
                <SynergyIcon type={Synergy.LIGHT} size="28px" />
                <SynergyIcon type={Synergy.GOURMET} size="28px" />
                <SynergyIcon type={Synergy.ARTIFICIAL} size="28px" />
              </div>
              <span><PacTag type="removed" /> <strong>Gyms</strong> — Amorphous, Light, Gourmet, and Artificial gyms are not available.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Find Lost Run Popup */}
      {lostRunPopup && lostRunPopup !== "searching" && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
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
                  Your saved run was recovered from the database. You can now resume it.
                </p>
              </>
            ) : lostRunPopup === "error" ? (
              <>
                <h3 style={{ color: "#f1c40f" }}>Inconclusive</h3>
                <p style={{ fontSize: "14px", opacity: 0.9 }}>
                  You're not connected to the server or the server is down. Refresh the page and try again.
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
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
          onClick={() => { setShowPatchPopup(false); localStore.set(LocalStoreKeys.SPIRE_LAST_PATCH_SEEN, CURRENT_PATCH); localStore.set(LocalStoreKeys.SPIRE_LAST_VERSION_SEEN, CURRENT_VERSION) }}
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
            <h3 style={{ color: "#f1c40f" }}>Welcome to Patch {CURRENT_VERSION}!</h3>
            <p style={{ fontSize: "14px", opacity: 0.9 }}>
              A new update is live. Join the Discord for full patch notes and discussion!
            </p>
            <button
              className="bubbly"
              onClick={() => { setShowPatchPopup(false); localStore.set(LocalStoreKeys.SPIRE_LAST_PATCH_SEEN, CURRENT_PATCH); localStore.set(LocalStoreKeys.SPIRE_LAST_VERSION_SEEN, CURRENT_VERSION) }}
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
            top: 0, left: 0, right: 0, bottom: 0,
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
              You have a saved run (Act {savedRun?.currentAct}, Floor {savedRun?.currentFloor}).
              Starting a new run will delete it.
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                className="bubbly red"
                onClick={confirmNewRun}
              >
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
    </div>
  )
}

interface ChampionSlot {
  name: string
  avatar: string
  pokemon: { name: string; items: string[] }[]
  inventory: string[]
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

function ChampionDisplay() {
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
          <div key={mode} className="my-box" style={{ marginBottom: "6px", padding: "0" }}>
            <div
              onClick={() => setExpanded(isOpen ? null : mode)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", cursor: "pointer", userSelect: "none"
              }}
            >
              <span style={{ fontWeight: "bold", color, flex: 1, textAlign: "center" }}>{label}</span>
              <span style={{ fontSize: "12px", opacity: 0.6 }}>{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen && d && (
              <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <ChampionSlotRow slot={d.champion} title="Champion" highlight />
                {d.championSince && (
                  <div style={{ fontSize: "12px", opacity: 0.6, textAlign: "center", margin: "-2px 0" }}>
                    Champion for {formatDurationClient(Date.now() - new Date(d.championSince).getTime())}
                  </div>
                )}
                {[...d.eliteFour].reverse().map((e4, i, arr) => (
                  <ChampionSlotRow key={i} slot={e4} title={`Elite Four ${arr.length - i}`} />
                ))}
                {d.longestReign && (
                  <div style={{
                    fontSize: "12px", textAlign: "center", marginTop: "4px",
                    padding: "4px 8px", background: "rgba(241,196,15,0.1)", borderRadius: "4px"
                  }}>
                    <span style={{ color: "#f1c40f" }}>Longest Reign:</span>{" "}
                    {d.longestReign.name} ({formatDurationClient(d.longestReign.durationMs)})
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

function getTopSynergiesFromSlot(pokemon: { name: string; items: string[] }[], inventory: string[] = []): [Synergy, number][] {
  const bonusSynergies = new Map<Synergy, number>()
  for (const item of inventory) {
    const synType = SynergyGivenByGem[item as SynergyGem]
    if (synType) {
      bonusSynergies.set(synType, (bonusSynergies.get(synType) ?? 0) + 1)
    }
  }
  const synergies = computeSynergies(
    pokemon.filter(p => p.name).map((p) => {
      const pkm = PokemonFactory.createPokemonFromName(p.name as Pkm)
      pkm.positionY = 1
      p.items.forEach((item) => pkm.items.add(item as any))
      return pkm
    }),
    bonusSynergies.size > 0 ? bonusSynergies : undefined
  )
  return [...synergies.entries()]
    .sort((a, b) => {
      const aTrigger = SynergyTriggers[a[0]]?.filter((n) => a[1] >= n).length ?? 0
      const bTrigger = SynergyTriggers[b[0]]?.filter((n) => b[1] >= n).length ?? 0
      return aTrigger !== bTrigger ? bTrigger - aTrigger : b[1] - a[1]
    })
    .filter(([, v]) => v > 0)
    .slice(0, 3)
}

function ChampionSlotRow({ slot, title, highlight }: { slot: ChampionSlot; title: string; highlight?: boolean }) {
  const { t } = useTranslation()
  const topSynergies = getTopSynergiesFromSlot(slot.pokemon, slot.inventory)
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px", padding: "4px 0",
      borderTop: "1px solid rgba(255,255,255,0.1)"
    }}>
      <span style={{
        fontSize: "14px", opacity: 0.7, minWidth: "80px", flexShrink: 0, fontWeight: "bold"
      }}>{title}</span>
      <img
        src={getAvatarSrc(slot.avatar)}
        alt={slot.name}
        style={{ width: 50, height: 50, imageRendering: "pixelated", flexShrink: 0 }}
      />
      <span style={{
        fontSize: "15px", fontWeight: highlight ? "bold" : "600",
        color: highlight ? "#f1c40f" : "inherit",
        minWidth: "90px", flexShrink: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
      }}>{slot.name}</span>
      <div style={{ display: "flex", gap: "2px", alignItems: "center", flexShrink: 0 }}>
        {topSynergies.map(([type, value]) => (
          <div key={type} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <SynergyIcon type={type} size="32px" />
            <span style={{ fontSize: "11px", opacity: 0.7 }}>{value}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", flex: 1, alignItems: "center" }}>
        {slot.pokemon.map((p, i) => {
          const idx = PkmIndex[p.name as Pkm]
          return idx ? (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={getPortraitSrc(idx)}
                alt={p.name}
                title={t(`pkm.${p.name}`)}
                style={{ width: 50, height: 50, imageRendering: "pixelated" }}
              />
              {p.items.length > 0 && (
                <div style={{ position: "absolute", bottom: 0, left: 0, display: "flex", gap: "1px" }}>
                  {p.items.map((item, j) => (
                    <img
                      key={j}
                      src={`/assets/item/${item}.png`}
                      alt={item}
                      title={t(`item.${item}`)}
                      style={{ width: 15, height: 15 }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : null
        })}
      </div>
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

function ArceusRecordDisplay() {
  const [leaderboards, setLeaderboards] = useState<Record<number, ArceusLeaderboardEntry[]>>({})
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
          <div key={mode} className="my-box" style={{ marginBottom: "6px", padding: "0" }}>
            <div
              onClick={() => setExpanded(isOpen ? null : mode)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", cursor: "pointer", userSelect: "none"
              }}
            >
              <span style={{ fontWeight: "bold", color, flex: 1, textAlign: "center" }}>{label}</span>
              <span style={{ fontSize: "12px", opacity: 0.6 }}>{isOpen ? "▲" : "▼"}</span>
            </div>
            {isOpen && (
              <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {Array.from({ length: 5 }, (_, i) => {
                  const entry = lb[i]
                  if (!entry) {
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: "8px", padding: "4px 0",
                        borderTop: "1px solid rgba(255,255,255,0.1)", minHeight: "58px"
                      }}>
                        <span style={{
                          fontSize: "14px", opacity: 0.3, minWidth: "80px", flexShrink: 0, fontWeight: "bold"
                        }}>#{i + 1}</span>
                      </div>
                    )
                  }
                  const slot: ChampionSlot = {
                    name: entry.name,
                    avatar: entry.avatar,
                    pokemon: entry.pokemon,
                    inventory: entry.inventory || []
                  }
                  return (
                    <ChampionSlotRow
                      key={i}
                      slot={slot}
                      title={entry.damage.toLocaleString()}
                      highlight={i === 0}
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
