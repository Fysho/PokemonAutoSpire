import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { RegionDetails } from "../../../../../config"
import { PlayerChoice } from "../../../../../models/colyseus-models/player-choice"
import { type Item, ShinyItems } from "../../../../../types/enum/Item"
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
import { DEPTH } from "../../../game/depths"
import { selectConnectedPlayer, useAppSelector } from "../../../hooks"
import { IDetailledPokemon } from "../../../models/bot-v2"
import { pickChoice, rooms } from "../../../network"
import { getGameScene } from "../../game"
import { playSound, SOUNDS } from "../../utils/audio"
import { addIconsToDescription } from "../../utils/descriptions"
import { LocalStoreKeys, localStore } from "../../utils/store"
import GamePokemonDuoPortrait from "./game-pokemon-duo-portrait"
import GamePokemonPortrait from "./game-pokemon-portrait"
import "./game-choice.css"

function isPokemonChoice(choice: PlayerChoice): boolean {
  return choice.pokemons.length > 0
}

export default function GameChoice() {
  const { t } = useTranslation()
  const connectedPlayer = useAppSelector(selectConnectedPlayer)
  const specialGameRule = useAppSelector((state) => state.game.specialGameRule)

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

  if (choices.length === 0 || life <= 0) {
    return null
  }

  const choice = choices[0]
  const isWildReward = choice.type === "wildReward"
  const isGymReward = choice.type === "gymReward"
  const isEliteReward = choice.type === "eliteReward"
  const isUnlockReward = choice.type === "unlockReward"
  const isSpecialReward = isGymReward || isEliteReward || isUnlockReward

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
    <div className="game-choice" style={{ zIndex: DEPTH.MODAL }}>
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
                    className="my-box active clickable"
                    onClick={(event) => {
                      event.stopPropagation()
                      playSound(SOUNDS.BUTTON_CLICK)
                      pickChoice(choice.id, index)
                    }}
                  >
                    <GamePokemonPortrait
                      origin="proposition"
                      index={index}
                      pokemon={proposition as Pkm}
                      inPlanner={false}
                    />
                  </div>
                )
              } else {
                return (
                  <div
                    key={`${choice.id}-${index}`}
                    className="my-box active clickable"
                    style={{ display: "flex", flexFlow: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}
                    onClick={(event) => {
                      event.stopPropagation()
                      playSound(SOUNDS.BUTTON_CLICK)
                      pickChoice(choice.id, index)
                    }}
                  >
                    <img
                      style={{ width: "4rem", height: "4rem" }}
                      src={"assets/item/" + item + ".png"}
                    />
                    <h3 style={{ margin: "0.25em 0" }}>{t(`item.${item}`)}</h3>
                    <p style={{ marginBottom: "0.5em", fontSize: "80%" }}>
                      {addIconsToDescription(t(`item_description.${item}`))}
                    </p>
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
                  className="my-box active clickable"
                  onClick={(event) => {
                    event.stopPropagation()
                    playSound(SOUNDS.BUTTON_CLICK)
                    pickChoice(choice.id, index)
                  }}
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
                      <p>
                        {addIconsToDescription(t(`item_description.${item}`))}
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
                className="my-box active clickable"
                key={`${choice.id}-${index}`}
                onClick={(event) => {
                  event.stopPropagation()
                  playSound(SOUNDS.BUTTON_CLICK)
                  pickChoice(choice.id, index)
                }}
              >
                <img
                  style={{ width: "4rem", height: "4rem" }}
                  src={"assets/item/" + item + ".png"}
                />
                <h3 style={{ margin: "0.25em 0" }}>{t(`item.${item}`)}</h3>
                <p style={{ marginBottom: "0.5em" }}>
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
        <button
          className="bubbly orange active"
          onClick={() => {
            setVisible(!visible)
          }}
        >
          {visible ? t("hide") : t("show")}
        </button>
        {isWildReward && (
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
        {choice.type === "starter" && (
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
        {choice.type === "item" && (
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
    </div>
  )
}
