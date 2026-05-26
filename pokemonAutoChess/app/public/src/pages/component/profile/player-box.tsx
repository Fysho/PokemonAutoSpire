import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { getPokemonData } from "../../../../../models/precomputed/precomputed-pokemon-data"
import { Role } from "../../../../../types"
import { Pkm, PkmIndex } from "../../../../../types/enum/Pokemon"
import { Synergy } from "../../../../../types/enum/Synergy"
import {
  IUserMetadataClient,
  IUserMetadataUnpacked,
  ISpireStats,
  ISpireDiffStats
} from "../../../../../types/interfaces/UserMetadata"
import { useAppSelector } from "../../../hooks"
import SynergyIcon from "../icons/synergy-icon"
import PokemonPortrait from "../pokemon-portrait"
import { RoleBadge } from "./role-badge"

export default function PlayerBox(props: {
  user: IUserMetadataClient | IUserMetadataUnpacked
  history?: { pokemons: { name: string }[] }[]
}) {
  const { t } = useTranslation()
  const role = useAppSelector((state) => state.network.profile?.role)

  const pokemons: Pkm[] = []
  const [favoritePokemons, setFavoritePokemons] = useState<Pkm[]>([])
  const [favoriteSynergies, setFavoriteSynergies] = useState<Synergy[]>([])
  const [spireStats, setSpireStats] = useState<ISpireStats | undefined>(props.user.spireStats)

  useEffect(() => {
    if (props.user.uid && props.user.uid !== "local-player") {
      fetch(`/api/spire-stats/${props.user.uid}`)
        .then((r) => r.json())
        .then((data) => setSpireStats(data))
        .catch(() => {})
    }
  }, [props.user.uid])
  const twitchUrl = props.user.twitchLogin
    ? `https://www.twitch.tv/${props.user.twitchLogin}`
    : null

  useEffect(() => {
    if (!props.history) return
    props.history.forEach((record) =>
      pokemons.push(...record.pokemons.map((p) => p.name.toUpperCase() as Pkm))
    )
    const countPokemons = new Map()
    const countSynergies = new Map()
    pokemons.forEach((p) => {
      countPokemons.set(p, (countPokemons.get(p) ?? 0) + 1)
      getPokemonData(p).types.forEach((type) => {
        countSynergies.set(type, (countSynergies.get(type) ?? 0) + 1)
      })
    })
    const favoritePokemons = [...countPokemons.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => k)
    const favoriteSynergies = [...countSynergies.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => k)

    setFavoritePokemons(favoritePokemons)
    setFavoriteSynergies(favoriteSynergies)
  }, [props.history])

  return (
    <div className="player my-box">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5em" }}>
          <PokemonPortrait avatar={props.user.avatar} />
          {props.user.title && (
            <p className="player-title">{t(`title.${props.user.title}`)}</p>
          )}
          <RoleBadge role={props.user.role} />
          {props.user.banned && (
            <div className="badge banned">{t("banned")}</div>
          )}
          <p
            className="player-display-name"
            style={{
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis"
            }}
          >
            {props.user.displayName}
          </p>
          {twitchUrl && (
            <a
              className="twitch-badge-link"
              href={twitchUrl}
              target="_blank"
              rel="noreferrer"
              title={`Watch ${props.user.twitchDisplayName ?? props.user.twitchLogin} on Twitch`}
              aria-label={`Watch ${props.user.twitchDisplayName ?? props.user.twitchLogin} on Twitch`}
            >
              <img src="/assets/ui/twitch.png" alt="" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
      <SpireStatsTable stats={spireStats} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <p> {t("favorites")}:</p>
        <p>
          {favoriteSynergies.map((type) => (
            <SynergyIcon type={type} key={"fav_" + type} />
          ))}
        </p>
        <p>
          {favoritePokemons.map((name) => (
            <PokemonPortrait key={name} avatar={PkmIndex[name] + "/Normal"} />
          ))}
        </p>
      </div>
      {(role === Role.ADMIN || role === Role.MODERATOR) && (
        <p style={{ color: "#aaa", fontSize: "60%" }}>
          {t("profile.account.user_id")}: {props.user.uid}
        </p>
      )}
    </div>
  )
}

const DEFAULT_DIFF: ISpireDiffStats = { runsStarted: 0, wins: 0, champion: 0, arceusDamage: 0 }

function SpireStatsTable({ stats }: { stats?: ISpireStats }) {
  const s = stats ?? { easy: DEFAULT_DIFF, normal: DEFAULT_DIFF, hard: DEFAULT_DIFF }
  const rows: { label: string; color: string; data: ISpireDiffStats }[] = [
    { label: "Hard", color: "#e74c3c", data: s.hard ?? DEFAULT_DIFF },
    { label: "Normal", color: "#f39c12", data: s.normal ?? DEFAULT_DIFF },
    { label: "Easy", color: "#27ae60", data: s.easy ?? DEFAULT_DIFF }
  ]
  return (
    <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse", margin: "6px 0" }}>
      <thead>
        <tr style={{ opacity: 0.6 }}>
          <th style={{ textAlign: "left", padding: "2px 6px" }}></th>
          <th style={{ textAlign: "center", padding: "2px 6px" }}>Runs</th>
          <th style={{ textAlign: "center", padding: "2px 6px" }}>Wins</th>
          <th style={{ textAlign: "center", padding: "2px 6px" }}>Champion</th>
          <th style={{ textAlign: "center", padding: "2px 6px" }}>Arceus Dmg</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td style={{ fontWeight: "bold", color: r.color, padding: "2px 6px" }}>{r.label}</td>
            <td style={{ textAlign: "center", padding: "2px 6px" }}>{r.data.runsStarted}</td>
            <td style={{ textAlign: "center", padding: "2px 6px" }}>{r.data.wins}</td>
            <td style={{ textAlign: "center", padding: "2px 6px" }}>{r.data.champion}</td>
            <td style={{ textAlign: "center", padding: "2px 6px" }}>{r.data.arceusDamage.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
