import * as assert from "node:assert/strict"
import { test } from "node:test"
import PokemonFactory from "../../models/pokemon-factory"
import type { PlayerChoice } from "../../models/colyseus-models/player-choice"
import {
  designToSpireEliteData,
  validateEliteDesignContent
} from "../../services/elite-design"
import {
  bracketStagesForDesign,
  buildEliteDesignOpponent,
  buildMeasurementPoolSchedule,
  createBuiltInEliteTestEncounter,
  ELITE_MEASURE_DIFFICULTIES,
  parseEliteTestBossAct,
  parseEliteDesignExport,
  parseEliteTestDifficulty
} from "../../services/elite-test"
import {
  BattleResult,
  GameMode,
  GamePhaseState,
  Team
} from "../../types/enum/Game"
import { Item } from "../../types/enum/Item"
import { Pkm } from "../../types/enum/Pokemon"
import GameRoom from "../game-room"
import GameState from "../states/game-state"
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

test("special test stages validate difficulty and use live encounter factories", () => {
  assert.equal(parseEliteTestDifficulty(0), 0)
  assert.equal(parseEliteTestDifficulty(3), 3)
  assert.equal(parseEliteTestDifficulty(-1), null)
  assert.equal(parseEliteTestDifficulty("3"), null)
  assert.equal(parseEliteTestBossAct("boss-act2"), 2)
  assert.equal(parseEliteTestBossAct("boss-act4"), null)

  const boss = createBuiltInEliteTestEncounter("boss-act1", 2)
  assert.ok(boss)
  assert.ok(boss.board.length > 0)
  assert.equal(createBuiltInEliteTestEncounter("boss-act4", 2), null)

  const easyArceus = createBuiltInEliteTestEncounter("arceus", 0)
  const impossibleArceus = createBuiltInEliteTestEncounter("arceus", 3)
  assert.equal(easyArceus?.board[0][2], 2)
  assert.equal(impossibleArceus?.board[0][2], 3)
})

test("designed opponents preserve authored items and every bonus", () => {
  const state = new GameState(
    "test",
    "test",
    true,
    GameMode.CUSTOM_LOBBY,
    null,
    null,
    null
  )
  const design = parseEliteDesignExport(
    JSON.stringify({
      name: "Exact Opponent",
      icon: Pkm.MEW,
      board: [[Pkm.MEW, 4, 2]],
      items: [[Item.SHELL_BELL]],
      bonus: {
        bonusHP: 100,
        bonusAtk: 5,
        bonusDef: 3,
        bonusSpeDef: 4,
        bonusAP: 20,
        bonusPP: 10,
        mainBonusHP: 50,
        mainBonusAtk: 7,
        mainBonusAP: 11
      }
    })
  )
  assert.ok(design)
  const opponent = buildEliteDesignOpponent(design, state)
  const pokemon = [...opponent.board.values()][0]
  const baseline = PokemonFactory.createPokemonFromName(Pkm.MEW)

  assert.equal(opponent.team, Team.RED_TEAM)
  assert.equal(pokemon.hp, baseline.hp + 150)
  assert.equal(pokemon.atk, baseline.atk + 12)
  assert.equal(pokemon.def, baseline.def + 3)
  assert.equal(pokemon.speDef, baseline.speDef + 4)
  assert.equal(pokemon.ap, baseline.ap + 31)
  assert.equal(pokemon.maxPP, baseline.maxPP + 10)
  assert.deepEqual([...pokemon.items], [Item.SHELL_BELL])
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
