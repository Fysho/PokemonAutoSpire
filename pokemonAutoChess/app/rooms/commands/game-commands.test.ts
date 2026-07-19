import * as assert from "node:assert/strict"
import { test } from "node:test"
import type { PlayerChoice } from "../../models/colyseus-models/player-choice"
import {
  designToSpireEliteData,
  validateEliteDesignContent
} from "../../services/elite-design"
import {
  bracketStagesForDesign,
  buildMeasurementPoolSchedule,
  ELITE_MEASURE_DIFFICULTIES
} from "../../services/elite-test"
import { BattleResult, GamePhaseState } from "../../types/enum/Game"
import { Item } from "../../types/enum/Item"
import { Pkm } from "../../types/enum/Pokemon"
import GameRoom from "../game-room"
import { isEliteLossResult, OnUpdatePhaseCommand } from "./game-commands"

type RewardOption = { pokemon: Pkm; item?: Item }

function createRewardCommand(
  lossRewards: RewardOption[],
  lossRewardsShown: number,
  winRewards: RewardOption[],
  winRewardsShown: number,
  fightPokemon: Pkm[]
) {
  const command = new OnUpdatePhaseCommand()
  command.state = { isSpire: false } as never
  command.room = {
    spireEliteRewardSource: {
      lossRewards,
      lossRewardsShown,
      winRewards,
      winRewardsShown
    },
    eliteFightPokemon: fightPokemon,
    eliteMainPokemon: fightPokemon[0]
  } as never
  const player: { choices: PlayerChoice[] } = { choices: [] }
  return { command, player }
}

test("approved elite pools are used outside Spire", () => {
  const { command, player } = createRewardCommand(
    [{ pokemon: Pkm.ODDISH }],
    1,
    [{ pokemon: Pkm.BELLOSSOM }],
    1,
    [Pkm.BELLOSSOM]
  )

  command.generateEliteLossChoice(player as never)
  assert.deepEqual([...player.choices[0].pokemons], [Pkm.ODDISH])

  player.choices.length = 0
  command.generateEliteRewardChoice(player as never)
  assert.deepEqual([...player.choices[0].pokemons], [Pkm.BELLOSSOM])
})

test("configured loss rewards may contain Pokemon absent from the fight", () => {
  const configured = [Pkm.LITWICK, Pkm.HISUI_GROWLITHE, Pkm.GREAVARD]
  const { command, player } = createRewardCommand(
    configured.map((pokemon) => ({ pokemon })),
    configured.length,
    [],
    1,
    [Pkm.LAMPENT, Pkm.GREAVARD, Pkm.HISUI_GROWLITHE, Pkm.HOUNDSTONE]
  )

  command.generateEliteLossChoice(player as never)
  assert.deepEqual(new Set(player.choices[0].pokemons), new Set(configured))
  assert.equal(player.choices[0].pokemons.includes(Pkm.LAMPENT), false)
})

test("empty approved pools retain the board-based fallback", () => {
  const { command, player } = createRewardCommand([], 1, [], 1, [Pkm.BELLOSSOM])

  command.generateEliteLossChoice(player as never)
  assert.deepEqual([...player.choices[0].pokemons], [Pkm.BELLOSSOM])
})

test("elite rerolls derive reward tier from the battle result", () => {
  assert.equal(isEliteLossResult(BattleResult.WIN), false)
  assert.equal(isEliteLossResult(BattleResult.DEFEAT), true)
  assert.equal(isEliteLossResult(BattleResult.DRAW), true)
  assert.equal(isEliteLossResult(undefined), true)
})

function claimEliteReward(designSource: object | null): Item[] {
  const choice = {
    id: "reward",
    type: "eliteReward",
    pokemons: [Pkm.ODDISH],
    items: [Item.HEART_SCALE],
    relics: []
  }
  const player = {
    board: new Map(),
    choices: [choice],
    items: [] as Item[],
    bonusSynergies: new Map(),
    updateSynergies() {}
  }
  const room = {
    state: {
      players: new Map([["player", player]]),
      phase: GamePhaseState.REWARD,
      updatePhaseNeeded: false,
      time: 1
    },
    spireEliteRewardSource: designSource,
    spawnOnBench() {}
  }

  GameRoom.prototype.pickChoice.call(
    room as never,
    "player",
    choice.id,
    0,
    true
  )
  return player.items
}

test("paired items are granted only for approved-design elite rewards", () => {
  assert.deepEqual(claimEliteReward({ designId: "approved" }), [
    Item.HEART_SCALE
  ])
  assert.deepEqual(claimEliteReward(null), [])
})

test("boss measurements use floors 15 and 20 at all four difficulties", () => {
  assert.deepEqual(bracketStagesForDesign(2, "boss"), [
    "act2-floor15",
    "act2-floor20"
  ])
  assert.deepEqual(
    [...ELITE_MEASURE_DIFFICULTIES],
    ["easy", "normal", "hard", "impossible"]
  )
})

test("elite measurements retain their two milestone bracket edges", () => {
  assert.deepEqual(bracketStagesForDesign(1, "6-10"), [
    "act1-floor5",
    "act1-floor10"
  ])
  assert.deepEqual(bracketStagesForDesign(2, "1-5"), [
    "act1-floor20",
    "act2-floor5"
  ])
})

test("measurement pools deterministically fill all 100 fights", () => {
  const schedule = buildMeasurementPoolSchedule(["first", "second", "third"])
  assert.equal(schedule.length, 100)
  assert.deepEqual(schedule.slice(0, 7), [
    "first",
    "second",
    "third",
    "first",
    "second",
    "third",
    "first"
  ])
  assert.deepEqual(buildMeasurementPoolSchedule([]), [])
})

test("boss exports retain both configurable reward systems", () => {
  const raw = {
    kind: "boss",
    name: "Reward Boss",
    act: 3,
    stages: "boss",
    icon: Pkm.MEW,
    board: [[Pkm.MEW, 4, 2]],
    items: [[Item.SOUL_DEW]],
    useDefaultBossGrantedItems: false,
    bossGrantedItems: [Item.RUSTED_SWORD],
    useDefaultBossItemRewards: false,
    bossItemRewards: [Item.SHELL_BELL, "RANDOM_TOOL"],
    bossItemRewardsShown: 2
  }
  assert.equal(validateEliteDesignContent(raw), null)
  const design = designToSpireEliteData({
    id: "boss-design",
    name: raw.name,
    designJson: JSON.stringify(raw)
  })
  assert.ok(design)
  assert.equal(design.kind, "boss")
  assert.equal(design.useDefaultBossGrantedItems, false)
  assert.deepEqual(design.bossGrantedItems, [Item.RUSTED_SWORD])
  assert.equal(design.useDefaultBossItemRewards, false)
  assert.deepEqual(design.bossItemRewards, [Item.SHELL_BELL, "RANDOM_TOOL"])
  assert.equal(design.bossItemRewardsShown, 2)
})
