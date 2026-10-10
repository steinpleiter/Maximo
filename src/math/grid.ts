import type { GameConfig } from '../config/gameConfig';
import { COIN_VALUES } from '../config/paytable';
import type { Rng } from './rng';
import {
  GEM_COLORS,
  type Cell,
  type CellSnapshot,
  type GameState,
  type GemColor,
  type Grid,
  type Pos,
  type SymbolKind,
} from './types';

export const ORTHOGONAL: readonly Pos[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

export const DIAGONAL: readonly Pos[] = [
  { r: -1, c: -1 },
  { r: -1, c: 1 },
  { r: 1, c: -1 },
  { r: 1, c: 1 },
];

export function makeGrid(cols: number, rows: number): Grid {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

export function inBounds(state: GameState, r: number, c: number): boolean {
  return r >= 0 && r < state.rows && c >= 0 && c < state.cols;
}

export function at(state: GameState, r: number, c: number): Cell | null {
  return inBounds(state, r, c) ? state.grid[r][c] : null;
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.r === b.r && a.c === b.c;
}

export function isCollector(cell: Cell | null): boolean {
  return !!cell && (cell.kind === 'bird' || cell.kind === 'bandit');
}

export function* cells(state: GameState): Generator<{ r: number; c: number; cell: Cell | null }> {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) yield { r, c, cell: state.grid[r][c] };
  }
}

export function findCells(state: GameState, pred: (cell: Cell) => boolean): Pos[] {
  const out: Pos[] = [];
  for (const { r, c, cell } of cells(state)) {
    if (cell && pred(cell)) out.push({ r, c });
  }
  return out;
}

export function findBirds(state: GameState): { pos: Pos; cell: Cell }[] {
  const out: { pos: Pos; cell: Cell }[] = [];
  for (const { r, c, cell } of cells(state)) {
    if (isCollector(cell)) out.push({ pos: { r, c }, cell: cell as Cell });
  }
  return out;
}

/** Ordinary symbols left on the grid — collectors perch, so they don't count. */
export function remainingSymbols(state: GameState): number {
  let count = 0;
  for (const { cell } of cells(state)) {
    if (cell && !isCollector(cell)) count++;
  }
  return count;
}

/**
 * True when the grid counts as swept. `threshold` leaves room for a couple of
 * stragglers — see `coinGame.clearThreshold` for why that matters.
 */
export function isGridCleared(state: GameState, threshold = 0): boolean {
  return remainingSymbols(state) <= threshold;
}

// ---------------------------------------------------------------------------
// Symbol creation
// ---------------------------------------------------------------------------

export function newCell(state: GameState, kind: SymbolKind, extra: Partial<Cell> = {}): Cell {
  return { id: state.nextId++, kind, ...extra };
}

export function newGem(state: GameState, color: GemColor): Cell {
  return newCell(state, 'gem', { color });
}

export function newCoin(state: GameState, rng: Rng): Cell {
  const value = rng.weighted(COIN_VALUES.map((v) => ({ item: v.value, weight: v.weight })));
  return newCell(state, 'coin', { coinValue: value });
}

/** Builds a special symbol, filling in whatever extra data its kind needs. */
export function newSpecial(state: GameState, rng: Rng, kind: SymbolKind): Cell {
  switch (kind) {
    case 'coin':
      return newCoin(state, rng);
    case 'upgrade':
      return newCell(state, 'upgrade', {
        upgradeSteps: rng.int(1, 3),
        upgradeColor: rng.pick(GEM_COLORS),
      });
    case 'upgradeAll':
      return newCell(state, 'upgradeAll', { upgradeSteps: rng.int(1, 3) });
    default:
      return newCell(state, kind);
  }
}

export function randomSpecialKind(cfg: GameConfig, rng: Rng): SymbolKind {
  const entries = Object.entries(cfg.weights.specials)
    .filter(([, w]) => (w ?? 0) > 0)
    .map(([kind, weight]) => ({ item: kind as SymbolKind, weight: weight as number }));
  return rng.weighted(entries);
}

export function randomGemColor(cfg: GameConfig, rng: Rng): GemColor {
  return rng.weighted(GEM_COLORS.map((color) => ({ item: color, weight: cfg.weights.gems[color] })));
}

/**
 * A symbol for a freshly refilled cell: usually a gem, occasionally a special.
 * Birds are placed separately by `spawnBirds` because where they land matters.
 */
export function randomFillCell(state: GameState, cfg: GameConfig, rng: Rng): Cell {
  if (rng.chance(cfg.weights.specialRate)) {
    return newSpecial(state, rng, randomSpecialKind(cfg, rng));
  }
  return newGem(state, randomGemColor(cfg, rng));
}

// ---------------------------------------------------------------------------
// Gravity and refill
// ---------------------------------------------------------------------------

/**
 * Drops symbols into the gaps below them, column by column.
 *
 * Collectors do not fall — they perch — and they block the column, so symbols
 * above a perched bird stack on top of it rather than sliding past.
 */
