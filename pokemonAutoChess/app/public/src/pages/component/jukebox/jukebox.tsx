import type React from "react"
import { type Dispatch, type SetStateAction, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  DungeonMusic,
  DungeonMusicCredits
} from "../../../../../types/enum/Dungeon"
import { RegionDetails } from "../../../../../config"
import { pickRandomIn } from "../../../../../utils/random"
import { usePreference } from "../../../preferences"
import { selectSpectatedPlayer, useAppSelector } from "../../../hooks"
import { getGameScene } from "../../game"
import {
  getMusicMode,
  loadAndPlayMusic,
  type MusicMode,
  setMusicMode
} from "../../utils/audio"
import { cc } from "../../utils/jsx"
import { Modal } from "../modal/modal"
import "./jukebox.css"

export default function Jukebox(props: {
  show: boolean
  handleClose: Dispatch<SetStateAction<void>>
}) {
  const { t } = useTranslation()

  const MUSICS: DungeonMusic[] = Object.values(DungeonMusic)

  const musicPlaying = getGameScene()?.music?.key?.replace(
    "music_",
    ""
  ) as DungeonMusic
  const [music, setMusic] = useState<DungeonMusic>(musicPlaying)
  const [loading, setLoading] = useState<boolean>(false)
  const [volume, setVolume] = usePreference("musicVolume")
  const [mode, setModeState] = useState<MusicMode>(getMusicMode())
  const spectatedPlayer = useAppSelector(selectSpectatedPlayer)

  useEffect(() => {
    if (musicPlaying !== music && !loading) {
      setMusic(musicPlaying)
    }
  }, [music, musicPlaying, loading])

  const credits = DungeonMusicCredits[musicPlaying] ?? null

  // A jukebox pick switches the music mode so region/map changes stop
  // overriding it (Spire resets the map to "town" after every node, which
  // used to force the track back to Treasure Town). Shuffle plays unlooped
  // and chains random tracks (handled in utils/audio playMusic).
  function changeMode(newMode: MusicMode) {
    setMusicMode(newMode)
    setModeState(newMode)
  }

  function changeMusic(name: DungeonMusic, newMode: MusicMode = "manual") {
    changeMode(newMode)
    setMusic(name)
    const gameScene = getGameScene()
    if (gameScene) {
      gameScene.music?.destroy()
      setLoading(true)
      loadAndPlayMusic(gameScene, name, () => setLoading(false))
    }
  }

  function backToAuto() {
    changeMode("auto")
    // Resume the current region's music right away
    const map = spectatedPlayer?.map as keyof typeof RegionDetails | undefined
    const regionMusic = map
      ? (RegionDetails[map]?.music ?? DungeonMusic.TREASURE_TOWN)
      : null
    const gameScene = getGameScene()
    if (gameScene && regionMusic) {
      setMusic(regionMusic)
      setLoading(true)
      loadAndPlayMusic(gameScene, regionMusic, () => setLoading(false))
    }
  }

  function handleVolumeChange(e: React.InputEvent<HTMLInputElement>) {
    const newVolume = Number(e.currentTarget.value)
    setVolume(newVolume)
  }

  function nextMusic(delta: number) {
    const newIndex =
      (MUSICS.indexOf(music) + MUSICS.length + delta) % MUSICS.length
    changeMusic(MUSICS[newIndex])
  }

  function randomizeMusic() {
    const newMusic = pickRandomIn(MUSICS.filter((m) => m !== music))
    changeMusic(newMusic, "shuffle")
  }

  return (
    <Modal
      show={props.show}
      onClose={props.handleClose}
      className="game-jukebox-modal"
      header={t("gadget.jukebox")}
    >
      <div className="actions" style={{ marginBottom: "0.5em" }}>
        <button
          className="bubbly blue"
          onClick={() => nextMusic(-1)}
          title={t("jukebox.previous_music")}
        >
          ◄
        </button>
        <div className={cc("compact-disc", { loading })}>
          <img src="/assets/ui/compact-disc.svg" />
          <span>{loading && t("loading")}</span>
        </div>
        <button
          className="bubbly blue"
          onClick={() => nextMusic(+1)}
          title={t("jukebox.next_music")}
        >
          ►
        </button>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "0.5em",
          marginBottom: "0.5em"
        }}
      >
        <select
          value={music}
          onChange={(e) => changeMusic(e.target.value as DungeonMusic)}
          className="is-light"
        >
          {MUSICS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button
          className={cc("bubbly", mode === "shuffle" ? "green" : "blue")}
          onClick={() => randomizeMusic()}
          title={
            mode === "shuffle"
              ? "Shuffle is on: a new random track plays when this one ends"
              : t("jukebox.random_music")
          }
        >
          <img src="/assets/ui/randomize.svg" style={{ marginRight: 0 }} />
        </button>
        <button
          className={cc("bubbly", mode === "auto" ? "green" : "blue")}
          onClick={() => backToAuto()}
          disabled={mode === "auto"}
          title="Follow the region music (changes with the map)"
        >
          Auto
        </button>
      </div>

      <p style={{ textAlign: "center", fontSize: "80%", opacity: 0.7, margin: "0 0 0.5em" }}>
        {mode === "auto"
          ? "Music follows the current region"
          : mode === "shuffle"
            ? "Shuffle: random track when this one ends"
            : "Playing your pick on loop"}
      </p>

      {credits ? (
        <p className="credits">
          {t("jukebox.music_credits")}: {credits}
        </p>
      ) : (
        <></>
      )}

      <p>
        <label className="full-width">
          {t("jukebox.music_volume")}: {volume} %
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onInput={handleVolumeChange}
          ></input>
        </label>
      </p>
    </Modal>
  )
}
