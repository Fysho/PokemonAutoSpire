import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { client, getIdToken, joinGame } from "../network"
import { useAppSelector } from "../hooks"
import { EloRank } from "../../../types/enum/EloRank"
import { Pkm, PkmIndex } from "../../../types/enum/Pokemon"
import { getPortraitSrc } from "../../../utils/avatar"
import { MainSidebar } from "./component/main-sidebar/main-sidebar"
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
}

const DIFFICULTY_LABELS: Record<number, string> = {
  0: "Easy",
  1: "Normal",
  2: "Hard"
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

export default function SpireLobby() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const uid = useAppSelector((state) => state.network.uid)
  const displayName = useAppSelector((state) => state.network.displayName)
  const [starting, setStarting] = useState(false)
  const [playerName, setPlayerName] = useState(() => localStore.get(LocalStoreKeys.SPIRE_PLAYER_NAME) ?? "Username")
  const [avatarPkm, setAvatarPkm] = useState<Pkm>(() => (localStore.get(LocalStoreKeys.SPIRE_PLAYER_AVATAR) as Pkm) || Pkm.RATTATA)
  const [savedRun, setSavedRun] = useState<SavedRunSummary | null>(null)
  const [loadingSave, setLoadingSave] = useState(true)
  const [confirmOverwrite, setConfirmOverwrite] = useState<number | null>(null)

  useEffect(() => {
    if (!uid) {
      navigate("/")
    }
  }, [uid])

  useEffect(() => {
    if (displayName && playerName === "Username") {
      setPlayerName(displayName)
    }
  }, [displayName])

  useEffect(() => {
    localStore.set(LocalStoreKeys.SPIRE_PLAYER_NAME, playerName)
  }, [playerName])

  useEffect(() => {
    localStore.set(LocalStoreKeys.SPIRE_PLAYER_AVATAR, avatarPkm)
  }, [avatarPkm])

  useEffect(() => {
    if (uid && uid !== "local-player") {
      fetch(`/api/saved-run/${uid}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setSavedRun(data))
        .catch(() => setSavedRun(null))
        .finally(() => setLoadingSave(false))
    } else {
      setLoadingSave(false)
    }
  }, [uid])

  const avatarIndex = PkmIndex[avatarPkm] ?? PkmIndex[Pkm.RATTATA]
  const avatarString = `${avatarIndex.replace("-", "/")}/Normal`

  async function createRoom(difficultyMode: number, resume: boolean) {
    if (starting) return
    setStarting(true)
    const name = playerName.trim() || "Username"
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

  function abandonRun() {
    if (!uid) return
    fetch(`/api/saved-run/${uid}`, { method: "DELETE" })
      .then(() => setSavedRun(null))
      .catch(() => {})
  }

  return (
    <main className="lobby">
      <MainSidebar
        page="main_lobby"
        leave={() => {}}
        leaveLabel="Exit"
      />
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
  confirmNewRun
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
}) {
  const [activeSection, setActive] = useState<string>("rooms")
  const [ascensionIndex, setAscensionIndex] = useState(0)
  const { t } = useTranslation()
  const selectedAscension = ASCENSION_RANKS[ascensionIndex]

  return (
    <div className="main-lobby">
      <nav className="main-lobby-nav">
        <ul>
          <li
            onClick={() => setActive("leaderboard")}
            className={cc({ active: activeSection === "leaderboard" })}
          >
            <img width={32} height={32} src={`assets/ui/meta.svg`} />
            How to Play
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
        <div className="my-container custom-bg hidden-scrollable" style={{ padding: "12px 16px", fontSize: "14px", lineHeight: "1.6", color: "var(--color-fg-primary)" }}>
          <h2 style={{ textAlign: "center", marginBottom: "8px" }}>How to Play</h2>

          <p>
            <strong>Pokemon Auto Spire</strong> is a single-player roguelike auto-battler.
            Build a team of Pokemon, navigate a branching map across 3 acts, and defeat legendary bosses.
          </p>

          <h3 style={{ marginTop: "12px" }}>Map Nodes</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", margin: "4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/types/FIRE.svg" style={{ width: "28px", height: "28px", flexShrink: 0 }} />
              <span><strong>Wild Battle</strong> — Fight regional Pokemon. Shown as synergy type icons on the map.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/item/WATER_GEM.png" style={{ width: "28px", height: "28px", flexShrink: 0 }} />
              <span><strong>Gym Leader</strong> — Themed synergy team. Win for a synergy gem + crafted item/tool.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "24px", width: "28px", textAlign: "center", flexShrink: 0 }}>⚔️</span>
              <span><strong>Elite</strong> — Tough themed encounters with unique Pokemon rewards.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/ui/pokeball.svg" style={{ width: "28px", height: "28px", flexShrink: 0 }} />
              <span><strong>PokeMart</strong> — Walk-around shop to buy Pokemon and items with gold.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/ui/chansey-sprite.png" style={{ width: "28px", height: "28px", imageRendering: "pixelated", flexShrink: 0 }} />
              <span><strong>Pokemon Center</strong> — Heal 30 HP, get a Ditto, or take a Dojo Ticket.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img src="assets/unown/unown-qm.png" style={{ width: "48px", height: "48px", imageRendering: "pixelated", flexShrink: 0, margin: "-10px 0" }} />
              <span><strong>Mystery</strong> — Random events with risk/reward choices.</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "24px", width: "28px", textAlign: "center", flexShrink: 0 }}>👑</span>
              <span><strong>Boss</strong> — Act-ending legendary fight. Shiny item reward on win (Acts 1-2).</span>
            </div>
          </div>

          <h3 style={{ marginTop: "12px" }}>Things to Note</h3>
          <ul style={{ paddingLeft: "20px", margin: "4px 0" }}>
            <li>You only need 6 copies of a Pokemon to reach 3★ instead of 9.</li>
            <li>Dojo Tickets work instantly and you can only use one per act on each Pokemon.</li>
            <li>Winning a wild battle gives 1 extra reward choice and a Ditto chance.</li>
            <li>Re-rolling a unique reward will give you the regular reward pool.</li>
            <li>Egg Pokemon take 8 stages to evolve after hatching.</li>
            <li>Pokemon Centers offer healing, Ditto, or Dojo Tickets for stat boosts.</li>
            <li>Gym wins grant a synergy gem (+1 synergy level) plus a choice of rewards.</li>
          </ul>
        </div>
      </section>

      <section className={cc("rooms", { active: activeSection === "rooms" })}>
        <div className="my-container room-menu custom-bg hidden-scrollable">
          <h2>Play</h2>
          <ul className="room-list" style={{ padding: 0 }}>
            {/* Resume Run Panel */}
            {!loadingSave && savedRun && (
              <li style={{ listStyle: "none" }}>
                <div className="room-item my-box" style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", border: "2px solid #f39c12" }}>
                  <span className="room-name" style={{ color: "#f39c12" }}>Saved Run</span>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "13px", opacity: 0.9 }}>
                    <span>Act {savedRun.currentAct} &middot; Floor {savedRun.currentFloor}</span>
                    <span>{DIFFICULTY_LABELS[savedRun.difficultyMode] ?? "Normal"}</span>
                    <span style={{ color: savedRun.runHP <= 30 ? "#e74c3c" : "#2ecc71" }}>
                      {savedRun.runHP} HP
                    </span>
                  </div>
                  {savedRun.teamPreview?.length > 0 && (
                    <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
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
                  <div style={{ display: "flex", gap: "8px" }}>
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
                </div>
              </li>
            )}

            {/* New Run Panel */}
            <li style={{ listStyle: "none" }}>
              <div className="room-item my-box" style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                <span className="room-name">Pokemon Auto Spire v1.2</span>
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
                    {starting ? t("loading") : "Start Run"}
                  </button>
                  <button
                    className={cc("bubbly red", { loading: starting })}
                    disabled={starting}
                    onClick={() => startRun(2)}
                  >
                    {starting ? t("loading") : "Start Hard"}
                  </button>
                </div>
              </div>
            </li>

            {/* Ascension Panel */}
            <li style={{ listStyle: "none" }}>
              <div className="room-item my-box" style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
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
            </li>
          </ul>
          <div className="my-box" style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px" }}>
            <img
              src={getPortraitSrc(avatarIndex)}
              alt="avatar"
              style={{ width: 40, height: 40, imageRendering: "pixelated" }}
            />
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Player Name"
              maxLength={20}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: "4px",
                border: "1px solid #555",
                background: "rgba(0,0,0,0.3)",
                color: "white",
                fontSize: "14px",
                fontFamily: "inherit"
              }}
            />
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
          </div>
        </div>
      </section>

      <section
        className={cc("events", {
          active: activeSection === "events"
        })}
      >
        <div className="my-container custom-bg hidden-scrollable" style={{ padding: "12px 16px", fontSize: "14px", lineHeight: "1.6" }}>
          <h2>Dev Notes</h2>
          <ul style={{ paddingLeft: "20px", margin: "8px 0" }}>
            <li>Join the <a href="https://discord.gg/cfytB2kA" target="_blank" rel="noopener noreferrer" style={{ color: "#7289da" }}>Pokemon Auto Spire Discord</a></li>
            <li>Made by fish in the PAC Discord. Message him in the PAC roguelike mod channel in the community section for feedback.</li>
            <li>Poorly hosted on a server in Sydney.</li>
            <li>Still lots of balancing to do.</li>
            <li>I have not decided how Pokemon rarity should be distributed throughout.</li>
          </ul>
        </div>
      </section>

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
