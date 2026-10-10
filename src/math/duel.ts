import type { GameConfig } from '../config/gameConfig';
import type { CollectResult } from './collect';
import { cellWin } from './collect';
import { DIAGONAL, ORTHOGONAL, inBounds, isCollector } from './grid';
import type { Rng } from './rng';
import type { Cell, GameEvent, GameState, GemColor, Pos } from './types';

export interface Duelist {
  id: number;
  color: GemColor | null;
  pos: Pos;
  isBandit: boolean;
}

/**
 * Groups of collectors that are touching, found by flood fill over orthogonal
 * adjacency. Only groups of two or more are returned — a lone bird has nobody
 * to square up to.
 */
export function findDuelGroups(state: GameState): Duelist[][] {
  const seen = new Set<string>();
  const groups: Duelist[][] = [];

  const key = (r: number, c: number) => `${r},${c}`;

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (!isCollector(state.grid[r][c]) || seen.has(key(r, c))) continue;

      const group: Duelist[] = [];
      const stack: Pos[] = [{ r, c }];
      seen.add(key(r, c));

      while (stack.length > 0) {
        const pos = stack.pop() as Pos;
        const cell = state.grid[pos.r][pos.c] as Cell;
        group.push({
          id: cell.id,
          color: cell.color ?? null,
          pos,
          isBandit: cell.kind === 'bandit',
        });

        for (const dir of ORTHOGONAL) {
          const nr = pos.r + dir.r;
          const nc = pos.c + dir.c;
          if (!inBounds(state, nr, nc)) continue;
          if (!isCollector(state.grid[nr][nc]) || seen.has(key(nr, nc))) continue;
          seen.add(key(nr, nc));
          stack.push({ r: nr, c: nc });
        }
      }

      if (group.length >= 2) groups.push(group);
    }
  }

  return groups;
}

/**
 * Two collectors touching is a coin toss weighted by config; three or more is
 * a certainty. Raising `chanceTwoAdjacent` is the most direct way to put more
 * quiz questions in front of the player.
 */
export function shouldDuel(group: Duelist[], cfg: GameConfig, rng: Rng): boolean {
  if (group.length >= 3 && cfg.duel.alwaysAtThreeAdjacent) return true;
  return rng.chance(cfg.duel.chanceTwoAdjacent);
}

/** Bigger stand-offs ask harder questions. */
export function duelDifficulty(group: Duelist[], cfg: GameConfig): number | undefined {
  if (!cfg.quiz.scaleDifficultyWithDuelSize) return undefined;
  if (group.length >= 4) return 3;
  if (group.length === 3) return 2;
  return 1;
}

export interface ShowdownOutcome {
  event: GameEvent;
  /**
   * Synthetic collection results, so the engine can run everything the shots
   * hit through the same specials pipeline a normal collection uses — which is
   * what lets a shot ignite dynamite or bank an upgrade.
   */
  results: CollectResult[];
  win: number;
}

/**
 * The full showdown: every collector in the group fires along its rows,
 * columns and (by default) diagonals out to the configured radius, clearing
 * what it hits.
 *
 * Shots pass over other collectors rather than stopping on them, so a tight
 * group still sweeps the board.
 */
