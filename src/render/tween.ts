/**
 * A very small promise-based tween runner.
 *
 * The renderer is a player of the engine's event tape, so all it needs is
 * "move this thing over that long and tell me when you're done". That is not
 * worth a dependency.
 */

export type Easing = (t: number) => number;

export const easeOutCubic: Easing = (t) => 1 - (1 - t) ** 3;
export const easeInCubic: Easing = (t) => t * t * t;
export const easeOutBack: Easing = (t) => {
  const c = 1.70158;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
export const easeInOutQuad: Easing = (t) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
export const linear: Easing = (t) => t;

/** Global speed multiplier — turbo mode turns this up. */
let speed = 1;

export function setSpeed(multiplier: number): void {
  speed = Math.max(0.05, multiplier);
}

export function getSpeed(): number {
  return speed;
}

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Runs `onFrame(progress)` from 0 to 1 over `ms`, then resolves. */
export function tween(ms: number, onFrame: (t: number) => void, ease: Easing = easeOutCubic): Promise<void> {
  const duration = prefersReducedMotion() ? 1 : Math.max(1, ms / speed);

  return new Promise((resolve) => {
    const start = performance.now();

    const step = (now: number) => {
      const raw = Math.min(1, (now - start) / duration);
      onFrame(ease(raw));
      if (raw < 1) requestAnimationFrame(step);
      else resolve();
    };

    requestAnimationFrame(step);
  });
}

export function delay(ms: number): Promise<void> {
  const duration = prefersReducedMotion() ? 1 : Math.max(0, ms / speed);
  return new Promise((resolve) => setTimeout(resolve, duration));
}

/** Runs several animations at once and waits for the slowest. */
export function all(promises: Promise<void>[]): Promise<void> {
  return Promise.all(promises).then(() => undefined);
}

/** Staggers a list of animations by `gap` ms each. */
export async function stagger<T>(
  items: readonly T[],
  gap: number,
  run: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const running: Promise<void>[] = [];
  for (const [index, item] of items.entries()) {
    running.push(run(item, index));
    if (index < items.length - 1 && gap > 0) await delay(gap);
  }
  await all(running);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
