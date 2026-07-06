import { useCallback, useEffect, useState } from "react"
import { PkmIndex, type Pkm } from "../../../../../types/enum/Pokemon"
import { useAppSelector } from "../../../hooks"
import PokemonPortrait from "../pokemon-portrait"
import "./leaderboard-manager.css"

type Board = "champion" | "arceus" | "endless" | "victory"

const BOARDS: { id: Board; label: string; perDifficulty: boolean }[] = [
  { id: "champion", label: "Champion / Elite Four", perDifficulty: true },
  { id: "arceus", label: "Arceus Damage", perDifficulty: true },
  { id: "endless", label: "Endless Records", perDifficulty: false },
  { id: "victory", label: "Victory Records", perDifficulty: true }
]

const DIFFICULTIES = [
  { mode: 0, label: "Easy" },
  { mode: 1, label: "Normal" },
  { mode: 2, label: "Hard" },
  { mode: 3, label: "Impossible" }
]

type ChampionSnap = {
  name: string
  avatar: string
  pokemon: { name: string; items: string[] }[]
  victories: number
  ties: number
}
type ChampionData = { champion: ChampionSnap; eliteFour: ChampionSnap[] }
type ArceusEntry = { name: string; avatar: string; damage: number; pokemon: { name: string }[] }
type EndlessEntry = { name: string; avatar: string; act: number; floor: number; pokemon: { name: string }[] }
type VictoryEntry = {
  odToken: string
  name: string
  avatar: string
  totalVictories: number
  longestStreak: number
}

type ConfirmState = { message: string; onConfirm: () => void } | null

function TeamPortraits({ pokemon }: { pokemon: { name: string }[] }) {
  return (
    <div className="lbm-team">
      {pokemon.slice(0, 9).map((p, i) =>
        PkmIndex[p.name as Pkm] ? (
          <PokemonPortrait
            key={i}
            portrait={{ index: PkmIndex[p.name as Pkm] }}
            className="lbm-team-portrait"
          />
        ) : null
      )}
    </div>
  )
}

export default function LeaderboardManager() {
  const uid = useAppSelector((state) => state.network.uid)
  const [board, setBoard] = useState<Board>("champion")
  const [difficulty, setDifficulty] = useState(1)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  const boardMeta = BOARDS.find((b) => b.id === board)!

  const fetchData = useCallback(async () => {
    setLoading(true)
    setStatus("")
    // Clear stale data up front: switching boards flips `board` a render before
    // the new data arrives, and the previous board's shape (e.g. an array) would
    // otherwise be rendered by the new board's component and crash.
    setData(null)
    try {
      let url = ""
      if (board === "champion") url = `/api/champion-data/${difficulty}`
      else if (board === "arceus") url = `/api/arceus-record/${difficulty}`
      else if (board === "endless") url = `/api/endless-record`
      else url = `/api/admin/victory-records/${difficulty}?uid=${encodeURIComponent(uid)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setData(null)
      setStatus("Failed to load this leaderboard.")
    } finally {
      setLoading(false)
    }
  }, [board, difficulty, uid])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const post = useCallback(
    async (path: string, body: Record<string, unknown>, okMessage: string) => {
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, board, ...body })
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.ok) {
          setStatus(`Action failed: ${json.error ?? res.status}`)
          return
        }
        setStatus(okMessage)
        await fetchData()
      } catch (e) {
        setStatus("Action failed (network error).")
      }
    },
    [uid, board, fetchData]
  )

  const wipe = () => {
    const diffLabel = boardMeta.perDifficulty
      ? ` (${DIFFICULTIES.find((d) => d.mode === difficulty)?.label})`
      : ""
    setConfirm({
      message: `Wipe the entire "${boardMeta.label}"${diffLabel} board? This cannot be undone.`,
      onConfirm: () =>
        post("/api/admin/leaderboard/wipe", { difficulty }, "Board wiped.")
    })
  }

  const removeEntry = (
    body: Record<string, unknown>,
    message: string,
    okMessage: string
  ) => {
    setConfirm({
      message,
      onConfirm: () =>
        post("/api/admin/leaderboard/remove", { difficulty, ...body }, okMessage)
    })
  }

  return (
    <div className="leaderboard-manager">
      <p className="lbm-intro">
        Admin tools to wipe a Spire leaderboard or remove individual entries.
        Removing an Elite Four team shuffles the weaker teams up and seeds a
        fresh Magikarp at Elite Four #1.
      </p>

      <div className="lbm-tabs">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            className={`bubbly ${board === b.id ? "blue" : ""}`}
            onClick={() => setBoard(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {boardMeta.perDifficulty && (
        <div className="lbm-difficulties">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.mode}
              className={`bubbly ${difficulty === d.mode ? "green" : ""}`}
              onClick={() => setDifficulty(d.mode)}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      <div className="lbm-actions">
        <button className="bubbly red" onClick={wipe}>
          Wipe this board
        </button>
        <button className="bubbly" onClick={fetchData}>
          Refresh
        </button>
        {status && <span className="lbm-status">{status}</span>}
      </div>

      <div className="lbm-list">
        {loading && <p>Loading…</p>}

        {!loading && board === "champion" && data?.champion && (
          <ChampionBoard data={data as ChampionData} removeEntry={removeEntry} />
        )}

        {!loading && board === "arceus" && Array.isArray(data) && (
          <ArceusBoard rows={data as ArceusEntry[]} removeEntry={removeEntry} />
        )}

        {!loading && board === "endless" && Array.isArray(data) && (
          <EndlessBoard rows={data as EndlessEntry[]} removeEntry={removeEntry} />
        )}

        {!loading && board === "victory" && Array.isArray(data) && (
          <VictoryBoard rows={data as VictoryEntry[]} removeEntry={removeEntry} />
        )}
      </div>

      {confirm && (
        <div className="lbm-confirm-overlay">
          <div className="my-container lbm-confirm">
            <p>{confirm.message}</p>
            <div className="lbm-confirm-actions">
              <button
                className="bubbly red"
                onClick={() => {
                  confirm.onConfirm()
                  setConfirm(null)
                }}
              >
                Confirm
              </button>
              <button className="bubbly" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  avatar,
  title,
  subtitle,
  pokemon,
  onRemove
}: {
  avatar?: string
  title: string
  subtitle: string
  pokemon?: { name: string }[]
  onRemove: () => void
}) {
  return (
    <div className="my-box lbm-row">
      {avatar && <PokemonPortrait avatar={avatar} className="lbm-avatar" />}
      <div className="lbm-row-info">
        <span className="lbm-row-title">{title}</span>
        <span className="lbm-row-subtitle">{subtitle}</span>
        {pokemon && pokemon.length > 0 && <TeamPortraits pokemon={pokemon} />}
      </div>
      <button className="bubbly red lbm-remove" onClick={onRemove}>
        Remove
      </button>
    </div>
  )
}

function ChampionBoard({
  data,
  removeEntry
}: {
  data: ChampionData
  removeEntry: (body: Record<string, unknown>, message: string, okMessage: string) => void
}) {
  return (
    <>
      <Row
        avatar={data.champion.avatar}
        title={`Champion — ${data.champion.name}`}
        subtitle={`${data.champion.victories} wins · ${data.champion.ties} draws`}
        pokemon={data.champion.pokemon}
        onRemove={() =>
          removeEntry(
            { slot: "champion" },
            `Remove Champion "${data.champion.name}"? Elite Four #4 will be promoted to Champion, the rest shuffle up, and Elite Four #1 becomes a Magikarp.`,
            "Champion removed; ladder cascaded."
          )
        }
      />
      {(data.eliteFour ?? []).map((e, i) => (
        <Row
          key={i}
          avatar={e.avatar}
          title={`Elite Four #${i + 1} — ${e.name}`}
          subtitle={`${e.victories} wins · ${e.ties} draws`}
          pokemon={e.pokemon}
          onRemove={() =>
            removeEntry(
              { slot: i },
              `Remove Elite Four #${i + 1} "${e.name}"? The teams below shuffle up and Elite Four #1 becomes a Magikarp.`,
              `Elite Four #${i + 1} removed; ladder cascaded.`
            )
          }
        />
      ))}
    </>
  )
}

