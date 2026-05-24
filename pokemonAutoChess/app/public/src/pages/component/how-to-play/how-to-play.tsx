import React from "react"
import "./how-to-play.css"

export default function HowToPlay() {
  return (
    <div className="how-to-play">
      <section>
        <h2>Overview</h2>
        <p>
          Pokemon Auto Spire is a single-player roguelike auto-battler. Build a team of Pokemon,
          navigate a branching map across 3 acts, and defeat legendary bosses.
          You start with 100 HP — if it reaches 0, your run ends.
        </p>
      </section>

      <section>
        <h2>Map Nodes</h2>
        <table>
          <thead>
            <tr><th>Node</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td>Wild Battle</td><td>Fight wild Pokemon from the region's synergy types. Difficulty scales with act and floor.</td></tr>
            <tr><td>Gym Leader</td><td>Fight a themed gym leader team. Awards a synergy gem + item on win.</td></tr>
            <tr><td>Elite</td><td>Challenging themed encounter. Win to earn special Pokemon; lose and you get random picks instead.</td></tr>
            <tr><td>PokeMart</td><td>Walk-around shop. Buy Pokemon and items with gold.</td></tr>
            <tr><td>Pokemon Center</td><td>Choose one: Heal 30 HP, receive a Ditto + item, or get a Dojo Ticket.</td></tr>
            <tr><td>Mystery</td><td>Random event with 2-3 choices — items, gold, healing, or risk/reward trades.</td></tr>
            <tr><td>Boss</td><td>Act-ending legendary boss fight. Awards a shiny item on win.</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Battle Rewards</h2>
        <h3>Wild Battles</h3>
        <ul>
          <li><strong>Win:</strong> Choose 1 of 3 Pokemon (each paired with a random item component) + a Ditto option (no item).</li>
          <li><strong>Lose:</strong> Choose 1 of 3 random Pokemon (no items, no Ditto option).</li>
        </ul>

        <h3>Elite Encounters</h3>
        <ul>
          <li><strong>Win:</strong> Choose from the encounter's special themed Pokemon (with items).</li>
          <li><strong>Lose:</strong> Choose from regular random Pokemon.</li>
        </ul>

        <h3>Gym Leaders</h3>
        <ul>
          <li><strong>Win:</strong> Receive a synergy gem (auto-applied) + choose an item.</li>
          <li><strong>Lose:</strong> Choose 1 of 3 random Pokemon.</li>
        </ul>

        <h3>Legendary Bosses</h3>
        <ul>
          <li><strong>Win:</strong> Choose 1 of 3 shiny (gold) items. Advances to next act.</li>
          <li><strong>Lose:</strong> Take HP damage. You can retry on the next run attempt.</li>
        </ul>
      </section>

      <section>
        <h2>Economy</h2>
        <table>
          <thead>
            <tr><th>Source</th><th>Gold</th></tr>
          </thead>
          <tbody>
            <tr><td>Wild Battle</td><td>4 + 2 per act</td></tr>
            <tr><td>Elite</td><td>8 + 4 per act</td></tr>
            <tr><td>Gym Leader</td><td>12 + 4 per act</td></tr>
            <tr><td>Boss</td><td>24 + 6 per act</td></tr>
            <tr><td>Sell Pokemon</td><td>1★ = 1g, 2★ = 6g, 3★ = 10g</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Run Structure</h2>
        <ul>
          <li><strong>3 Acts</strong>, 20 floors each (60 total).</li>
          <li>3-5 nodes per floor with branching paths.</li>
          <li>Each act ends with a legendary boss fight.</li>
          <li>Defeat all 3 bosses to win the run!</li>
        </ul>
      </section>

      <section>
        <h2>Tips</h2>
        <ul>
          <li>Build around 1-2 synergies for powerful team bonuses.</li>
          <li>Synergy gems from gym leaders stack — target gyms that match your team.</li>
          <li>Use the level-up button to increase your max team size.</li>
          <li>You can rearrange your board during the map phase and after fights.</li>
          <li>Combine two item components on a Pokemon to craft a powerful item.</li>
          <li>Three copies of the same Pokemon merge into a stronger star upgrade.</li>
        </ul>
      </section>
    </div>
  )
}
