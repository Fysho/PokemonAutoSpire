import type { ArraySchema } from "@colyseus/schema"
import type React from "react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AutoSizer } from "react-virtualized-auto-sizer"
import { List, useDynamicRowHeight } from "react-window"
import { SynergyTriggers } from "../../../../../config"
import {
  IPokemonRecord
} from "../../../../../models/colyseus-models/game-record"
import { computeSynergies } from "../../../../../models/colyseus-models/synergies"
import PokemonFactory from "../../../../../models/pokemon-factory"
import type { Synergy } from "../../../../../types/enum/Synergy"
import { formatDate } from "../../utils/date"
import Team from "../after/team"
import SynergyIcon from "../icons/synergy-icon"
import "./game-history.css"

const ROW_HEIGHT = 72

interface IRunHistoryRecord {
  time: number
  currentAct: number
  currentFloor: number
  difficultyMode: number
  runHP: number
  arceusDamageDealt: number
  victory: boolean
  pokemons: { name: string; avatar: string; items: string[] }[]
  synergies?: { type: string; count: number }[]
}

export default function GameHistory(props: {
  uid: string
  onUpdate?: (history: IRunHistoryRecord[]) => void
}) {
  const { t } = useTranslation()
  const [runHistory, setRunHistory] = useState<IRunHistoryRecord[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [hasMore, setHasMore] = useState<boolean>(true)

  useEffect(() => {
    if (props.onUpdate) {
      props.onUpdate(runHistory)
    }
  }, [runHistory, props.onUpdate])

  const pageSize = 10
  const loadHistory = async (uid: string, page: number) => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/run-history/${uid}?page=${page}&t=${Date.now()}`
      )
      const data: IRunHistoryRecord[] = await response.json()
      if (props.uid !== uid) return

      if (data.length < pageSize) {
        setHasMore(false)
      }

      setRunHistory((prev) => [
        ...prev,
        ...data.filter(
          (h) => prev.some((p) => p.time == h.time) == false
        )
      ])
    } catch (error) {
      console.error("Failed to load run history:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (loading || !hasMore) return
    const skip = runHistory.length
    const page = Math.floor(skip / pageSize + 1)
    loadHistory(props.uid, page)
  }

  useEffect(() => {
    setRunHistory([])
    setHasMore(true)
    loadHistory(props.uid, 1)
  }, [props.uid])

  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: ROW_HEIGHT,
    key: runHistory.length
  })

  const handleRowsRendered = useCallback(
    (
      _visibleRows: { startIndex: number; stopIndex: number },
      allRows: { startIndex: number; stopIndex: number }
    ) => {
      if (hasMore && !loading && allRows.stopIndex >= runHistory.length - 3) {
        loadMore()
      }
    },
    [hasMore, loading, runHistory.length]
  )

  return (
    <article className="game-history-list">
      <h2>Run History</h2>
      <div style={{ flex: 1, minHeight: 0 }}>
        {(!runHistory || runHistory.length === 0) && (
          <p>{t("no_history_found")}</p>
        )}
        {runHistory && runHistory.length > 0 && (
          <AutoSizer
            renderProp={({ height, width }) => {
              if (height === undefined || width === undefined) return null
              return (
                <List<RunHistoryRowData>
                  style={{ height, width }}
                  rowCount={runHistory.length}
                  rowHeight={dynamicRowHeight}
                  rowComponent={RunHistoryRow}
                  rowProps={{
                    runHistory
                  }}
                  onRowsRendered={handleRowsRendered}
                />
              )
            }}
          />
        )}
      </div>
    </article>
  )
}

type RunHistoryRowData = {
  runHistory: IRunHistoryRecord[]
}

const DIFFICULTY_LABELS: Record<number, string> = {
  0: "Easy",
  1: "Normal",
  2: "Hard",
  3: "Impossible"
}

function RunHistoryRow({
  index,
  style,
  runHistory
}: {
  ariaAttributes: object
  index: number
  style: React.CSSProperties
} & RunHistoryRowData): React.ReactElement | null {
  const r = runHistory[index]

  const diffLabel = DIFFICULTY_LABELS[r.difficultyMode] ?? "Normal"
  // Show how far the run actually got, not a blanket "Champion!". Acts 1-3 → the
  // act/floor reached. Act 4 = the Elite Four: floors 1-4 are E4 members #1-4, floor
  // 5 is the Champion. Beating Act 3 without entering the Elite Four is the canonical
  // single-player victory. Arceus (Act 5) is ignored here by design — it's capped to
  // Act 4 / floor 5 in the record, and a run that ended earlier in the Elite Four is
  // never overwritten by an Arceus attempt, so the furthest *ladder* point shows.
  let progressLabel: string
  if (r.currentAct >= 4) {
    if (r.currentFloor >= 5) progressLabel = `${diffLabel} Champion`
    else if (r.currentFloor >= 1) progressLabel = `${diffLabel} Elite Four ${r.currentFloor}`
    else progressLabel = `${diffLabel} Elite Four`
  } else if (r.victory) {
    progressLabel = `${diffLabel} Victory`
  } else {
    progressLabel = `${diffLabel} Act ${r.currentAct} Floor ${r.currentFloor}`
  }

  const pokemons: IPokemonRecord[] = r.pokemons.map((p) => ({
    name: p.name as any,
    avatar: p.avatar,
    items: p.items as any
  }))

  return (
    <div style={style}>
      <div className="my-box game-history">
        <span className="top" style={{ color: r.victory ? "#f1c40f" : undefined }}>
          {progressLabel}
          <span style={{ fontSize: "11px", color: "#f1c40f", marginLeft: "4px" }}>
            {r.arceusDamageDealt.toLocaleString()} arceus damage
          </span>
        </span>
        <ul className="synergies">
          {(r.synergies && r.synergies.length > 0
            ? topStoredSynergies(r.synergies)
            : getTopSynergies(pokemons)
          ).map(([type, value]) => (
            <li key={r.time + type}>
              <SynergyIcon type={type} />
              <span>{value}</span>
            </li>
          ))}
        </ul>
        <p className="date">{formatDate(r.time)}</p>
        <Team team={pokemons}></Team>
      </div>
    </div>
  )
}

function getTopSynergies(
  team: IPokemonRecord[] | ArraySchema<IPokemonRecord>
): [Synergy, number][] {
  const synergies = computeSynergies(
    team.map((pkmRecord) => {
      const pkm = PokemonFactory.createPokemonFromName(pkmRecord.name)
      pkm.positionY = 1
      pkmRecord.items.forEach((item) => {
        pkm.items.add(item)
      })
      return pkm
    })
  )

  return sortTopSynergies([...synergies.entries()])
}

// Render synergies captured at save time (server-authoritative — includes gem
// bonus synergies, type-changing stones, Dragon double-types, etc.)
function topStoredSynergies(
  stored: { type: string; count: number }[]
): [Synergy, number][] {
  const entries = stored
    .filter((s) => s.type in SynergyTriggers)
    .map((s) => [s.type as Synergy, s.count] as [Synergy, number])
  return sortTopSynergies(entries)
}

function sortTopSynergies(
  entries: [Synergy, number][]
): [Synergy, number][] {
  return entries
    .sort((a, b) => {
      const [typeA, valueA] = a
      const [typeB, valueB] = b
      const aTriggerReached = SynergyTriggers[typeA].filter(
        (n) => valueA >= n
      ).length
      const bTriggerReached = SynergyTriggers[typeB].filter(
        (n) => valueB >= n
      ).length
      return aTriggerReached !== bTriggerReached
        ? bTriggerReached - aTriggerReached
        : valueB - valueA
    })
    .slice(0, 4)
}
