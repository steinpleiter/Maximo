import { urlFor } from '../assets';
import { getSpeed } from '../tween';
import './celebrations.css';

export type WinTier = 'ordinary' | 'big' | 'super' | 'mega' | 'epic';
export type CelebrationKind = 'round' | 'goldRush' | 'bonus';

/** Tiers always describe the return in multiples of the stake, not cash. */
export function winTier(multiplier: number): WinTier {
  if (multiplier >= 100) return 'epic';
  if (multiplier >= 50) return 'mega';
  if (multiplier >= 25) return 'super';
  if (multiplier >= 10) return 'big';
  return 'ordinary';
}

const birdKeys = ['bird.blue', 'bird.red', 'bird.purple', 'bird.green'];
const money = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
let nextId = 0;

interface Presentation {
  layer: HTMLDivElement;
  scene: HTMLDivElement;
  button: HTMLButtonElement;
  title: HTMLHeadingElement;
  close: () => void;
  done: Promise<void>;
}

/** One self-contained foreground presentation; it never changes game state. */
export class Celebrations {
  private active: Presentation | null = null;
  private frames = new Set<number>();
  private disposed = false;

  constructor(private readonly host: HTMLElement) {}

  win(multiplier: number, bet: number, kind: CelebrationKind = 'round'): Promise<void> {
    if (this.disposed || !Number.isFinite(multiplier) || multiplier <= 0 || !Number.isFinite(bet) || bet < 0) {
      return Promise.resolve();
    }
    const tier = winTier(multiplier);
    const ordinary = tier === 'ordinary' && kind === 'round';
    const title = kind === 'goldRush' ? 'GOLD RUSH' : kind === 'bonus' ? 'BONUS WIN' : ordinary ? 'YOU WON' : `${tier.toUpperCase()} WIN`;
    const presentation = this.open(title, `${ordinary ? 'ordinary' : tier === 'ordinary' ? 'feature' : tier} ${kind}`, false);
    const { layer, scene, button } = presentation;
    this.addBackdrop(scene, ordinary);
    if (!ordinary) {
      const count = kind === 'goldRush' || kind === 'bonus' || tier === 'epic' ? 4 : tier === 'mega' ? 3 : tier === 'super' ? 2 : 1;
      this.addCast(scene, count, kind === 'goldRush');
      this.addCoins(layer, kind === 'goldRush' || tier === 'epic' ? 32 : tier === 'mega' ? 24 : 16);
    }

    const eyebrow = document.createElement('p');
    eyebrow.className = 'celebration-eyebrow';
    eyebrow.textContent = kind === 'goldRush' ? 'THE COIN COLLECTION' : kind === 'bonus' ? 'FREE DROPS COMPLETE' : ordinary ? 'ROUND COMPLETE' : 'MAX BIRDS';
    scene.insertBefore(eyebrow, presentation.title);
    const amount = document.createElement('div');
    amount.className = 'celebration-amount celebration-gold';
    amount.setAttribute('aria-hidden', 'true');
    const detail = document.createElement('p');
    detail.className = 'celebration-detail';
    detail.textContent = `${money.format(multiplier)}× BET`;
    scene.insertBefore(amount, button);
    scene.insertBefore(detail, button);

    // Announce the final result once; counting digits stay decorative.
    const announcement = document.createElement('span');
    announcement.className = 'celebration-sr-only';
    announcement.textContent = `Win ${money.format(multiplier * bet)}, ${money.format(multiplier)} times your bet.`;
    announcement.id = `${presentation.title.id}-result`;
    scene.appendChild(announcement);
    scene.setAttribute('aria-describedby', announcement.id);

    let completed = false;
    let countingFrame = 0;
    const paint = (value: number) => {
      const text = money.format(value);
      amount.textContent = text;
      amount.dataset.text = text;
    };
    const finishCounting = () => {
      if (completed) return;
      completed = true;
      this.cancelFrame(countingFrame);
      paint(multiplier * bet);
      layer.classList.add('is-counted');
      button.textContent = ordinary ? 'Continue' : 'Collect win';
      button.setAttribute('aria-label', 'Continue to the game');
      // Auto-play remains hands-free. Give even reduced-motion users a readable hold.
      this.animate(ordinary ? 650 : 1600, () => {}, presentation.close, false);
    };
    const advance = () => completed ? presentation.close() : finishCounting();
    layer.addEventListener('click', advance);
    button.textContent = 'Reveal win';
    button.setAttribute('aria-label', 'Finish counting your win');
    layer.addEventListener('celebration-advance', advance);
    paint(0);
    countingFrame = this.animate(ordinary ? 380 : tier === 'epic' || kind === 'goldRush' ? 2300 : 1700, (t) => {
      paint(multiplier * bet * (1 - (1 - t) ** 3));
    }, finishCounting);
    return presentation.done;
  }

