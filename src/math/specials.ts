import type { GameConfig } from '../config/gameConfig';
import { MAX_GEM_LEVEL } from '../config/paytable';
import type { CollectResult } from './collect';
import { ORTHOGONAL, inBounds } from './grid';
import { GEM_COLORS, type GameEvent, type GameState, type GemColor, type Pos } from './types';

export interface SpecialsOutcome {
  events: GameEvent[];
  /** Positions where dynamite was eaten; they blow at the end of the round. */
  dynamite: Pos[];
  /** A key turned up, so the bandit should be let out. */
  keyCollected: boolean;
}

/** Raises one colour's level, clamped at the top of the ladder. */
export function upgradeColor(
  state: GameState,
  color: GemColor,
  steps: number,
): GameEvent | null {
  const from = state.gemLevels[color];
  const to = Math.min(MAX_GEM_LEVEL, from + steps);
  if (to === from) return null;
  state.gemLevels[color] = to;
  return { t: 'gemUpgrade', color, from, to };
}

/** Repaints the gems orthogonally adjacent to `origin` in the collector's colour. */
export function transformAround(
  state: GameState,
  origin: Pos,
  color: GemColor,
): GameEvent | null {
  const changed: Pos[] = [];
  for (const dir of ORTHOGONAL) {
    const r = origin.r + dir.r;
    const c = origin.c + dir.c;
    if (!inBounds(state, r, c)) continue;
    const cell = state.grid[r][c];
    if (cell?.kind === 'gem' && cell.color !== color) {
      cell.color = color;
      changed.push({ r, c });
    }
  }
  if (changed.length === 0) return null;
  return { t: 'transform', color, cells: changed };
}

/**
 * Resolves every special symbol eaten during a collection pass.
 *
 * Coins and wilds have already paid through `cellWin`, so what is left here is
 * the symbols whose value is an effect: upgrades, transforms, the key, the
 * scatters, and dynamite (which is only armed now and blows later).
 */
export function applyCollectedSpecials(
  state: GameState,
  cfg: GameConfig,
  results: CollectResult[],
): SpecialsOutcome {
  const events: GameEvent[] = [];
  const dynamite: Pos[] = [];
  let keyCollected = false;

  // In the Super bonus every Upgrade behaves like an Upgrade All.
  const upgradeIsGlobal = state.bonus.active && state.bonus.isSuper;

  for (const result of results) {
    for (const { pos, cell } of result.eaten) {
      switch (cell.kind) {
        case 'upgrade': {
          const steps = cell.upgradeSteps ?? 1;
          if (upgradeIsGlobal) {
            for (const color of GEM_COLORS) {
              const ev = upgradeColor(state, color, steps);
              if (ev) events.push(ev);
            }
          } else {
            const target = cell.upgradeColor ?? result.color ?? 'blue';
            const ev = upgradeColor(state, target, steps);
            if (ev) events.push(ev);
          }
          break;
        }

        case 'upgradeAll': {
          const steps = cell.upgradeSteps ?? 1;
          for (const color of GEM_COLORS) {
            const ev = upgradeColor(state, color, steps);
            if (ev) events.push(ev);
          }
          break;
        }

        case 'transform': {
          const color = result.color ?? 'red';
          const ev = transformAround(state, pos, color);
          if (ev) events.push(ev);
          break;
        }

        case 'dynamite':
          dynamite.push({ ...pos });
          break;

        case 'key':
          // The bandit does not get to free itself.
          if (!result.isBandit) keyCollected = true;
          break;

        case 'bonus':
          state.scatters++;
          if (state.bonus.active) {
            state.bonus.dropsRemaining += cfg.bonus.dropsPerRetrigger;
            state.bonus.dropsAwarded += cfg.bonus.dropsPerRetrigger;
            events.push({ t: 'bonusDropAwarded', drops: cfg.bonus.dropsPerRetrigger });
          }
          break;

        case 'superBonus':
          state.scatters++;
          state.superScatters++;
          if (state.bonus.active) {
            state.bonus.dropsRemaining += cfg.bonus.dropsPerRetrigger;
            state.bonus.dropsAwarded += cfg.bonus.dropsPerRetrigger;
            events.push({ t: 'bonusDropAwarded', drops: cfg.bonus.dropsPerRetrigger });
          }
          break;

        default:
          // gem / wild / wildBandit / coin / peanut need nothing more.
          break;
      }
    }
  }

  return { events, dynamite, keyCollected };
}

/**
 * Blows up a dynamite cell, clearing everything within the blast radius.
 * Collectors are never destroyed. The grid then grows a step.
 */
export function explodeDynamite(
  state: GameState,
  cfg: GameConfig,
  origin: Pos,
): { destroyed: Pos[] } {
  const destroyed: Pos[] = [];
  const radius = cfg.dynamite.blastRadius;

  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const r = origin.r + dr;
      const c = origin.c + dc;
      if (!inBounds(state, r, c)) continue;
      const cell = state.grid[r][c];
      if (!cell) continue;
      if (cell.kind === 'bird' || cell.kind === 'bandit') continue;
      state.grid[r][c] = null;
      destroyed.push({ r, c });
    }
  }

  return { destroyed };
}
