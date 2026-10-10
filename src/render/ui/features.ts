import { urlFor } from '../assets';
import { tween } from '../tween';
import './features.css';
import { DEFAULT_CONFIG } from '../../config/gameConfig';

/** Event-driven counters: never read ahead into the generator's mutable state. */
export class FeatureHud {
  private readonly meter = document.createElement('div');
  private readonly bonus = document.createElement('div');
  private readonly scatters = document.createElement('div');
  private drops = 0;
  private played = 0;
  private active = false;
  private isSuper = false;
  private fill = 0;

  constructor(host: HTMLElement) {
    this.meter.className = 'feature-meter';
    this.meter.innerHTML = '<div class="feature-meter-track"><div class="feature-meter-fill"></div></div><span class="feature-meter-label">COLLECT TO RELEASE</span><span class="feature-meter-value"></span>';
    this.meter.setAttribute('role', 'progressbar');
    this.meter.setAttribute('aria-label', 'Collection meter');
    const art = urlFor('ui.meter');
    if (art) this.meter.style.setProperty('--meter-art', `url("${art}")`);
    this.bonus.className = 'feature-bonus';
    this.bonus.hidden = true;
    this.bonus.setAttribute('role', 'status');
    this.scatters.className = 'feature-scatters';
    this.scatters.setAttribute('aria-label', 'Bonus symbols collected');
    host.append(this.meter, this.bonus, this.scatters);
    this.setScatters(0, 0);
  }

  async setMeter(value: number, size: number, instant = false): Promise<void> {
    const target = Math.min(1, Math.max(0, value / Math.max(1, size)));
    const from = this.fill;
    this.meter.setAttribute('aria-valuemin', '0');
    this.meter.setAttribute('aria-valuemax', String(size));
    this.meter.setAttribute('aria-valuenow', String(value));
    this.meter.querySelector('.feature-meter-value')!.textContent = `${value} / ${size}`;
    const draw = (t: number) => {
      this.fill = from + (target - from) * t;
      this.meter.style.setProperty('--fill', String(this.fill));
    };
    if (instant) draw(1);
    else await tween(280, draw);
  }

  async release(): Promise<void> {
    this.meter.classList.add('releasing');
    await tween(450, () => undefined);
    this.meter.classList.remove('releasing');
  }

  startBonus(drops: number, isSuper: boolean): void {
    this.drops = drops;
    this.played = 0;
    this.active = true;
    this.isSuper = isSuper;
    this.drawBonus();
  }

  nextDrop(free: boolean): void {
    if (!free) {
      this.endBonus();
      this.setScatters(0, 0);
      return;
    }
    if (this.active) {
      this.played++;
      this.drops = Math.max(0, this.drops - 1);
      this.drawBonus();
    }
  }

  addDrops(drops: number): void {
    if (!this.active) return;
    this.drops += drops;
    this.drawBonus();
  }

  endBonus(): void {
    this.active = false;
    this.bonus.hidden = true;
  }

  private drawBonus(): void {
    this.bonus.hidden = false;
    this.bonus.innerHTML = `<span>${this.isSuper ? 'SUPER BONUS' : 'BONUS'}</span><strong>${this.played} / ${this.played + this.drops}</strong><small>${this.drops} FREE DROPS LEFT</small>`;
  }

  setScatters(count: number, superCount: number): void {
    this.scatters.replaceChildren();
    const art = urlFor(superCount > 0 ? 'special.superBonus' : 'special.bonus');
    if (art) {
      const img = document.createElement('img');
      img.src = art;
      img.alt = '';
      const icon = document.createElement('div');
      icon.className = 'feature-scatter-icon';
      icon.append(img);
      this.scatters.append(icon);
    }
    const label = document.createElement('span');
    label.textContent = `${count} / ${DEFAULT_CONFIG.bonus.scattersToTrigger} BONUS`;
    this.scatters.append(label);
    this.scatters.classList.toggle('ready', count >= DEFAULT_CONFIG.bonus.scattersToTrigger);
  }
}
