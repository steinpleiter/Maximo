import type { GameConfig } from '../config/gameConfig';
import { TOP_GEM_COLOR, gemValue } from '../config/paytable';
import { ORTHOGONAL, isCollector, samePos } from './grid';
import type { Rng } from './rng';
import type { Cell, GameState, GemColor, Pos } from './types';

export interface CollectResult {
  birdId: number;
  color: GemColor | null;
  isBandit: boolean;
  /** Cells the collector moved through, starting at its origin. */
  path: Pos[];
  eaten: { pos: Pos; cell: Cell; win: number }[];
  /** Total win from this walk, as a multiple of the bet. */
  win: number;
}

/** One candidate step for a walking collector. */
interface StepOption {
  dir: Pos;
  next: Pos;
  cell: Cell;
}

/** A collector will always pick up a special, whatever colour it is. */
function isSpecial(cell: Cell): boolean {
  return cell.kind !== 'gem' && !isCollector(cell);
}

/**
 * Can this collector eat the symbol in that cell?
 *
 * A bird takes gems of its own colour, wilds (which stand in for any gem), and
 * every special symbol. The bandit is colour-blind and takes any gem.
 */
export function canCollect(cell: Cell | null, color: GemColor | null, isBandit: boolean): boolean {
  if (!cell || isCollector(cell)) return false;
  if (isSpecial(cell)) return true;
  if (isBandit) return true;
  return cell.color === color;
}

/** What a single eaten symbol pays, as a multiple of the bet. */
export function cellWin(cell: Cell, state: GameState, color: GemColor | null): number {
  switch (cell.kind) {
    case 'gem':
      return gemValue(cell.color!, state.gemLevels[cell.color!]);
    case 'wild':
      // Stands in for the collector's own gem; the bandit scores it as the top gem.
      return color
        ? gemValue(color, state.gemLevels[color])
        : gemValue(TOP_GEM_COLOR, state.gemLevels[TOP_GEM_COLOR]);
    case 'wildBandit':
      return gemValue(TOP_GEM_COLOR, state.gemLevels[TOP_GEM_COLOR]);
    case 'coin':
      return cell.coinValue ?? 0;
    default:
      // Upgrades, dynamite, keys, scatters and peanuts pay nothing directly —
      // their value arrives through the effect they trigger.
      return 0;
  }
}

/**
 * Walks one collector as far as it can go from `start`.
 *
 * The collector steps into an adjacent collectable cell, eats it, and repeats.
 * It moves only horizontally or vertically, prefers to carry on in the
 * direction it was already heading, and will happily turn or double back to
 * pick up anything it left behind. Returns `null` if it had nothing to eat.
 */
export function collectFrom(
  state: GameState,
  rng: Rng,
  start: Pos,
  opts: { oneRunOnly?: boolean } = {},
): CollectResult | null {
  const collector = state.grid[start.r][start.c];
  if (!collector || !isCollector(collector)) return null;

  const isBandit = collector.kind === 'bandit';
  const color = collector.color ?? null;

  const path: Pos[] = [{ ...start }];
  const eaten: { pos: Pos; cell: Cell; win: number }[] = [];
  let win = 0;

  let pos: Pos = { ...start };
  let lastDir: Pos | null = null;
  /** For the bandit, the colour of the run it committed to. */
  let runColor: GemColor | null = null;

  const limit = state.cols * state.rows;
  for (let step = 0; step < limit; step++) {
    const options: StepOption[] = [];

    for (const dir of ORTHOGONAL) {
      const next = { r: pos.r + dir.r, c: pos.c + dir.c };
      if (next.r < 0 || next.r >= state.rows || next.c < 0 || next.c >= state.cols) continue;
      const cell = state.grid[next.r][next.c];
      if (!canCollect(cell, color, isBandit)) continue;

      // "One cluster at a time": once the bandit bites into a colour it must
      // stay on that colour (specials are always fair game).
      if (opts.oneRunOnly && cell!.kind === 'gem') {
        if (runColor && cell!.color !== runColor) continue;
      }

      options.push({ dir, next, cell: cell as Cell });
    }

    if (options.length === 0) break;

    // Carry straight on where possible, so the walk reads as a trail.
    const heading = lastDir;
    const straight: StepOption | undefined = heading
      ? options.find((o) => o.dir.r === heading.r && o.dir.c === heading.c)
      : undefined;
    const chosen: StepOption = straight ?? rng.pick(options);

    const value = cellWin(chosen.cell, state, color);
    win += value;
    eaten.push({ pos: { ...chosen.next }, cell: chosen.cell, win: value });

    if (opts.oneRunOnly && chosen.cell.kind === 'gem' && !runColor) {
      runColor = chosen.cell.color ?? null;
    }

    // Move the collector: it vacates its cell and occupies the one it ate.
    state.grid[pos.r][pos.c] = null;
    state.grid[chosen.next.r][chosen.next.c] = collector;

    pos = { ...chosen.next };
    path.push({ ...pos });
    lastDir = chosen.dir;
  }

  if (eaten.length === 0) return null;
  return { birdId: collector.id, color, isBandit, path, eaten, win };
}

/**
 * Runs every collector on the grid once, in a stable top-left to bottom-right
 * order so a round is reproducible.
 *
 * Pass `skipBandit` once the bandit has had its allotted steals — it eats any
 * colour, so left to itself it never runs out of food.
 */
export function runCollections(
  state: GameState,
  _cfg: GameConfig,
  rng: Rng,
  opts: { skipBandit?: boolean } = {},
): CollectResult[] {
  const results: CollectResult[] = [];

  // Snapshot the starting positions first: a walk moves its collector, and we
  // do not want to run the same bird twice because it drifted into cells we
  // had not scanned yet.
  const starts: { id: number; pos: Pos }[] = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.grid[r][c];
      if (isCollector(cell)) starts.push({ id: cell!.id, pos: { r, c } });
    }
  }

  for (const start of starts) {
    // The collector may already have been nudged by an earlier walk.
    const current = findCollectorById(state, start.id);
    if (!current) continue;
    const from = samePos(current, start.pos) ? start.pos : current;

    const isBandit = state.grid[from.r][from.c]?.kind === 'bandit';
    if (isBandit && opts.skipBandit) continue;

    const result = collectFrom(state, rng, from, { oneRunOnly: isBandit });
    if (result) results.push(result);
  }

  return results;
}

export function findCollectorById(state: GameState, id: number): Pos | null {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c]?.id === id) return { r, c };
    }
  }
  return null;
}
