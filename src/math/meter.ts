import type { GameConfig } from '../config/gameConfig';
import type { CollectResult } from './collect';
import { findCells, newSpecial, randomSpecialKind } from './grid';
import type { Rng } from './rng';
import type { CellSnapshot, GameEvent, GameState } from './types';

/**
 * Gems and wilds fill the collection meter as they are eaten. Anything the
 * bandit takes is stolen rather than collected, so it does not count.
 */
export function fillMeter(
  state: GameState,
  cfg: GameConfig,
  results: CollectResult[],
): GameEvent[] {
  let added = 0;
  for (const result of results) {
    if (result.isBandit) continue;
    for (const { cell } of result.eaten) {
      if (cell.kind === 'gem' || cell.kind === 'wild' || cell.kind === 'wildBandit') added++;
    }
  }
  if (added === 0) return [];

  const events: GameEvent[] = [];
  state.meter += added;

  while (state.meter >= cfg.meter.size && state.pendingReleases < cfg.meter.maxStackedReleases) {
    state.meter -= cfg.meter.size;
    state.pendingReleases++;
  }
  // A meter that is full with all releases already banked simply stays full.
  if (state.pendingReleases >= cfg.meter.maxStackedReleases) {
    state.meter = Math.min(state.meter, cfg.meter.size);
  }

  events.push({ t: 'meter', value: state.meter, size: cfg.meter.size });
  return events;
}

/**
 * Cashes in one banked release: a handful of gems on the grid turn into random
 * special symbols. Fires once collections have dried up.
 */
export function releaseFeatures(state: GameState, cfg: GameConfig, rng: Rng): GameEvent | null {
  if (state.pendingReleases <= 0) return null;
  state.pendingReleases--;

  const gemPositions = findCells(state, (cell) => cell.kind === 'gem');
  if (gemPositions.length === 0) return null;

  const count = Math.min(rng.range(cfg.meter.symbolsPerRelease), gemPositions.length);
  const chosen = rng.shuffle([...gemPositions]).slice(0, count);

  const cells: CellSnapshot[] = [];
  for (const pos of chosen) {
    const cell = newSpecial(state, rng, randomSpecialKind(cfg, rng));
    state.grid[pos.r][pos.c] = cell;
    cells.push({ r: pos.r, c: pos.c, cell });
  }

  return { t: 'meterRelease', cells };
}
