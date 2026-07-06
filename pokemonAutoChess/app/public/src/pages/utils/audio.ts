import type Phaser from "phaser"
import type { Scene } from "phaser"
import { DungeonMusic } from "../../../../types/enum/Dungeon"
import { logger } from "../../../../utils/logger"
import { pickRandomIn } from "../../../../utils/random"
import { preference, subscribeToPreferences } from "../../preferences"

/** How background music is driven:
 * - "auto": follows the current region/map (default — the map listener in
 *   game.tsx switches tracks on every player.map change)
 * - "manual": the player picked a track in the jukebox; region changes no
 *   longer override it (Spire resets player.map to "town" after every node,
 *   which used to clobber the pick back to Treasure Town)
 * - "shuffle": like manual, but the track plays unlooped and a new random
 *   one starts when it ends */
export type MusicMode = "auto" | "manual" | "shuffle"
let musicMode: MusicMode = "auto"

export function getMusicMode(): MusicMode {
  return musicMode
}

export function setMusicMode(mode: MusicMode) {
  musicMode = mode
}

export const SOUNDS = {
  BUTTON_CLICK: "buttonclick.ogg",
  BUTTON_HOVER: "buttonhover.ogg",
  CAROUSEL_UNLOCK: "carouselunlock.ogg",
  EVOLUTION_T2: "evolutiont2.ogg",
  EVOLUTION_T3: "evolutiont3.ogg",
  FINISH1: "finish1.ogg",
  FINISH2: "finish2.ogg",
  FINISH3: "finish3.ogg",
  FINISH4: "finish4.ogg",
  FINISH5: "finish5.ogg",
  FINISH6: "finish6.ogg",
  FINISH7: "finish7.ogg",
  FINISH8: "finish8.ogg",
  JOIN_ROOM: "joinroom.ogg",
  LEAVE_ROOM: "leaveroom.ogg",
  REFRESH: "refresh.ogg",
  SET_READY: "setready.ogg",
  START_GAME: "startgame.ogg"
} as const

type Soundkey = (typeof SOUNDS)[keyof typeof SOUNDS]

const AUDIO_ELEMENTS: { [K in Soundkey]?: HTMLAudioElement } = {}

export function preloadSounds() {
  Object.values(SOUNDS).forEach(
    (sound) => (AUDIO_ELEMENTS[sound] = new Audio(`assets/sounds/${sound}`))
  )
}

export function preloadMusic(
  scene: Scene,
  dungeonMusic: DungeonMusic,
  alt = ""
) {
  scene.load.audio("music_" + dungeonMusic, [
    `assets/musics/ogg/${dungeonMusic}${alt}.ogg`
  ])
}

function setupSounds() {
  document.body.addEventListener("mouseover", (e) => {
    if (e.target instanceof HTMLButtonElement) {
      playSound(SOUNDS.BUTTON_HOVER)
    }
  })
  document.body.addEventListener("click", (e) => {
    if (
      e.target instanceof HTMLButtonElement ||
      (e.target instanceof HTMLElement && e.target.closest("button") != null)
    ) {
      playSound(SOUNDS.BUTTON_CLICK)
    }
  })
}

preloadSounds()
setupSounds()

export function playSound(key: Soundkey, volume = 1) {
  const sound = AUDIO_ELEMENTS[key]
  if (sound) {
    sound.currentTime = 0
    sound.volume = (volume * preference("sfxVolume")) / 100
    sound.play()
  }
}

interface SceneWithMusic extends Phaser.Scene {
  music?: Phaser.Sound.WebAudioSound
}

export function playMusic(scene: SceneWithMusic, name: string) {
  if (scene == null || scene.music?.key === "music_" + name) return
  if (scene.music) scene.music.destroy()

  try {
    const loop = musicMode !== "shuffle"
    const music = scene.sound.add("music_" + name, {
      loop
    }) as Phaser.Sound.WebAudioSound

    const unsubscribeToPreferences = subscribeToPreferences(
      ({ musicVolume }) => {
        music.setVolume(musicVolume / 100)
      }
    )
    music.on("stop", unsubscribeToPreferences)

    scene.music = music
    scene.sound.pauseOnBlur = !preference("playInBackground")

    scene.music.play({
      volume: preference("musicVolume") / 100,
      loop
    })

    if (!loop) {
      // Shuffle: chain into a new random track when this one ends
      music.once("complete", () => {
        if (musicMode !== "shuffle" || scene.music !== music) return
        const next = pickRandomIn(
          Object.values(DungeonMusic).filter((m) => m !== name)
        )
        loadAndPlayMusic(scene, next)
      })
    }
  } catch (err) {
    logger.error("can't play music", err)
  }
}

/** Play a track, loading its audio on demand first if it isn't cached yet.
 * onReady fires once the track actually starts. */
export function loadAndPlayMusic(
  scene: SceneWithMusic,
  name: DungeonMusic,
  onReady?: () => void
) {
  if (scene == null) return
  const musicKey = "music_" + name
  if (scene.cache.audio.exists(musicKey)) {
    playMusic(scene, name)
    onReady?.()
  } else {
    const onAdd = (cache: unknown, key: string) => {
      if (key === musicKey) {
        scene.cache.audio.events.off("add", onAdd)
        playMusic(scene, name)
        onReady?.()
      }
    }
    scene.cache.audio.events.on("add", onAdd)
    preloadMusic(scene, name)
    scene.load.start()
  }
}
