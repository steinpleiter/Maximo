import type { GemColor } from '../math/types';

/**
 * Gem value per upgrade level, as a multiple of the bet. Index 0 is level 1.
 *
 * Level 7 (the top row) is well attested across Pirots 3 reviews; the
 * intermediate rows come from a single source, so treat them as provisional
 * and tune freely — they are only numbers in a table.
 */
export const GEM_PAYTABLE: Record<GemColor, readonly number[]> = {
  blue: [0.05, 0.1, 0.2, 0.3, 0.8, 2.5, 7.5],
  green: [0.05, 0.15, 0.3, 0.45, 1.2, 3.75, 10],
  purple: [0.1, 0.2, 0.4, 0.6, 1.6, 5, 15],
  red: [0.1, 0.25, 0.5, 0.75, 2.5, 7.5, 30],
};

export const MAX_GEM_LEVEL = 7;

/**
 * Global scale applied to every gem and wild payout.
 *
 * The ladder above is the real game's, and it is kept intact because it is the
 * shape of the progression. But this clone keeps far more birds on the grid
 * than the original — that is what makes duels, and therefore quiz questions,
 * frequent — so collections land on almost every spin. At full ladder values
 * that pushes the return well above 100% and the balance only ever climbs,
 * which drains the tension out of a session. This brings it back under water.
 *
 * Raise it toward 1 for a gentler, more generous game; drop it for a harsher
 * one. The paytable screen shows the scaled values, so the UI never lies.
 */
export const PAYOUT_SCALE = 0.36;

/** The colour a wild pays as when it stands in for the top gem. */
export const TOP_GEM_COLOR: GemColor = 'red';

/** Value of a single gem at a given level, as a multiple of the bet. */
export function gemValue(color: GemColor, level: number): number {
  return rawGemValue(color, level) * PAYOUT_SCALE;
}

/** The unscaled ladder value, for reference and for the paytable screen. */
export function rawGemValue(color: GemColor, level: number): number {
  const table = GEM_PAYTABLE[color];
  const idx = Math.min(Math.max(level, 1), MAX_GEM_LEVEL) - 1;
  return table[idx];
}

/**
 * Coin values and their relative weights. Shaped so the headline 10,000x is
 * reachable in principle but vanishingly rare.
 */
export const COIN_VALUES: readonly { value: number; weight: number }[] = [
  { value: 1, weight: 3600 },
  { value: 2, weight: 2200 },
  { value: 3, weight: 1400 },
  { value: 5, weight: 900 },
  { value: 10, weight: 320 },
  { value: 15, weight: 140 },
  { value: 20, weight: 70 },
  { value: 25, weight: 36 },
  { value: 50, weight: 12 },
  { value: 75, weight: 5 },
  { value: 100, weight: 2.5 },
  { value: 250, weight: 0.6 },
  { value: 500, weight: 0.2 },
  { value: 1000, weight: 0.06 },
  { value: 2500, weight: 0.012 },
  { value: 10000, weight: 0.001 },
];
