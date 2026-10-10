import type { BuyKind, ForceFlags } from '../../math/engine';

export type AutoAnswer = 'off' | 'correct' | 'wrong';

export interface DebugState {
  seed: string;
  autoAnswer: AutoAnswer;
  force: ForceFlags;
}

export interface DebugCallbacks {
  onSpin(opts: { buy?: BuyKind; force?: ForceFlags }): void;
  onSeed(seed: string): void;
  onAutoAnswer(mode: AutoAnswer): void;
  onReset(): void;
}

/**
 * Dev-only panel. Lets you drive straight at whichever feature you are working
 * on instead of spinning until it shows up, and auto-answers questions so a
 * long run can be left to itself.
 *
 * Only mounted when `import.meta.env.DEV` is true, so it never ships.
 */
export class DebugPanel {
  private readonly panel = document.createElement('div');
  private open = false;
  private autoAnswer: AutoAnswer = 'off';

  constructor(host: HTMLElement, private readonly callbacks: DebugCallbacks) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'debug-toggle';
    toggle.textContent = 'Dev tools';
    toggle.addEventListener('click', () => {
      this.open = !this.open;
      this.panel.hidden = !this.open;
      toggle.textContent = this.open ? 'Hide dev tools' : 'Dev tools';
    });

    this.panel.className = 'debug-panel';
    this.panel.hidden = true;
    this.build();

    host.append(this.panel, toggle);
  }

  get autoAnswerMode(): AutoAnswer {
    return this.autoAnswer;
  }

  private build(): void {
    this.panel.innerHTML = `
      <h3>Force a feature</h3>
      <div class="debug-grid" data-group="force"></div>

      <h3>Buy</h3>
      <div class="debug-grid" data-group="buy"></div>

      <h3>Auto-answer</h3>
      <div class="debug-grid" data-group="answer"></div>

      <h3>Seed</h3>
      <label>
        <input type="text" id="debug-seed" placeholder="leave blank for random" />
      </label>
      <div class="debug-grid" data-group="session"></div>
    `;

    const forces: { label: string; force: ForceFlags }[] = [
      { label: 'Duel', force: { duel: true } },
      { label: 'Dynamite', force: { dynamite: true } },
      { label: 'Bandit', force: { key: true } },
      { label: 'Coin game', force: { coinGame: true } },
    ];

    const forceGroup = this.panel.querySelector('[data-group="force"]') as HTMLElement;
    for (const entry of forces) {
      forceGroup.appendChild(
        this.button(entry.label, () => this.callbacks.onSpin({ force: entry.force })),
      );
    }

    const buys: { label: string; buy: BuyKind }[] = [
      { label: 'Hunt', buy: 'bonusHunt' },
      { label: 'Escape', buy: 'banditEscape' },
      { label: 'Coins', buy: 'coinGame' },
      { label: 'Bonus', buy: 'bonus' },
      { label: 'Super', buy: 'superBonus' },
    ];

    const buyGroup = this.panel.querySelector('[data-group="buy"]') as HTMLElement;
    for (const entry of buys) {
      buyGroup.appendChild(this.button(entry.label, () => this.callbacks.onSpin({ buy: entry.buy })));
    }

    const answerGroup = this.panel.querySelector('[data-group="answer"]') as HTMLElement;
    const modes: AutoAnswer[] = ['off', 'correct', 'wrong'];
    const modeButtons = new Map<AutoAnswer, HTMLButtonElement>();

    for (const mode of modes) {
      const button = this.button(mode, () => {
        this.autoAnswer = mode;
        for (const [m, b] of modeButtons) b.setAttribute('aria-pressed', String(m === mode));
        this.callbacks.onAutoAnswer(mode);
      });
      button.className = 'toggle';
      button.setAttribute('aria-pressed', String(mode === this.autoAnswer));
      modeButtons.set(mode, button);
      answerGroup.appendChild(button);
    }

    const seedInput = this.panel.querySelector('#debug-seed') as HTMLInputElement;
    seedInput.addEventListener('change', () => this.callbacks.onSeed(seedInput.value.trim()));

    const sessionGroup = this.panel.querySelector('[data-group="session"]') as HTMLElement;
    sessionGroup.appendChild(this.button('Reset session', () => this.callbacks.onReset()));
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }
}
