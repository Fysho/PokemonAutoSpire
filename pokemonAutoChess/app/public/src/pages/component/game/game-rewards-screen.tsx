import { t } from "i18next"
import { useEffect, useState } from "react"
import { PlayerChoice } from "../../../../../models/colyseus-models/player-choice"
import { Transfer } from "../../../../../types"
import { DEPTH } from "../../../game/depths"
import { selectConnectedPlayer, useAppSelector } from "../../../hooks"
import { pickChoice, rooms } from "../../../network"
import { playSound, SOUNDS } from "../../utils/audio"
import GameChoice from "./game-choice"
import "./game-choice.css"

const INSTANT_REWARD_TYPES = ["gold", "heal", "xp", "itemGrant"]
function isPickerChoice(choice: PlayerChoice): boolean {
  return !INSTANT_REWARD_TYPES.includes(choice.type)
}

function rewardLabel(choice: PlayerChoice): string {
  switch (choice.type) {
    case "gold":
      return `${choice.value} Gold`
    case "heal":
      return `Heal ${choice.value} HP`
    case "xp":
      return `Gain ${choice.value} XP`
    case "wildReward":
    case "wildRewardRerolled":
      return "Wild Encounter Reward"
    case "eliteReward":
      return "Elite Encounter Reward"
    case "gymReward":
      return "Gym Encounter Reward"
    case "unlockReward":
      return "Unlock Reward"
    case "item":
      return "Treasure"
    case "addPick":
      return "Pokémon Offer"
    case "itemGrant":
      return t(`item.${choice.items[0]}` as any) as string
    default:
      return "Reward"
  }
}

function rewardIcon(choice: PlayerChoice): string {
  switch (choice.type) {
    case "gold":
      return "/assets/icons/money.svg"
    case "heal":
      return "/assets/icons/HP.png"
    case "xp":
      return "/assets/item/EXP_SHARE.png"
    case "itemGrant":
      return `/assets/item/${choice.items[0]}.png`
    default:
      return "/assets/ui/pokeball.png"
  }
}

export default function GameRewardsScreen() {
  const connectedPlayer = useAppSelector(selectConnectedPlayer)
  const life = connectedPlayer?.life ?? 0
  const choices = connectedPlayer?.choices ?? []

  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmingSkip, setConfirmingSkip] = useState(false)

  const hasPicker = choices.some(isPickerChoice)

  // If the open sub-picker's choice was claimed (no picker choice remains),
  // fall back to the rewards list automatically.
  useEffect(() => {
    if (pickerOpen && !hasPicker) setPickerOpen(false)
  }, [pickerOpen, hasPicker])

  if (choices.length === 0 || life <= 0) {
    return null
  }

  if (pickerOpen && hasPicker) {
    return <GameChoice rewardSubPicker onClose={() => setPickerOpen(false)} />
  }

  const handleRow = (choice: PlayerChoice) => {
    playSound(SOUNDS.BUTTON_CLICK)
    if (isPickerChoice(choice)) {
      setPickerOpen(true)
    } else {
      // Instant rows (gold/heal/xp) — claimed directly; index is ignored server-side.
      pickChoice(choice.id, 0)
    }
  }

  const handleSkip = () => {
    playSound(SOUNDS.BUTTON_CLICK)
    rooms.game?.send(Transfer.SKIP_ALL_REWARDS)
  }

  return (
    <div className="game-choice" style={{ zIndex: DEPTH.MODAL }}>
      <div className="my-container game-rewards-screen">
        <h2 style={{ textAlign: "center" }}>Rewards!</h2>

        <div className="game-rewards-list">
          {choices.map((choice) => (
            <button
              key={choice.id}
              className="my-box active clickable game-reward-row"
              onClick={(event) => {
                event.stopPropagation()
                handleRow(choice)
              }}
            >
              <img className="game-reward-icon" src={rewardIcon(choice)} alt="" />
              <span className="game-reward-label">{rewardLabel(choice)}</span>
              {isPickerChoice(choice) && (
                <span className="game-reward-arrow">→</span>
              )}
            </button>
          ))}
        </div>

        <div className="game-rewards-skip">
          {confirmingSkip ? (
            <>
              <span style={{ alignSelf: "center", marginRight: "0.5em" }}>
                Forfeit unclaimed rewards?
              </span>
              <button className="bubbly red active" onClick={handleSkip}>
                Yes, Skip
              </button>
              <button
                className="bubbly orange active"
                style={{ marginLeft: "0.5em" }}
                onClick={() => setConfirmingSkip(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="bubbly blue active"
              onClick={() => {
                playSound(SOUNDS.BUTTON_CLICK)
                setConfirmingSkip(true)
              }}
            >
              Skip ▶
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
