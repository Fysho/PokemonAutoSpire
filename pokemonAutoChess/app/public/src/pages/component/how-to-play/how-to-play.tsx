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
            <tr><td>Wild Battle</td><td>Fight wild Pokemon from the region's synergy types. In Acts 2-3, encounters focus on one synergy from the region. Shown as synergy type icons in a triangle on the map.</td></tr>
            <tr><td>Gym Leader</td><td>Fight a gym leader team themed around a synergy type. No synergy repeats within the same act. Win for a synergy gem (+1 synergy level) plus a choice of rewards.</td></tr>
            <tr><td>Elite</td><td>Challenging themed encounter with special Pokemon rewards on win. Shown with a faint red glow on the map.</td></tr>
            <tr><td>Hatch Unlock (Act 1)</td><td>Win to get a Pokemon egg. 8 stages to evolve after hatching.</td></tr>
            <tr><td>Unique Unlock (Act 2)</td><td>Win to recruit a unique Pokemon.</td></tr>
            <tr><td>Legendary Unlock (Act 3)</td><td>Win to recruit a legendary Pokemon.</td></tr>
            <tr><td>PokeMart</td><td>Walk-around shop. Buy Pokemon and items with gold. Acts 1-2 include Pokemon Eggs (12g each).</td></tr>
            <tr><td>Pokemon Center</td><td>Choose one: heal 30 HP, a Ditto, or a Dojo Ticket (instant stat boost).</td></tr>
            <tr><td>Mystery</td><td>Random event with 2-4 choices — items, gold, healing, or risk/reward trades.</td></tr>
            <tr><td>Boss</td><td>Act-ending legendary boss fight. Choose 1 of 3 shiny items on win.</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Things to Note</h2>
        <ul>
          <li>You only need 6 copies of a Pokemon to reach 3★ instead of 9.</li>
          <li>Dojo Tickets work instantly and you can only use one per act on each Pokemon.</li>
          <li>Winning a wild battle gives 1 extra reward choice and a Ditto chance.</li>
          <li>Re-rolling a unique reward will give you the regular reward pool.</li>
          <li>Egg Pokemon take 8 stages to evolve after hatching.</li>
          <li>Pokemon Centers offer healing, Ditto, or Dojo Tickets for stat boosts.</li>
          <li>Gym wins grant a synergy gem (+1 synergy level) plus a choice of rewards.</li>
        </ul>
      </section>

      <section>
        <h2>Battle Rewards</h2>
        <h3>Wild Battles</h3>
        <ul>
          <li><strong>Win (4 choices):</strong> 2-3 Pokemon + 1-2 item components. 33% chance one option is a Ditto.</li>
          <li><strong>Lose (3 choices):</strong> 1-2 Pokemon + 1-2 item components. No Ditto.</li>
        </ul>

        <h3>Elite Encounters</h3>
        <ul>
          <li><strong>Win:</strong> Choose from the encounter's special themed Pokemon (with items). Each elite has unique rewards.</li>
          <li><strong>Lose:</strong> Standard wild loss rewards (1-2 Pokemon + items).</li>
        </ul>

        <h3>Gym Leaders</h3>
        <ul>
          <li><strong>Win:</strong> Synergy gem (auto-applied, +1 synergy level) + choose one of: a crafted item, a Pokemon with item component, or a tool.</li>
          <li><strong>Lose:</strong> Standard wild loss rewards (1-2 Pokemon + items).</li>
        </ul>

        <h3>Legendary Bosses</h3>
        <ul>
          <li><strong>Win:</strong> Choose 1 of 3 shiny (gold) items. Advances to the next act.</li>
          <li><strong>Lose:</strong> Take HP damage. No rewards.</li>
        </ul>
      </section>

      <section>
        <h2>Economy</h2>
        <table>
          <thead>
            <tr><th>Source</th><th>Act 1</th><th>Act 2</th><th>Act 3</th></tr>
          </thead>
          <tbody>
            <tr><td>Wild Battle</td><td>3g</td><td>4g</td><td>5g</td></tr>
            <tr><td>Elite</td><td>5g</td><td>7g</td><td>9g</td></tr>
            <tr><td>Gym Leader</td><td>8g</td><td>11g</td><td>14g</td></tr>
            <tr><td>Boss</td><td>15g</td><td>19g</td><td>23g</td></tr>
          </tbody>
        </table>
        <p>On a loss, gold reward is reduced to 1/3 of the win amount.</p>
        <table>
          <thead>
            <tr><th>Sell Price</th><th>Gold</th></tr>
          </thead>
          <tbody>
            <tr><td>1★ Pokemon</td><td>3g</td></tr>
            <tr><td>2★ Pokemon</td><td>6g</td></tr>
            <tr><td>3★ Pokemon</td><td>10g</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Map Layout (per Act)</h2>
        <ul>
          <li><strong>Floor 1:</strong> Wild Battle (always)</li>
          <li><strong>Floor 5, 16:</strong> PokeMart or Wild (50/50)</li>
          <li><strong>Floor 6, 12, 18:</strong> Gym Leader (guaranteed)</li>
          <li><strong>Floor 9, 15:</strong> Gym Leader (40%) or Wild</li>
          <li><strong>Floor 8, 13, 17:</strong> Elite (50%) or Wild</li>
          <li><strong>Floor 10, 19:</strong> Pokemon Center (guaranteed)</li>
          <li><strong>Floor 20:</strong> Legendary Boss</li>
          <li><strong>Other floors:</strong> Random mix of Wild, Mystery, PokeMart, Pokemon Center</li>
        </ul>
      </section>

      <section>
        <h2>Boss Encounters</h2>
        <table>
          <thead>
            <tr><th>Act</th><th>Possible Bosses</th></tr>
          </thead>
          <tbody>
            <tr><td>Act 1</td><td>Mewtwo & Mew, Tower Duo (Lugia + Ho-Oh), Lake Guardians (Azelf, Mesprit, Uxie)</td></tr>
            <tr><td>Act 2</td><td>Weather Trio (Groudon, Kyogre, Rayquaza), Legendary Birds (Articuno, Zapdos, Moltres), Beasts & Blade (Raikou, Entei, Suicune, Zacian)</td></tr>
            <tr><td>Act 3</td><td>Weather Trio (harder version)</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Dojo Tickets</h2>
        <p>
          Dojo Tickets are found at Pokemon Centers. Drag a ticket onto a Pokemon to give it
          a permanent stat boost. Higher-tier tickets give bigger boosts.
        </p>
        <table>
          <thead>
            <tr><th>Ticket</th><th>HP</th><th>ATK</th><th>AP</th></tr>
          </thead>
          <tbody>
            <tr><td>Bronze (Act 1)</td><td>+50</td><td>+5</td><td>+15</td></tr>
            <tr><td>Silver (Act 2)</td><td>+100</td><td>+10</td><td>+30</td></tr>
            <tr><td>Gold (Act 3)</td><td>+150</td><td>+15</td><td>+45</td></tr>
          </tbody>
        </table>
        <p>
          Each evolution family can only be trained once. After training, all Pokemon
          in that family display <strong>(d)</strong> next to their name and cannot
          receive another Dojo Ticket. The stat boost only applies to the Pokemon you
          trained, but it carries over through evolution.
        </p>
      </section>

      <section>
        <h2>Tips</h2>
        <ul>
          <li>Build around 1-2 synergies for powerful team bonuses.</li>
          <li>Synergy gems from gym leaders stack — target gyms that match your team.</li>
          <li>Use the level-up button to increase your max team size.</li>
          <li>You can rearrange your board and equip items during the map phase and after fights.</li>
          <li>Combine two item components on a Pokemon to craft a powerful item.</li>
          <li>Pokemon Eggs in the shop (Acts 1-2) hatch into random Pokemon after a few rounds.</li>
        </ul>
      </section>
    </div>
  )
}
