import { DEFAULT_CONFIG } from '../../config/gameConfig';
import { GEM_PAYTABLE, MAX_GEM_LEVEL, PAYOUT_SCALE } from '../../config/paytable';
import type { BuyKind } from '../../math/engine';
import { GEM_COLORS } from '../../math/types';
import type { QuizStatsData } from '../../quiz/stats';
import { money } from './hud';

const BUYS: { kind: BuyKind; name: string; blurb: string }[] = [
  {
    kind: 'bonusHunt',
    name: 'Bonus hunt',
    blurb: `${DEFAULT_CONFIG.buy.bonusHuntMultiplier}x the chance of triggering free drops`,
  },
  { kind: 'banditEscape', name: "Bandit's escape", blurb: 'The bandit starts the spin loose' },
  { kind: 'coinGame', name: 'Coin game', blurb: 'Guaranteed coin game' },
  { kind: 'bonus', name: 'Bonus', blurb: `${DEFAULT_CONFIG.bonus.initialDrops} free drops` },
  {
    kind: 'superBonus',
    name: 'Super bonus',
    blurb: 'Free drops on the full grid, every upgrade upgrades everything',
  },
];

export class Panels {
  constructor(private readonly layer: HTMLElement) {
    this.layer.addEventListener('click', (event) => {
      if (event.target === this.layer) this.close();
    });
  }

  close(): void {
    this.layer.hidden = true;
    this.layer.replaceChildren();
  }

  private open(html: string): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = html;

    const actions = document.createElement('div');
    actions.className = 'panel-actions';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => this.close());
    actions.appendChild(closeButton);
    panel.appendChild(actions);

    this.layer.replaceChildren(panel);
    this.layer.hidden = false;
    closeButton.focus();
    return panel;
  }

  /** The buy menu. Resolves with a choice, or `null` if dismissed. */
  buyMenu(bet: number, balance: number): Promise<BuyKind | null> {
    return new Promise((resolve) => {
      const panel = this.open(`
        <h2>Feature buy</h2>
        <p class="sub">Prices are multiples of your ${money(bet)} bet</p>
        <div class="buy-list"></div>
      `);

      const list = panel.querySelector('.buy-list') as HTMLElement;

      for (const buy of BUYS) {
        const cost = DEFAULT_CONFIG.buy[buy.kind] * bet;
        const row = document.createElement('div');
        row.className = 'buy-row';
        row.innerHTML = `
          <span class="buy-copy">
            <strong></strong>
            <small></small>
          </span>
        `;
        (row.querySelector('strong') as HTMLElement).textContent = buy.name;
        (row.querySelector('small') as HTMLElement).textContent = buy.blurb;

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = money(cost);
        button.disabled = cost > balance;
        button.addEventListener('click', () => {
          this.close();
          resolve(buy.kind);
        });
        row.appendChild(button);
        list.appendChild(row);
      }

      const closeButton = panel.querySelector('.panel-actions button') as HTMLButtonElement;
      closeButton.addEventListener('click', () => resolve(null));
    });
  }

  /** Rules, paytable and session stats. */
  info(stats: QuizStatsData): void {
    const rows = Array.from({ length: MAX_GEM_LEVEL }, (_, i) => {
      const level = i + 1;
      const cells = GEM_COLORS.map(
        (color) => `<td>${(GEM_PAYTABLE[color][i] * PAYOUT_SCALE).toFixed(2)}x</td>`,
      ).join('');
      return `<tr><td>Level ${level}</td>${cells}</tr>`;
    }).join('');

    const categories = Object.entries(stats.byCategory)
      .sort((a, b) => b[1].asked - a[1].asked)
      .map(
        ([name, tally]) =>
          `<li><b>${escape(name)}</b><span>${tally.correct}/${tally.asked} correct</span></li>`,
      )
      .join('');

    this.open(`
      <h2>How it works</h2>
      <p class="sub">Collect, duel, answer</p>

      <ul class="symbol-list">
        <li><b>Birds</b><span>Each bird eats gems of its own colour that it can reach, plus any special symbol. It walks along the trail, turning and doubling back to pick up what it left behind.</span></li>
        <li><b>Duels</b><span>When birds end up next to each other they square up — and a question appears. Answer correctly and the showdown fires: they shoot along rows, columns and diagonals, clearing gems, banking coins and features, and lighting any dynamite. Answer wrong and they stand down.</span></li>
        <li><b>The bandit</b><span>A key sets it loose. It steals any colour and carries the loot. Beat it in a duel and the bird takes everything back; lose and it works through the birds one by one.</span></li>
        <li><b>Upgrades</b><span>Gems climb seven levels. Levels hold for the whole spin, and for a whole bonus.</span></li>
        <li><b>Dynamite</b><span>Explodes at the end of the round, clearing its neighbours and growing the grid toward ${DEFAULT_CONFIG.grid.maxCols}x${DEFAULT_CONFIG.grid.maxRows}.</span></li>
        <li><b>Train</b><span>Rob a marked symbol at both edges of the grid to ride the train back with extra features.</span></li>
        <li><b>Coin game</b><span>Sweep the board clear — or lose every bird to the bandit — and the lassos come out.</span></li>
        <li><b>Free drops</b><span>Collect ${DEFAULT_CONFIG.bonus.scattersToTrigger} scatters for ${DEFAULT_CONFIG.bonus.initialDrops} drops. Grid size, meter and gem levels all carry over, and each scatter collected adds another drop.</span></li>
      </ul>

      <h2 style="margin-top:1.25rem">Gem values</h2>
      <p class="sub">Per gem, as a multiple of your bet</p>
      <div class="table-scroll">
        <table class="paytable">
          <thead>
            <tr><th></th>${GEM_COLORS.map((c) => `<th>${c}</th>`).join('')}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <h2 style="margin-top:1.25rem">Your quiz record</h2>
      <p class="sub">${
        stats.asked === 0
          ? 'No questions yet'
          : `${stats.correct} of ${stats.asked} correct · best streak ${stats.bestStreak}`
      }</p>
      ${categories ? `<ul class="symbol-list">${categories}</ul>` : ''}
    `);
  }
}

function escape(text: string): string {
  const node = document.createElement('div');
  node.textContent = text;
  return node.innerHTML;
}
