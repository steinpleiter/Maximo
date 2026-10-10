import { GEM_COLORS, type GemColor } from '../../math/types';
import { getSpeed } from '../tween';
import { urlFor } from '../assets';

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element #${id}`);
  return found as T;
};

export interface HudCallbacks {
  onSpin(): void;
  onBetChange(delta: number): void;
  onTurbo(on: boolean): void;
  onAuto(on: boolean): void;
  onBuy(): void;
  onInfo(): void;
}

/**
 * The DOM chrome around the canvas: money, bet, the gem-level chips, banners
 * and the button row.
 */
export class Hud {
  private readonly levels = el('levels');
  private readonly bannerLayer = el('banner-layer');

  private readonly valueBalance = el('value-balance');
  private readonly valueWin = el('value-win');
  private readonly valueBet = el('value-bet');
  private readonly valueStreak = el('value-streak');
  private readonly valueAccuracy = el('value-accuracy');

  private readonly spinButton = el<HTMLButtonElement>('spin');
  private readonly betDown = el<HTMLButtonElement>('bet-down');
  private readonly betUp = el<HTMLButtonElement>('bet-up');
  private readonly turboButton = el<HTMLButtonElement>('turbo');
  private readonly autoButton = el<HTMLButtonElement>('auto');
  private readonly buyButton = el<HTMLButtonElement>('buy');
  private readonly infoButton = el<HTMLButtonElement>('info');

  private readonly chips = new Map<GemColor, HTMLElement>();
  private bonusDrops: number | null = null;
  private displayedWin = 0;
  private winFrame = 0;

  constructor(private readonly callbacks: HudCallbacks) {
    this.buildLevelChips();

    this.spinButton.addEventListener('click', () => this.callbacks.onSpin());
    this.betDown.addEventListener('click', () => this.callbacks.onBetChange(-1));
    this.betUp.addEventListener('click', () => this.callbacks.onBetChange(1));
    this.buyButton.addEventListener('click', () => this.callbacks.onBuy());
    this.infoButton.addEventListener('click', () => this.callbacks.onInfo());

    this.turboButton.addEventListener('click', () => {
      const on = this.turboButton.getAttribute('aria-pressed') !== 'true';
      this.turboButton.setAttribute('aria-pressed', String(on));
      this.callbacks.onTurbo(on);
    });

    this.autoButton.addEventListener('click', () => {
      const on = this.autoButton.getAttribute('aria-pressed') !== 'true';
      this.autoButton.setAttribute('aria-pressed', String(on));
      this.callbacks.onAuto(on);
    });
  }

  private buildLevelChips(): void {
    for (const color of GEM_COLORS) {
      const chip = document.createElement('div');
      chip.className = 'level-chip';
      chip.innerHTML = `<span class="level-dot ${color}"></span><span class="level-number">1</span>`;
      const art = urlFor(`gem.${color}.1`);
      if (art) {
        const icon = document.createElement('img');
        icon.src = art;
        icon.alt = `${color} gem level`;
        icon.className = 'level-icon';
        chip.firstElementChild?.replaceWith(icon);
      }
      this.levels.appendChild(chip);
      this.chips.set(color, chip);
    }
  }

  // --- readouts ------------------------------------------------------------

  setBalance(value: number): void {
    this.valueBalance.textContent = money(value);
  }

  setWin(value: number): void {
    cancelAnimationFrame(this.winFrame);
    const from = this.displayedWin;
    if (value === 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.displayedWin = value;
      this.valueWin.textContent = money(value);
      return;
    }
    const start = performance.now();
    const draw = (now: number) => {
      const t = Math.min(1, (now - start) / (380 / getSpeed()));
      this.displayedWin = from + (value - from) * (1 - (1 - t) ** 3);
      this.valueWin.textContent = money(this.displayedWin);
      if (t < 1) this.winFrame = requestAnimationFrame(draw);
    };
    this.winFrame = requestAnimationFrame(draw);
  }

  setBet(value: number): void {
    this.valueBet.textContent = money(value);
  }

  setQuizStats(correct: number, asked: number, streak: number): void {
    this.valueStreak.textContent = String(streak);
    this.valueAccuracy.textContent =
      asked === 0 ? '—' : `${Math.round((correct / asked) * 100)}% of ${asked}`;
  }

  setLevels(levels: Record<GemColor, number>): void {
    for (const color of GEM_COLORS) {
      const chip = this.chips.get(color);
      if (!chip) continue;
      const number = chip.querySelector('.level-number');
      if (number) number.textContent = String(levels[color]);
      chip.classList.remove('bumped');
    }
  }

  bumpLevel(color: GemColor, to: number): void {
    const chip = this.chips.get(color);
    if (!chip) return;
    const number = chip.querySelector('.level-number');
    if (number) number.textContent = String(to);
    chip.classList.add('bumped');
    setTimeout(() => chip.classList.remove('bumped'), 900);
  }

  setBonus(drops: number | null, isSuper: boolean): void {
    this.bonusDrops = drops;
    if (drops === null) {
      this.spinButton.textContent = 'Spin';
      return;
    }
    this.spinButton.textContent = isSuper ? 'Super bonus' : 'Bonus';
  }

  // --- state ---------------------------------------------------------------

  setBusy(busy: boolean): void {
    this.spinButton.disabled = busy;
    this.betDown.disabled = busy;
    this.betUp.disabled = busy;
    this.buyButton.disabled = busy;
    if (!busy && this.bonusDrops === null) this.spinButton.textContent = 'Spin';
  }

  setAuto(on: boolean): void {
    this.autoButton.setAttribute('aria-pressed', String(on));
  }

  // --- banners -------------------------------------------------------------

  /** A short toast over the board. Several can stack. */
  banner(text: string, tone?: 'good' | 'bad'): void {
    const node = document.createElement('div');
    node.className = `banner${tone ? ` ${tone}` : ''}`;
    node.textContent = text;
    this.bannerLayer.appendChild(node);

    // Keep the stack shallow during a long cascade.
    while (this.bannerLayer.childElementCount > 3) {
      this.bannerLayer.firstElementChild?.remove();
    }

    setTimeout(() => {
      node.classList.add('leaving');
      setTimeout(() => node.remove(), 260);
    }, 1100);
  }
}

export function money(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