function ArceusBoard({
  rows,
  removeEntry
}: {
  rows: ArceusEntry[]
  removeEntry: (body: Record<string, unknown>, message: string, okMessage: string) => void
}) {
  if (rows.length === 0) return <p className="lbm-empty">No Arceus records.</p>
  return (
    <>
      {rows.map((r, i) => (
        <Row
          key={i}
          avatar={r.avatar}
          title={`#${i + 1} — ${r.name}`}
          subtitle={`${r.damage.toLocaleString()} damage`}
          pokemon={r.pokemon}
          onRemove={() =>
            removeEntry(
              { index: i },
              `Remove Arceus record #${i + 1} by "${r.name}" (${r.damage.toLocaleString()} damage)?`,
              "Arceus record removed."
            )
          }
        />
      ))}
    </>
  )
}

function EndlessBoard({
  rows,
  removeEntry
}: {
  rows: EndlessEntry[]
  removeEntry: (body: Record<string, unknown>, message: string, okMessage: string) => void
}) {
  if (rows.length === 0) return <p className="lbm-empty">No endless records.</p>
  return (
    <>
      {rows.map((r, i) => (
        <Row
          key={i}
          avatar={r.avatar}
          title={`#${i + 1} — ${r.name}`}
          subtitle={`Act ${r.act} · Floor ${r.floor}`}
          pokemon={r.pokemon}
          onRemove={() =>
            removeEntry(
              { index: i },
              `Remove endless record #${i + 1} by "${r.name}" (Act ${r.act} Floor ${r.floor})?`,
              "Endless record removed."
            )
          }
        />
      ))}
    </>
  )
}

function VictoryBoard({
  rows,
  removeEntry
}: {
  rows: VictoryEntry[]
  removeEntry: (body: Record<string, unknown>, message: string, okMessage: string) => void
}) {
  if (rows.length === 0) return <p className="lbm-empty">No victory records.</p>
  return (
    <>
      {rows.map((r) => (
        <Row
          key={r.odToken}
          avatar={r.avatar}
          title={r.name}
          subtitle={`${r.totalVictories} wins · longest streak ${r.longestStreak}`}
          onRemove={() =>
            removeEntry(
              { odToken: r.odToken },
              `Remove victory record for "${r.name}" (${r.totalVictories} wins)?`,
              "Victory record removed."
            )
          }
        />
      ))}
    </>
  )
}
