import { t } from "i18next"
import { type Dispatch, type SetStateAction, useEffect, useState } from "react"
import { LocalStoreKeys, localStore } from "../../utils/store"
import { Modal } from "../modal/modal"
import EliteDesigner, {
  DEFAULT_ELITE_DESIGN,
  type EliteDesign
} from "./elite-designer"

export default function EliteDesignerModal(props: {
  show: boolean
  handleClose: Dispatch<SetStateAction<void>>
}) {
  const [design, setDesign] = useState<EliteDesign>(() => {
    const stored = localStore.get(LocalStoreKeys.ELITE_DESIGNER)
    // Merge with defaults so designs saved before newer fields existed
    // (e.g. winRewards/lossRewards) don't crash on load.
    return stored ? { ...DEFAULT_ELITE_DESIGN, ...stored } : DEFAULT_ELITE_DESIGN
  })
  useEffect(() => {
    localStore.set(LocalStoreKeys.ELITE_DESIGNER, design)
  }, [design])

  return (
    <Modal
      show={props.show}
      onClose={props.handleClose}
      header={t("elite_designer")}
      className="team-builder-modal"
    >
      <EliteDesigner design={design} updateDesign={setDesign} />
    </Modal>
  )
}
