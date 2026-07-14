import { MouseEvent, useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"
import { RegionDetails } from "../../../../../config"
import { PlayerChoice } from "../../../../../models/colyseus-models/player-choice"
import { Item, ShinyItems } from "../../../../../types/enum/Item"
import { DungeonPMDO } from "../../../../../types/enum/Dungeon"
import {
  Pkm,
  PkmDuo,
  PkmDuos,
  PkmFamily
} from "../../../../../types/enum/Pokemon"
import { Synergy } from "../../../../../types/enum/Synergy"
import { SpecialGameRule } from "../../../../../types/enum/SpecialGameRule"
import { Transfer } from "../../../../../types"
import { isIn } from "../../../../../utils/array"
import { RELICS } from "../../../../../core/relics"
import { DEPTH } from "../../../game/depths"
import { selectConnectedPlayer, useAppSelector } from "../../../hooks"
import { IDetailledPokemon } from "../../../models/bot-v2"
import { pickChoice, rooms } from "../../../network"
import { getGameScene } from "../../game"
import { playSound, SOUNDS } from "../../utils/audio"
import { addIconsToDescription } from "../../utils/descriptions"
import { LocalStoreKeys, localStore } from "../../utils/store"
import { GamePokemonDetail } from "./game-pokemon-detail"
import GamePokemonDuoPortrait from "./game-pokemon-duo-portrait"
import GamePokemonPortrait from "./game-pokemon-portrait"
import "./game-choice.css"

function isPokemonChoice(choice: PlayerChoice): boolean {
  return choice.pokemons.length > 0
}

// Instant reward rows (claimed directly from the rewards screen, no sub-picker)
const INSTANT_REWARD_TYPES = ["gold", "heal", "xp", "itemGrant"]
function isPickerChoice(choice: PlayerChoice): boolean {
  return !INSTANT_REWARD_TYPES.includes(choice.type)
}

interface GameChoiceProps {
  // When true, this renders as the sub-picker for the STS-style rewards screen:
  // it targets the single non-instant reward choice and shows a Back button.
  rewardSubPicker?: boolean
  onClose?: () => void
}

export default function GameChoice({ rewardSubPicker, onClose }: GameChoiceProps = {}) {
  const { t } = useTranslation()
  const connectedPlayer = useAppSelector(selectConnectedPlayer)
  const specialGameRule = useAppSelector((state) => state.game.specialGameRule)
  // Spire mode: rerolling is removed for now (will return as a consumable item).
  const isSpire = useAppSelector((state) => state.game.isSpire)

  const life = connectedPlayer?.life ?? 0
  const choices = connectedPlayer?.choices ?? []

  const board = getGameScene()?.board
  const hasPokemonChoice = choices.some(isPokemonChoice)
  const containsDuo = choices.some((choice) =>
    choice.pokemons.some((pokemon) => pokemon in PkmDuo)
  )
  const isBenchFull =
    board && hasPokemonChoice && board.getBenchSize() >= (containsDuo ? 7 : 8)

  const [teamPlanner, setTeamPlanner] = useState<IDetailledPokemon[]>(
    localStore.get(LocalStoreKeys.TEAM_PLANNER)
  )

  useEffect(() => {
    const updateTeamPlanner = (event: StorageEvent) => {
      if (event.key === LocalStoreKeys.TEAM_PLANNER) {
        setTeamPlanner(localStore.get(LocalStoreKeys.TEAM_PLANNER))
      }
    }

    window.addEventListener("storage", updateTeamPlanner)

    return () => {
      window.removeEventListener("storage", updateTeamPlanner)
    }
  }, [])

  const [visible, setVisible] = useState(true)

  // Touch devices: tap picks immediately; press-and-hold (~400ms) opens the
  // pokemon's details instead (hover doesn't exist on touch). Wild-reward
  // details stay visible only while the finger remains down. The click
  // synthesized for the long-press release is swallowed so it cannot pick.
  const [isTouchDevice] = useState(
    () => window.matchMedia("(pointer: coarse)").matches
  )
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)

  // In rewards-screen sub-picker mode, target the single non-instant reward
  // (wild/elite/gym/unlock/item/addPick). Reroll swaps it for a new choice with
  // a fresh id, but it's still the only picker choice, so this keeps tracking it.
  const choice = rewardSubPicker ? choices.find(isPickerChoice) : choices[0]

  // A reroll/regenerate replaces the choice id — drop any open details.
  useEffect(() => {
    setDetailIndex(null)
  }, [choice?.id])

  if (choices.length === 0 || life <= 0) {
    return null
  }

  if (!choice) {
    return null
  }

  const startLongPress = (index: number) => {
    if (!isTouchDevice) return
    longPressFired.current = false
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
    }
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null
      longPressFired.current = true
      setDetailIndex(index)
    }, 400)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const endLongPress = () => {
    cancelLongPress()
    if (choice.type === "wildReward") {
      setDetailIndex(null)
    }
  }

  const onChoiceClick = (event: MouseEvent, index: number) => {
    event.stopPropagation()
    // Ignore only the click synthesized by releasing a completed long-press.
    if (longPressFired.current) {
      longPressFired.current = false
      return
    }
    // Non-wild details keep their existing tap-to-dismiss behavior. Wild
    // details close on release, so the next deliberate tap must select.
    if (detailIndex !== null) {
      setDetailIndex(null)
      if (choice.type !== "wildReward") return
    }
    playSound(SOUNDS.BUTTON_CLICK)
    pickChoice(choice.id, index)
  }

  const longPressHandlers = (index: number) => ({
    onTouchStart: () => startLongPress(index),
    onTouchMove: cancelLongPress,
    onTouchEnd: endLongPress,
    onTouchCancel: endLongPress
  })

  const choiceBoxClass = () => "my-box active clickable"
  const isWildReward = choice.type === "wildReward"
  const isGymReward = choice.type === "gymReward"
  const isEliteReward = choice.type === "eliteReward"
  const isUnlockReward = choice.type === "unlockReward"
  const isSpecialReward = isGymReward || isEliteReward || isUnlockReward
  const detailProposition =
    detailIndex !== null ? choice.pokemons[detailIndex] : null
  const detailPokemon =
    isTouchDevice &&
    isWildReward &&
    detailProposition !== null &&
    detailProposition !== Pkm.DEFAULT &&
    !(detailProposition in PkmDuos)
      ? (detailProposition as Pkm)
      : null

  let message: string | null = null
  let regionSynergies: Synergy[] = []
  let regionName = ""
  if (isWildReward) {
    const playerMap = connectedPlayer?.map as string | undefined
    if (playerMap && playerMap !== "town") {
      regionName = playerMap.replace(/([A-Z])/g, " $1").trim()
      regionSynergies = RegionDetails[playerMap as DungeonPMDO]?.synergies ?? []
    }
    message = regionName ? `Choose a reward from: ${regionName}` : "Choose a reward"
  } else if (isGymReward) {
    message = "Choose a gym reward"
  } else if (isEliteReward) {
    message = "Choose an elite reward"
  } else if (isUnlockReward) {
    message = "Claim your unlock reward"
  } else if (choice.type === "addPick") {
    message = "Choose a Pokemon"
  } else if (choice.type === "starter") {
    message =
      specialGameRule === SpecialGameRule.FIRST_PARTNER
        ? t("player_choices.choose_first_partner")
        : t("player_choices.choose_starter")
  } else if (choice.type === "mission_order") {
    message = t("player_choices.choose_mission_order")
  } else if (choice.type === "unique") {
    message = t("player_choices.choose_unique")
  } else if (choice.type === "legendary") {
    message = t("player_choices.choose_legendary")
  } else if (choice.type === "item") {
    message = t("player_choices.choose_item")
  } else if (choice.type === "wand") {
    message = t("player_choices.choose_wand")
  }

  return (
    <div
      className="game-choice"
      style={{ zIndex: DEPTH.MODAL }}
      onClick={() => setDetailIndex(null)}
    >
      <div
        className="my-container"
        style={{ visibility: visible ? "visible" : "hidden" }}
      >
        {message && (
          <h2 style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
            {message}
            {isWildReward && regionSynergies.map((syn) => (
              <img
                key={syn}
                src={`/assets/types/${syn}.svg`}
                style={{ width: "48px", height: "48px" }}
              />
            ))}
          </h2>
        )}

        {(isWildReward || isSpecialReward) ? (
          <div className="game-choice-pokemons-list">
            {choice.pokemons.map((proposition, index) => {
              const isPokemonSlot = proposition !== Pkm.DEFAULT
              const item = choice.items[index]

              if (isPokemonSlot) {
                return (
                  <div
                    key={`${choice.id}-${index}`}
                    className={choiceBoxClass()}
                    onClick={(event) => onChoiceClick(event, index)}
                    {...longPressHandlers(index)}
                  >
                    <GamePokemonPortrait
                      origin="proposition"
                      index={index}
                      pokemon={proposition as Pkm}
                      inPlanner={false}
                      detailOpen={isTouchDevice ? (!isWildReward && detailIndex === index) : undefined}
                    />
                    {(isUnlockReward || (isEliteReward && isSpire)) && item && (
                      <img
                        style={{ width: "2rem", height: "2rem", marginTop: "0.25em" }}
                        src={"assets/item/" + item + ".png"}
                        title={t(`item.${item}`)}
                      />
                    )}
                  </div>
                )
              } else {
                const relic = choice.relics?.[index]
                return (
                  <div
                    key={`${choice.id}-${index}`}
                    className={choiceBoxClass()}
                    style={{ display: "flex", flexFlow: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}
                    onClick={(event) => onChoiceClick(event, index)}
                  >
                    {relic ? (
                      <>
                        <img
                          style={{ width: "4rem", height: "4rem", objectFit: "contain" }}
                          src={`/assets/relics/${relic}.png`}
                          onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden" }}
                        />
                        <h3 style={{ margin: "0.25em 0" }}>
                          {RELICS[relic as keyof typeof RELICS]?.name ?? relic}
                        </h3>
                        <p className="relic-effect-desc" style={{ marginBottom: "0.5em", fontSize: "80%" }}>
                          {addIconsToDescription(RELICS[relic as keyof typeof RELICS]?.description ?? "")}
                        </p>
                      </>
                    ) : (
                      <>
                        <img
                          style={{ width: "4rem", height: "4rem" }}
                          src={"assets/item/" + item + ".png"}
                        />
                        <h3 style={{ margin: "0.25em 0" }}>{t(`item.${item}`)}</h3>
                        <p className="item-description-text" style={{ marginBottom: "0.5em", fontSize: "80%" }}>
                          {addIconsToDescription(t(`item_description.${item}`))}
                        </p>
                      </>
                    )}
                  </div>
                )
              }
            })}
          </div>
        ) : choice.pokemons.length > 0 ? (
          <div className="game-choice-pokemons-list">
            {choice.pokemons.map((proposition, index) => {
              const item = choice.items[index]
              return (
                <div
                  key={`${choice.id}-${index}`}
                  className={choiceBoxClass()}
                  onClick={(event) => onChoiceClick(event, index)}
                  {...longPressHandlers(index)}
                >
                  {proposition in PkmDuos ? (
                    <GamePokemonDuoPortrait
                      key={`proposition-${choice.id}-${index}`}
                      origin="proposition"
                      index={index}
                      duo={proposition as PkmDuo}
                      inPlanner={
                        teamPlanner?.some(
                          (pokemon) =>
                            pokemon.name === proposition[0] ||
                            pokemon.name === proposition[1]
                        ) ?? false
                      }
                    />
                  ) : (
                    <GamePokemonPortrait
                      key={`proposition-${choice.id}-${index}`}
                      origin="proposition"
                      index={index}
                      pokemon={proposition as Pkm}
                      detailOpen={isTouchDevice ? detailIndex === index : undefined}
                      inPlanner={
                        teamPlanner?.some((pokemon) => {
                          if (proposition in PkmDuos) {
                            return PkmDuos[proposition].includes(pokemon.name)
                          }

                          return PkmFamily[pokemon.name] === proposition
                        }) ?? false
                      }
                    />
                  )}

                  {item && isIn(ShinyItems, item) === false && proposition !== Pkm.DITTO && (
                    <div className="choice-additional-item">
                      <span
                        style={{
                          fontSize: "2rem",
                          verticalAlign: "middle"
                        }}
                      >
                        +
                      </span>
                      <img
                        style={{
                          width: "2rem",
                          height: "2rem",
                          verticalAlign: "middle"
                        }}
                        src={"assets/item/" + item + ".png"}
                      />
                      <p className="item-description-text">
                        {addIconsToDescription(t(`item_description.${item}`))}
                      </p>
                    </div>
                  )}

                  {choice.relics?.[index] && (
                    <div className="choice-additional-item">
                      <img
                        style={{ width: "4rem", height: "4rem", objectFit: "contain" }}
                        src={`/assets/relics/${choice.relics[index]}.png`}
                        onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden" }}
                      />
                      <h3 style={{ margin: "0.25em 0" }}>
                        {RELICS[choice.relics[index] as keyof typeof RELICS]?.name ?? choice.relics[index]}
                      </h3>
                      <p className="relic-effect-desc" style={{ marginBottom: "0.5em" }}>
                        {addIconsToDescription(RELICS[choice.relics[index] as keyof typeof RELICS]?.description ?? "")}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="game-choice-items-list">
            {choice.items.map((item: Item, index) => (
              <div
                className={choiceBoxClass()}
                key={`${choice.id}-${index}`}
                onClick={(event) => onChoiceClick(event, index)}
              >
                <img
                  style={{ width: "4rem", height: "4rem" }}
                  src={"assets/item/" + item + ".png"}
                />
                <h3 style={{ margin: "0.25em 0" }}>{t(`item.${item}`)}</h3>
                <p className="item-description-text" style={{ marginBottom: "0.5em" }}>
                  {addIconsToDescription(t(`item_description.${item}`))}
                </p>
              </div>
            ))}
          </div>
        )}

        {isBenchFull && choice.pokemons.length > 0 && (
          <p>{t("player_choices.free_slot_hint")}</p>
        )}
      </div>

      <div className="show-hide-action">
        {rewardSubPicker && onClose && (
          <button
            className="bubbly green active"
            style={{ marginRight: "0.5em" }}
            onClick={() => {
              playSound(SOUNDS.BUTTON_CLICK)
              onClose()
            }}
          >
            ← Back
          </button>
        )}
        <button
          className="bubbly orange active"
          onClick={() => {
            setVisible(!visible)
          }}
        >
          {visible ? t("hide") : t("show")}
        </button>
        {isWildReward && !isSpire && (
          <button
            className={`bubbly blue active`}
            style={{ marginLeft: "0.5em" }}
            onClick={() => {
              playSound(SOUNDS.BUTTON_CLICK)
              rooms.game?.send(Transfer.REROLL_REWARD)
            }}
          >
            Reroll (1g)
          </button>
        )}
        {/* Spire reward-reroll tickets — one button per ticket the player holds. */}
        {isWildReward && isSpire &&
          ([
            [Item.REROLL_TICKET, "Reroll"],
            [Item.CLASS_REROLL_TICKET, "Class Reroll"],
            [Item.UPGRADE_TICKET, "Upgrade"],
            [Item.ITEM_REROLL_TICKET, "Item Reroll"]
          ] as [Item, string][])
            .filter(([ticket]) => connectedPlayer?.items?.includes(ticket))
            .map(([ticket, label]) => (
              <button
                key={ticket}
                className="bubbly blue active"
                style={{ marginLeft: "0.5em", display: "inline-flex", alignItems: "center", gap: "0.35em" }}
                onClick={() => {
                  playSound(SOUNDS.BUTTON_CLICK)
                  rooms.game?.send(Transfer.USE_REWARD_TICKET, { ticket })
                }}
              >
                <img src={`assets/item/${ticket}.png`} style={{ width: "1.4em", height: "1.4em" }} />
                {label}
              </button>
            ))}
        {choice.type === "starter" && !isSpire && (
          <button
            className={`bubbly blue active`}
            style={{ marginLeft: "0.5em" }}
            onClick={() => {
              playSound(SOUNDS.BUTTON_CLICK)
              rooms.game?.send(Transfer.REROLL_STARTER)
            }}
          >
            Reroll
          </button>
        )}
        {isEliteReward && choice.items.length > 0 && !isSpire && (
          <button
            className={`bubbly blue active`}
            style={{ marginLeft: "0.5em" }}
            onClick={() => {
              playSound(SOUNDS.BUTTON_CLICK)
              rooms.game?.send(Transfer.REROLL_ELITE_REWARD)
            }}
          >
            Reroll (1g)
          </button>
        )}
        {isSpecialReward && (
          <button
            className={`bubbly blue active`}
            style={{ marginLeft: "0.5em" }}
            onClick={() => {
              playSound(SOUNDS.BUTTON_CLICK)
              rooms.game?.send(Transfer.PASS_REWARD)
            }}
          >
            Pass (+5g)
          </button>
        )}
        {choice.type === "item" && !isSpire && (
          <button
            className={`bubbly blue active`}
            style={{ marginLeft: "0.5em" }}
            onClick={() => {
              playSound(SOUNDS.BUTTON_CLICK)
              rooms.game?.send(Transfer.REROLL_BOSS_REWARD)
            }}
          >
            Reroll (20g)
          </button>
        )}
      </div>
      {detailPokemon &&
        ReactDOM.createPortal(
          <aside
            aria-label="Reward details"
            className="game-choice-mobile-detail my-container"
            style={{ zIndex: DEPTH.TOOLTIP }}
            onClick={(event) => {
              event.stopPropagation()
              setDetailIndex(null)
            }}
          >
            <GamePokemonDetail
              key={`${choice.id}-${detailIndex}`}
              pokemon={detailPokemon}
              origin="proposition"
            />
          </aside>,
          document.body
        )}
    </div>
  )
}