export function resolveShowdown(
  state: GameState,
  cfg: GameConfig,
  group: Duelist[],
): ShowdownOutcome {
  const directions = cfg.duel.includeDiagonals ? [...ORTHOGONAL, ...DIAGONAL] : [...ORTHOGONAL];

  const shots: { from: Pos; dir: Pos; cells: Pos[] }[] = [];
  const destroyed: { pos: Pos; cell: Cell; win: number }[] = [];
  const results: CollectResult[] = [];
  // A cell can sit in two shooters' lines; it may only be destroyed once.
  const claimed = new Set<string>();
  let win = 0;

  for (const duelist of group) {
    const radius = duelist.isBandit ? cfg.duel.banditShotRadius : cfg.duel.shotRadius;
    const eaten: { pos: Pos; cell: Cell; win: number }[] = [];

    for (const dir of directions) {
      const lane: Pos[] = [];

      for (let step = 1; step <= radius; step++) {
        const r = duelist.pos.r + dir.r * step;
        const c = duelist.pos.c + dir.c * step;
        if (!inBounds(state, r, c)) break;

        lane.push({ r, c });

        const cell = state.grid[r][c];
        if (!cell || isCollector(cell)) continue;

        const key = `${r},${c}`;
        if (claimed.has(key)) continue;
        claimed.add(key);

        const isGem = cell.kind === 'gem';
        const value = !isGem || cfg.duel.shotsPayGems ? cellWin(cell, state, duelist.color) : 0;

        win += value;
        const hit = { pos: { r, c }, cell, win: value };
        destroyed.push(hit);
        eaten.push(hit);
        state.grid[r][c] = null;
      }

      if (lane.length > 0) shots.push({ from: { ...duelist.pos }, dir, cells: lane });
    }

    if (eaten.length > 0) {
      results.push({
        birdId: duelist.id,
        color: duelist.color,
        isBandit: duelist.isBandit,
        path: [{ ...duelist.pos }],
        eaten,
        win: eaten.reduce((sum, e) => sum + e.win, 0),
      });
    }
  }

  return { event: { t: 'showdown', shots, destroyed, win }, results, win };
}

/**
 * Breaks a group up by walking every collector but the first to a cell that
 * touches no other collector. Called after any duel — won or lost — so the
 * same stand-off cannot ask a second question on the next pass.
 */
export function separateCollectors(
  state: GameState,
  rng: Rng,
  group: Duelist[],
): GameEvent | null {
  const moves: { from: Pos; to: Pos }[] = [];

  for (const duelist of group.slice(1)) {
    const from = locate(state, duelist.id);
    if (!from) continue;

    const candidates: Pos[] = [];
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (isCollector(state.grid[r][c])) continue;
        if (touchesCollector(state, r, c, duelist.id)) continue;
        candidates.push({ r, c });
      }
    }
    if (candidates.length === 0) continue;

    const to = rng.pick(candidates);
    // Swap: the collector takes the new cell, whatever was there goes back.
    const collector = state.grid[from.r][from.c];
    state.grid[from.r][from.c] = state.grid[to.r][to.c];
    state.grid[to.r][to.c] = collector;
    moves.push({ from, to });
  }

  if (moves.length === 0) return null;
  return { t: 'collectorMove', moves };
}

/**
 * Switcheroo: with collections dried up, two touching collectors trade places
 * in the hope of opening something new. It can also create a fresh adjacency,
 * which makes it a secondary source of duels.
 */
export function switcheroo(state: GameState, rng: Rng): GameEvent | null {
  const collectors: Pos[] = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (isCollector(state.grid[r][c])) collectors.push({ r, c });
    }
  }
  if (collectors.length < 1) return null;

  const from = rng.pick(collectors);
  const dirs = rng.shuffle([...ORTHOGONAL]);
  for (const dir of dirs) {
    const r = from.r + dir.r;
    const c = from.c + dir.c;
    if (!inBounds(state, r, c)) continue;
    if (isCollector(state.grid[r][c])) continue;

    const a = state.grid[from.r][from.c];
    state.grid[from.r][from.c] = state.grid[r][c];
    state.grid[r][c] = a;
    return { t: 'switcheroo', a: from, b: { r, c } };
  }

  return null;
}

function locate(state: GameState, id: number): Pos | null {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c]?.id === id) return { r, c };
    }
  }
  return null;
}

function touchesCollector(state: GameState, r: number, c: number, ignoreId: number): boolean {
  for (const dir of ORTHOGONAL) {
    const nr = r + dir.r;
    const nc = c + dir.c;
    if (!inBounds(state, nr, nc)) continue;
    const cell = state.grid[nr][nc];
    if (isCollector(cell) && cell!.id !== ignoreId) return true;
  }
  return false;
}
