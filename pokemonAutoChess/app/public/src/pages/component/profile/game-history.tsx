import { ArraySchema } from "@colyseus/schema"
import React, { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AutoSizer } from "react-virtualized-auto-sizer"
import { List, useDynamicRowHeight } from "react-window"
import { SynergyTriggers } from "../../../../../config"
import {
  IPokemonRecord
} from "../../../../../models/colyseus-models/game-record"
import { computeSynergies } from "../../../../../models/colyseus-models/synergies"
import PokemonFactory from "../../../../../models/pokemon-factory"
import { Synergy } from "../../../../../types/enum/Synergy"
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
  2: "Hard"
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
  const progressLabel = r.victory
    ? `${diffLabel} Champion!`
    : `${diffLabel} Act ${r.currentAct} Floor ${r.currentFloor}`

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
          {getTopSynergies(pokemons).map(([type, value]) => (
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

  const topSynergies = [...synergies.entries()]
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
  return topSynergies
}