  bonus(drops: number, isSuper: boolean): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const presentation = this.open(isSuper ? 'SUPER BONUS' : 'BONUS', `bonus-intro${isSuper ? ' is-super' : ''}`, true);
    const { layer, scene, button } = presentation;
    this.addBackdrop(scene, false);
    this.addCoins(layer, isSuper ? 18 : 10);
    this.addCast(scene, 4, false);
    const track = document.createElement('div');
    track.className = 'celebration-track';
    track.setAttribute('aria-hidden', 'true');
    scene.prepend(track);
    const train = document.createElement('div');
    train.className = 'celebration-train';
    train.innerHTML = '<div class="celebration-steam"><i></i><i></i><i></i></div><div class="celebration-chimney"></div><div class="celebration-headlamp"></div><div class="celebration-boiler"><strong class="celebration-drops celebration-gold"></strong></div><div class="celebration-train-plate">FREE DROPS</div><div class="celebration-cowcatcher"></div><i class="celebration-wheel left"></i><i class="celebration-wheel right"></i>';
    const count = Math.max(0, Math.floor(Number.isFinite(drops) ? drops : 0));
    const number = train.querySelector<HTMLElement>('.celebration-drops')!;
    number.textContent = String(count);
    number.dataset.text = String(count);
    scene.insertBefore(train, button);
    const detail = document.createElement('p');
    detail.className = 'celebration-detail';
    detail.textContent = isSuper ? 'ALL ABOARD. MAKE IT SUPER.' : 'YOUR NEXT ADVENTURE STARTS HERE';
    scene.insertBefore(detail, button);
    scene.setAttribute('aria-label', `${isSuper ? 'Super bonus' : 'Bonus'}: ${count} free drops`);
    button.textContent = 'Start';
    button.setAttribute('aria-label', `Start ${count} ${isSuper ? 'super bonus' : 'bonus'} free drops`);
    button.addEventListener('click', presentation.close);
    layer.addEventListener('celebration-advance', presentation.close);
    return presentation.done;
  }

  dispose(): void {
    this.disposed = true;
    this.active?.close();
    this.cancelFrames();
  }

  private open(text: string, variant: string, requiresStart: boolean): Presentation {
    this.active?.close();
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layer = document.createElement('div');
    layer.className = `celebration-layer ${variant}`;
    layer.style.setProperty('--celebration-speed', String(1 / Math.max(0.05, getSpeed())));
    const scene = document.createElement('div');
    scene.className = 'celebration-scene';
    scene.setAttribute('role', 'dialog');
    scene.setAttribute('aria-modal', 'true');
    const title = document.createElement('h2');
    title.className = 'celebration-title celebration-gold';
    title.id = `celebration-title-${++nextId}`;
    title.textContent = text;
    title.dataset.text = text;
    scene.setAttribute('aria-labelledby', title.id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'celebration-continue';
    button.textContent = requiresStart ? 'Start' : 'Reveal win';
    scene.append(title, button);
    layer.appendChild(scene);
    const stop = (event: Event) => event.stopPropagation();
    layer.addEventListener('click', stop);
    layer.addEventListener('pointerdown', stop);
    layer.addEventListener('pointerup', stop);
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('#audio-controls')) return;
      event.stopImmediatePropagation();
      if (event.key === 'Tab') {
        event.preventDefault();
        button.focus({ preventScroll: true });
      } else if (['Enter', ' ', 'Escape'].includes(event.key)) {
        event.preventDefault();
        if (!event.repeat && (event.key !== 'Escape' || !requiresStart)) {
          layer.dispatchEvent(new Event('celebration-advance'));
        }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('#audio-controls')) return;
      event.stopImmediatePropagation();
      if (['Enter', ' ', 'Escape', 'Tab'].includes(event.key)) event.preventDefault();
    };
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.closest('#audio-controls')) return;
      if (event.target instanceof Node && !layer.contains(event.target)) button.focus({ preventScroll: true });
    };
    // Capture before the shell's Space-to-spin handler and quiz shortcuts.
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('focusin', containFocus);
    let resolve!: () => void;
    const done = new Promise<void>((finish) => { resolve = finish; });
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.cancelFrames();
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('focusin', containFocus);
      layer.remove();
      this.active = null;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
      resolve();
    };
    const presentation = { layer, scene, title, button, close, done };
    this.active = presentation;
    this.host.appendChild(layer);
    button.focus({ preventScroll: true });
    return presentation;
  }

  private addBackdrop(scene: HTMLElement, ordinary: boolean): void {
    const glow = document.createElement('div');
    glow.className = 'celebration-glow';
    glow.setAttribute('aria-hidden', 'true');
    scene.prepend(glow);
    if (ordinary) return;
    const burst = document.createElement('div');
    burst.className = 'celebration-burst';
    burst.setAttribute('aria-hidden', 'true');
    const artwork = urlFor('effect.win');
    if (artwork) burst.style.backgroundImage = `url("${artwork}")`;
    scene.prepend(burst);
  }

  private addCast(scene: HTMLElement, count: number, rival: boolean): void {
    const cast = document.createElement('div');
    cast.className = 'celebration-cast';
    cast.setAttribute('aria-hidden', 'true');
    const keys = birdKeys.slice(0, count);
    if (rival) keys.splice(2, 0, 'bandit');
    cast.style.setProperty('--cast-count', String(keys.length));
    keys.forEach((key, index) => {
      const url = urlFor(key);
      if (!url) return;
      const bird = document.createElement('div');
      bird.className = `celebration-bird${key === 'bandit' ? ' is-rival' : ''}`;
      bird.style.setProperty('--bird-index', String(index));
      bird.style.setProperty('--bird-tilt', `${(index % 2 ? 1 : -1) * 8}deg`);
      const image = document.createElement('img');
      image.alt = '';
      image.src = url;
      image.draggable = false;
      bird.appendChild(image);
      cast.appendChild(bird);
    });
    scene.insertBefore(cast, scene.querySelector('.celebration-title'));
  }

  private addCoins(layer: HTMLElement, count: number): void {
    if (reducedMotion()) return;
    const coins = document.createElement('div');
    coins.className = 'celebration-coins';
    coins.setAttribute('aria-hidden', 'true');
    // The gameplay coin symbol is a bag; only the round coin effect belongs in the shower.
    const url = urlFor('effect.coin');
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('i');
      coin.className = 'celebration-coin';
      // Deterministic distribution gives the entire screen depth without layout work per frame.
      coin.style.setProperty('--coin-x', `${(i * 37 + 9) % 100}%`);
      coin.style.setProperty('--coin-size', `${28 + (i * 19) % 63}px`);
      coin.style.setProperty('--coin-delay', `${-(i * 0.173)}s`);
      coin.style.setProperty('--coin-duration', `${2.6 + (i % 7) * 0.24}s`);
      coin.style.setProperty('--coin-drift', `${(i % 2 ? 1 : -1) * (35 + i % 5 * 18)}px`);
      if (url) {
        coin.classList.add('has-art');
        coin.style.backgroundImage = `url("${url}")`;
      }
      coins.appendChild(coin);
    }
    layer.appendChild(coins);
  }

  private animate(duration: number, paint: (t: number) => void, finish: () => void, reduce = true): number {
    let elapsed = 0;
    let previous = performance.now();
    let id = 0;
    const frame = (now: number) => {
      this.frames.delete(id);
      if (!this.active) return;
      elapsed += (now - previous) * getSpeed();
      previous = now;
      const progress = reduce && reducedMotion() ? 1 : Math.min(1, elapsed / duration);
      paint(progress);
      if (progress >= 1) finish();
      else {
        id = requestAnimationFrame(frame);
        this.frames.add(id);
      }
    };
    id = requestAnimationFrame(frame);
    this.frames.add(id);
    // Cancellation is by animation identity, not the first frame ID, which expires.
    const identity = id;
    this.animationCancels.set(identity, () => this.cancelFrameId(id));
    return identity;
  }

  private animationCancels = new Map<number, () => void>();

  private cancelFrame(identity: number): void {
    this.animationCancels.get(identity)?.();
    this.animationCancels.delete(identity);
  }

  private cancelFrameId(id: number): void {
    cancelAnimationFrame(id);
    this.frames.delete(id);
  }

  private cancelFrames(): void {
    for (const id of this.frames) cancelAnimationFrame(id);
    this.frames.clear();
    this.animationCancels.clear();
  }
}
