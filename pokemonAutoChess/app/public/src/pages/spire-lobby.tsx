import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { authenticateUser, client, joinGame } from "../network"
import { EloRank } from "../../../types/enum/EloRank"
import { Pkm, PkmIndex } from "../../../types/enum/Pokemon"
import { getPortraitSrc } from "../../../utils/avatar"
import { MainSidebar } from "./component/main-sidebar/main-sidebar"
import { cc } from "./utils/jsx"
import { LocalStoreKeys, localStore } from "./utils/store"
import "./lobby.css"

const ASCENSION_RANKS: { rank: EloRank; name: string; description: string }[] = [
  { rank: EloRank.LEVEL_BALL, name: "Level Ball", description: "No modifiers. The standard ascension experience." },
  { rank: EloRank.NET_BALL, name: "Net Ball", description: "Starter Pokemon cannot be Epic or Ultra rarity." },
  { rank: EloRank.SAFARI_BALL, name: "Safari Ball", description: "More Elite encounters appear on the map." },
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
  const [starting, setStarting] = useState(false)
  const [playerName, setPlayerName] = useState(() => localStore.get(LocalStoreKeys.SPIRE_PLAYER_NAME) ?? "Username")
  const [avatarPkm, setAvatarPkm] = useState<Pkm>(() => (localStore.get(LocalStoreKeys.SPIRE_PLAYER_AVATAR) as Pkm) || Pkm.RATTATA)

  useEffect(() => {
    authenticateUser()
  }, [])

  useEffect(() => {
    localStore.set(LocalStoreKeys.SPIRE_PLAYER_NAME, playerName)
  }, [playerName])

  useEffect(() => {
    localStore.set(LocalStoreKeys.SPIRE_PLAYER_AVATAR, avatarPkm)
  }, [avatarPkm])

  const avatarIndex = PkmIndex[avatarPkm] ?? PkmIndex[Pkm.RATTATA]
  const avatarString = `${avatarIndex.replace("-", "/")}/Normal`

  async function startRun(difficultyMode: number = 1, ascensionRank?: EloRank) {
    if (starting) return
    setStarting(true)
    const name = playerName.trim() || "Username"
    try {
      await authenticateUser()
      const room = await client.create("game", {
        odToken: "local-player",
        displayName: name,
        users: {
          "local-player": {
            uid: "local-player",
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
        ascensionRank: ascensionRank ?? null
      })
      joinGame(room)
      navigate("/game")
    } catch (err) {
      console.error("Failed to start game:", err)
      setStarting(false)
    }
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
          starting={starting}
          playerName={playerName}
          setPlayerName={setPlayerName}
          avatarPkm={avatarPkm}
          setAvatarPkm={setAvatarPkm}
          avatarIndex={avatarIndex}
        />
      </div>
    </main>
  )
}

function SpireLobbyContent({
  startRun,
  starting,
  playerName,
  setPlayerName,
  avatarPkm,
  setAvatarPkm,
  avatarIndex
}: {
  startRun: (difficultyMode: number, ascensionRank?: EloRank) => void
  starting: boolean
  playerName: string
  setPlayerName: (name: string) => void
  avatarPkm: Pkm
  setAvatarPkm: (pkm: Pkm) => void
  avatarIndex: string
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
          <h2>{t("rooms")}</h2>
          <ul className="room-list" style={{ padding: 0 }}>
            <li style={{ listStyle: "none" }}>
              <div className="room-item my-box" style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                <span className="room-name">Pokemon Auto Spire v1.1</span>
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
            <li>Made by fish in the PAC Discord. Message him in the PAC roguelike mod channel in the community section for feedback.</li>
            <li>Poorly hosted on a server in Sydney.</li>
            <li>Still lots of balancing to do.</li>
            <li>I have not decided how Pokemon rarity should be distributed throughout.</li>
            <li>No data or progression is saved, that will come in the future.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
