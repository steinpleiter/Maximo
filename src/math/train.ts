import type { GameConfig } from '../config/gameConfig';
import type { CollectResult } from './collect';
import { findCells, newSpecial, randomSpecialKind } from './grid';
import type { Rng } from './rng';
import type { CellSnapshot, GameEvent, GameState, Pos } from './types';

/**
 * Stamps the train backdrop onto cells at the far left and far right of the
 * grid for this round. A bird that eats a marked symbol on *both* sides has
 * robbed the train and gets to ride it.
 */
export function markTrainCells(state: GameState, cfg: GameConfig, rng: Rng): void {
  const marked: Pos[] = [];
  const rows = Array.from({ length: state.rows }, (_, r) => r);

  for (const col of [0, state.cols - 1]) {
    const picks = rng.shuffle([...rows]).slice(0, cfg.train.markedPerSide);
    for (const r of picks) marked.push({ r, c: col });
  }

  state.trainCells = marked;
  state.trainProgress = {};
}

function isMarked(state: GameState, pos: Pos): boolean {
  return state.trainCells.some((t) => t.r === pos.r && t.c === pos.c);
}

/**
 * Credits this pass's collections against each bird's heist progress and
 * returns the id of a bird that has now robbed both edges, or `null`.
 *
 * Progress accumulates across the cascades of a drop: requiring both edges in
 * one unbroken walk would make the heist almost unreachable on a 6-wide grid.
 */
export function checkTrainHeist(state: GameState, results: CollectResult[]): number | null {
  for (const result of results) {
    if (result.isBandit) continue;

    for (const { pos } of result.eaten) {
      if (!isMarked(state, pos)) continue;
      const progress = (state.trainProgress[result.birdId] ??= { left: false, right: false });
      if (pos.c === 0) progress.left = true;
      if (pos.c === state.cols - 1) progress.right = true;
    }
  }

  for (const [id, progress] of Object.entries(state.trainProgress)) {
    if (progress.left && progress.right) return Number(id);
  }
  return null;
}

/**
 * The heist itself: the bird rides for a few laps and comes back with a
 * handful of feature symbols, dropped onto gems already on the grid.
 */
export function runTrainHeist(
  state: GameState,
  cfg: GameConfig,
  rng: Rng,
  birdId: number,
): GameEvent {
  const laps = rng.range(cfg.train.laps);
  const count = rng.range(cfg.train.featuresAwarded);

  const gemPositions = rng.shuffle(findCells(state, (cell) => cell.kind === 'gem'));
  const awarded: CellSnapshot[] = [];

  for (const pos of gemPositions.slice(0, count)) {
    const cell = newSpecial(state, rng, randomSpecialKind(cfg, rng));
    state.grid[pos.r][pos.c] = cell;
    awarded.push({ r: pos.r, c: pos.c, cell });
  }

  // The train is robbed once per drop.
  state.trainCells = [];
  state.trainProgress = {};

  return { t: 'trainHeist', birdId, laps, awarded };
}
