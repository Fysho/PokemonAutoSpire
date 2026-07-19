import Phaser from "phaser"
import { type Dispatch, type SetStateAction, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Tab, TabList, TabPanel, Tabs } from "react-tabs"
import { isThemeUnlocked, THEMES } from "../../../../../config"
import { GADGETS } from "../../../../../config/game/gadgets"
import { Language } from "../../../../../types/enum/Language"
import { LanguageNames } from "../../../../dist/client/locales"
import { useAppDispatch, useAppSelector } from "../../../hooks"
import { usePreferences } from "../../../preferences"
import { selectLanguage } from "../../../stores/NetworkStore"
import { getGameScene } from "../../game"
import { enterFullScreen, exitFullScreen } from "../../utils/fullscreen"
import { Checkbox } from "../checkbox/checkbox"
import type { Page } from "../main-sidebar/main-sidebar"
import { Modal } from "../modal/modal"
import GameFiles from "./game-files"
import KeybindInfo from "./keybind-info"
import "./game-options-modal.css"

export default function GameOptionsModal(props: {
  show: boolean
  hideModal: Dispatch<SetStateAction<void>>
  page: Page
}) {
  const [preferences, setPreferences] = usePreferences()
  const { t, i18n } = useTranslation()
  const dispatch = useAppDispatch()
  const language = useAppSelector(
    (state) => state.network.profile?.language ?? i18n.language
  )
  const profile = useAppSelector((state) => state.network.profile)
  const profileLevel = profile?.level ?? 0
  const [isMobile] = useState(
    () => window.matchMedia("(pointer: coarse)").matches
  )
  const [isFullscreen, setIsFullscreen] = useState(
    () => document.fullscreenElement !== null
  )

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement !== null)
    }

    document.addEventListener("fullscreenchange", syncFullscreenState)
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState)
    }
  }, [])

  const renderers = {
    [Phaser.AUTO]: "Auto",
    [Phaser.WEBGL]: "WebGL",
    [Phaser.CANVAS]: "Canvas"
  }

  return (
    <Modal
      show={props.show}
      onClose={props.hideModal}
      header={t("options.title")}
      className="game-options-modal anchor-top"
    >
      <Tabs>
        <TabList>
          {isMobile && <Tab key="mobile">{t("options.mobile")}</Tab>}
          <Tab key="sound">{t("options.sound")}</Tab>
          <Tab key="interface">{t("options.interface")}</Tab>
          <Tab key="hotkeys">{t("options.hotkeys")}</Tab>
          <Tab key="files">{t("options.game_files")}</Tab>
        </TabList>

        {isMobile && (
          <TabPanel>
            <label className="mobile-ui-scale">
              {t("options.ui_scale")}: {preferences.uiScale} %
              <input
                type="range"
                min="75"
                max="125"
                step="5"
                value={preferences.uiScale}
                onInput={(event) =>
                  setPreferences({
                    uiScale: Number.parseInt(
                      (event.target as HTMLInputElement).value
                    )
                  })
                }
              />
            </label>
            <p>
              <Checkbox
                isDark
                checked={isFullscreen}
                disabled={!document.fullscreenEnabled}
                onToggle={(checked) => {
                  void (checked ? enterFullScreen() : exitFullScreen())
                }}
                label={t("options.fullscreen")}
              />
            </p>
            {!document.fullscreenEnabled && (
              <p className="info">{t("options.fullscreen_not_supported")}</p>
            )}
          </TabPanel>
        )}

        <TabPanel>
          <label style={{ width: "100%" }}>
            {t("jukebox.music_volume")}: {preferences.musicVolume} %
            <input
              type="range"
              min="0"
              max="100"
              value={preferences.musicVolume}
              onInput={(e) =>
                setPreferences({
                  musicVolume: Number.parseFloat(
                    (e.target as HTMLInputElement).value
                  )
                })
              }
            ></input>
          </label>
          <label style={{ width: "100%" }}>
            {t("options.sfx_volume")}: {preferences.sfxVolume} %
            <input
              type="range"
              min="0"
              max="100"
              value={preferences.sfxVolume}
              onInput={(e) =>
                setPreferences({
                  sfxVolume: Number.parseFloat(
                    (e.target as HTMLInputElement).value
                  )
                })
              }
            ></input>
          </label>
          <p>
            <Checkbox
              isDark
              checked={preferences.playInBackground}
              onToggle={(checked) =>
                setPreferences({ playInBackground: checked })
              }
              label={t("options.play_music_in_background")}
            />
          </p>
        </TabPanel>

        <TabPanel>
          {props.page === "main_lobby" && (
            <>
              <label>
                {t("options.language")}:&nbsp;
                <select
                  className="is-light"
                  value={language}
                  onChange={(e) => {
                    dispatch(selectLanguage(e.target.value as Language))
                    i18n.changeLanguage(e.target.value as Language)
                  }}
                >
                  {Object.keys(Language).map((lng) => (
                    <option key={lng} value={lng}>
                      {LanguageNames[lng]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="info">
                {t("options.community_translations")}{" "}
                <a
                  href="https://discord.com/channels/737230355039387749/1488242758232834282"
                  target="_blank"
                >
                  Discord
                </a>
              </p>
            </>
          )}

          {profile && profileLevel >= GADGETS.palette.levelRequired && (
            <p>
              <label>
                {t("options.theme")}:&nbsp;
                <select
                  className="is-light"
                  value={preferences.theme}
                  onChange={(e) => setPreferences({ theme: e.target.value })}
                >
                  {THEMES.filter((theme) =>
                    isThemeUnlocked(theme, profile)
                  ).map((theme) => (
                    <option key={theme} value={theme}>
                      {t(`theme.${theme}`)}
                    </option>
                  ))}
                </select>
              </label>
            </p>
          )}

          <p>
            <Checkbox
              isDark
              checked={preferences.showDetailsOnHover}
              onToggle={(checked) =>
                setPreferences({ showDetailsOnHover: checked })
              }
              label={t("options.show_details_on_hover")}
            />
          </p>
          <p>
            <Checkbox
              isDark
              checked={preferences.showDamageNumbers}
              onToggle={(checked) =>
                setPreferences({ showDamageNumbers: checked })
              }
              label={t("options.show_damage_numbers")}
            />
          </p>
          <p>
            <Checkbox
              isDark
              checked={preferences.disableAnimatedTilemap}
              onToggle={(checked) => {
                setPreferences({ disableAnimatedTilemap: checked })
                const gameScene = getGameScene()
                if (gameScene) {
                  gameScene.toggleTilesetAnimation(checked)
                }
              }}
              label={t("options.disable_animated_tilemap")}
            />
          </p>
          <p>
            <Checkbox
              isDark
              checked={preferences.disableCameraShake}
              onToggle={(checked) => {
                setPreferences({ disableCameraShake: checked })
              }}
              label={t("options.disable_camera_shake")}
            />
          </p>
          <p>
            <Checkbox
              isDark
              checked={preferences.antialiasing}
              onToggle={(checked) => setPreferences({ antialiasing: checked })}
              label={t("options.antialiasing")}
            />
          </p>
          <p>
            <Checkbox
              isDark
              checked={preferences.colorblindMode}
              onToggle={(checked) =>
                setPreferences({ colorblindMode: checked })
              }
              label={t("options.colorblind_mode")}
            />
          </p>
          {props.page === "main_lobby" && (
            <div>
              <label>
                {t("options.renderer")}:&nbsp;
                <select
                  className="is-light"
                  value={preferences.renderer}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value)
                    if (!isNaN(parsed)) {
                      setPreferences({ renderer: parsed })
                    }
                  }}
                >
                  {Object.keys(renderers).map((r) => (
                    <option key={r} value={r}>
                      {renderers[r]}
                    </option>
                  ))}
                </select>
                <p className="info">{t("options.renderer_info")}</p>
              </label>
            </div>
          )}
        </TabPanel>

        <TabPanel>
          <KeybindInfo />
        </TabPanel>

        <TabPanel>
          <GameFiles />
        </TabPanel>
      </Tabs>
    </Modal>
  )
}