export function applyGravity(state: GameState): { from: Pos; to: Pos }[] {
  const moves: { from: Pos; to: Pos }[] = [];

  for (let c = 0; c < state.cols; c++) {
    let writeRow = state.rows - 1;
    for (let r = state.rows - 1; r >= 0; r--) {
      const cell = state.grid[r][c];
      if (!cell) continue;

      if (isCollector(cell)) {
        writeRow = r - 1;
        continue;
      }

      if (r !== writeRow) {
        state.grid[writeRow][c] = cell;
        state.grid[r][c] = null;
        moves.push({ from: { r, c }, to: { r: writeRow, c } });
      }
      writeRow--;
    }
  }

  return moves;
}

/** Fills every empty cell with a new symbol. */
export function refill(state: GameState, cfg: GameConfig, rng: Rng): CellSnapshot[] {
  const filled: CellSnapshot[] = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c] === null) {
        const cell = randomFillCell(state, cfg, rng);
        state.grid[r][c] = cell;
        filled.push({ r, c, cell });
      }
    }
  }
  return filled;
}

// ---------------------------------------------------------------------------
// Bird placement
// ---------------------------------------------------------------------------

export function birdColorsOnGrid(state: GameState): GemColor[] {
  const out: GemColor[] = [];
  for (const { cell } of cells(state)) {
    if (cell?.kind === 'bird' && cell.color) out.push(cell.color);
  }
  return out;
}

/**
 * Places a bird, pulled toward the collectors already on the grid by
 * `cfg.birds.clusterBias`. Clustering is what makes duels — and therefore quiz
 * questions — frequent, so this is a primary tuning knob.
 */
export function placeBird(state: GameState, cfg: GameConfig, rng: Rng, color: GemColor): Pos | null {
  const candidates: Pos[] = [];
  for (const { r, c, cell } of cells(state)) {
    if (!isCollector(cell)) candidates.push({ r, c });
  }
  if (candidates.length === 0) return null;

  const existing = findBirds(state).map((b) => b.pos);
  let target: Pos;

  if (existing.length === 0 || !rng.chance(cfg.birds.clusterBias)) {
    target = rng.pick(candidates);
  } else {
    // Weight each free cell by closeness to one of the existing collectors.
    const anchor = rng.pick(existing);
    const scored = candidates.map((pos) => {
      const dist = Math.abs(pos.r - anchor.r) + Math.abs(pos.c - anchor.c);
      return { item: pos, weight: 1 / (dist * dist + 0.5) };
    });
    target = rng.weighted(scored);
  }

  state.grid[target.r][target.c] = newCell(state, 'bird', { color });
  return target;
}

/** Ensures the always-present bird exists, then rolls for the others. */
export function spawnBirds(state: GameState, cfg: GameConfig, rng: Rng, forceAll = false): Pos[] {
  const placed: Pos[] = [];
  const present = new Set(birdColorsOnGrid(state));

  if (!present.has(cfg.birds.always)) {
    const pos = placeBird(state, cfg, rng, cfg.birds.always);
    if (pos) placed.push(pos);
  }

  for (const color of GEM_COLORS) {
    if (color === cfg.birds.always || present.has(color)) continue;
    if (forceAll || rng.chance(cfg.weights.birdRate)) {
      const pos = placeBird(state, cfg, rng, color);
      if (pos) placed.push(pos);
    }
  }

  return placed;
}

// ---------------------------------------------------------------------------
// Grid growth
// ---------------------------------------------------------------------------

/**
 * Grows the grid one step toward the maximum: a row first, then a column,
 * matching the published "up to 8 rows by 7 columns". New cells start empty
 * and are filled by the next refill. Returns true if the grid actually grew.
 */
export function expandGrid(state: GameState, cfg: GameConfig): boolean {
  const canRow = state.rows < cfg.grid.maxRows;
  const canCol = state.cols < cfg.grid.maxCols;
  if (!canRow && !canCol) return false;

  if (canRow) {
    state.grid.unshift(Array.from({ length: state.cols }, () => null));
    state.rows++;
    // Every recorded position shifts down with the new top row.
    state.trainCells = state.trainCells.map((p) => ({ r: p.r + 1, c: p.c }));
  } else {
    for (const row of state.grid) row.push(null);
    state.cols++;
  }

  return true;
}

/** Grows an existing state up to the given size without touching contents. */
export function resizeTo(state: GameState, cols: number, rows: number): void {
  while (state.rows < rows) {
    state.grid.unshift(Array.from({ length: state.cols }, () => null));
    state.rows++;
    state.trainCells = state.trainCells.map((p) => ({ r: p.r + 1, c: p.c }));
  }
  while (state.cols < cols) {
    for (const row of state.grid) row.push(null);
    state.cols++;
  }
}

export function snapshot(state: GameState): CellSnapshot[] {
  const out: CellSnapshot[] = [];
  for (const { r, c, cell } of cells(state)) out.push({ r, c, cell });
  return out;
}
