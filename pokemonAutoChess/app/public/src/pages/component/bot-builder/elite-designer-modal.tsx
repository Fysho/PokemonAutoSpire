import { t } from "i18next"
import { type Dispatch, type SetStateAction, useEffect, useState } from "react"
import { useAppSelector } from "../../../hooks"
import { LocalStoreKeys, localStore } from "../../utils/store"
import { Modal } from "../modal/modal"
import EliteDesigner, {
  DEFAULT_ELITE_DESIGN,
  type EliteDesign,
  EnterTestModeTab
} from "./elite-designer"
import EliteLibrary from "./elite-library"

export default function EliteDesignerModal(props: {
  show: boolean
  handleClose: Dispatch<SetStateAction<void>>
}) {
  const uid = useAppSelector((state) => state.network.uid)
  // Guests all share the "local-player" uid, so the Elite Designer (shared
  // library, test sandbox, measurements) is sign-in only. The server rejects
  // guest library writes and test rooms too — this is just the friendly gate.
  const isGuest = !uid || uid === "local-player"
  const [design, setDesign] = useState<EliteDesign>(() => {
    const stored = localStore.get(LocalStoreKeys.ELITE_DESIGNER)
    // Merge with defaults so designs saved before newer fields existed
    // (e.g. winRewards/lossRewards) don't crash on load.
    return stored
      ? { ...DEFAULT_ELITE_DESIGN, ...stored }
      : DEFAULT_ELITE_DESIGN
  })
  const [view, setView] = useState<"designer" | "library">("designer")
  useEffect(() => {
    localStore.set(LocalStoreKeys.ELITE_DESIGNER, design)
  }, [design])

  if (isGuest) {
    return (
      <Modal
        show={props.show}
        onClose={props.handleClose}
        header={t("elite_designer")}
        className="team-builder-modal"
      >
        <div className="elite-guest-gate">
          <p>
            The Elite & Boss Designer needs an account so your designs have an
            owner in the shared library.
          </p>
          <p>
            Sign in or create a free account to design elite and act-boss teams,
            save them to the library, and measure them against recorded player
            teams at every difficulty.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      show={props.show}
      onClose={props.handleClose}
      header={t("elite_designer")}
      className="team-builder-modal"
    >
      <div className="elite-view-tabs">
        <button
          className={`bubbly ${view === "designer" ? "blue" : "dark"}`}
          onClick={() => setView("designer")}
        >
          Designer
        </button>
        <button
          className={`bubbly ${view === "library" ? "blue" : "dark"}`}
          onClick={() => setView("library")}
        >
          Library
        </button>
        <EnterTestModeTab onRequestClose={() => props.handleClose()} />
      </div>
      {view === "designer" ? (
        <EliteDesigner
          design={design}
          updateDesign={setDesign}
          onRequestClose={() => props.handleClose()}
        />
      ) : (
        <EliteLibrary
          onLoad={(loaded) => {
            setDesign(loaded)
            setView("designer")
          }}
        />
      )}
    </Modal>
  )
}
