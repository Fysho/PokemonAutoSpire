import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { getPortraitSrc } from "../../../../../utils/avatar"
import { addIconsToDescription } from "../../utils/descriptions"
import "./tutorial-dialog.css"

// The tutorial guide's portrait (Kangaskhan — a fitting "mentor" mon).
const GUIDE_PORTRAIT = "0115"

type TutorialDialogDetail = { trigger: string; steps: string[] }
type Step = { key: string; trigger: string }

// Blocking dialog overlay for the scripted tutorial. The server broadcasts
// ordered i18n step keys (Transfer.TUTORIAL_DIALOG) which game.tsx relays as a
// "tutorial-dialog" window event; this component queues them and shows one at a
// time with a Next button. The final "complete" prompt ends with a Back to Menu
// button (onExit) that leaves the run.
export default function TutorialDialog({ onExit }: { onExit?: () => void }) {
  const { t } = useTranslation()
  const [queue, setQueue] = useState<Step[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TutorialDialogDetail>).detail
      if (detail?.steps?.length) {
        const steps = detail.steps.map((key) => ({ key, trigger: detail.trigger }))
        setQueue((prev) => [...prev, ...steps])
      }
    }
    window.addEventListener("tutorial-dialog", handler)
    return () => window.removeEventListener("tutorial-dialog", handler)
  }, [])

  const current = queue[0]
  const isLast = queue.length === 1
  const isExit = isLast && current?.trigger === "complete"

  const next = useCallback(() => {
    if (isExit && onExit) {
      onExit()
      return
    }
    setQueue((prev) => prev.slice(1))
  }, [isExit, onExit])

  if (!current) return null

  const text = t(current.key as any) as string

  return (
    <div className="tutorial-dialog-overlay">
      <div className="tutorial-dialog my-container">
        <img
          className="tutorial-dialog-portrait"
          src={getPortraitSrc(GUIDE_PORTRAIT)}
          alt=""
        />
        <div className="tutorial-dialog-body">
          <div className="tutorial-dialog-text">{addIconsToDescription(text)}</div>
          <button className="bubbly blue tutorial-dialog-next" onClick={next}>
            {isExit
              ? t("tutorial.back_to_menu")
              : isLast
                ? t("tutorial.got_it")
                : t("tutorial.next")}
          </button>
        </div>
      </div>
    </div>
  )
}
