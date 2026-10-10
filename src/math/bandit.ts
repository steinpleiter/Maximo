import { GEM_COLORS, type GameEvent, type GameState, type GemColor, type Pos } from './types';
import { isCollector, newCell } from './grid';
import type { Rng } from './rng';
import type { Duelist } from './duel';

/**
 * Lets the bandit out of its cage onto the grid. It lands on an ordinary cell,
 * displacing whatever symbol was there.
 */
export function releaseBandit(state: GameState, rng: Rng): GameEvent | null {
  if (state.bandit.released) return null;

  const candidates: Pos[] = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (!isCollector(state.grid[r][c])) candidates.push({ r, c });
    }
  }
  if (candidates.length === 0) return null;

  const pos = rng.pick(candidates);
  const cell = newCell(state, 'bandit');
  state.grid[pos.r][pos.c] = cell;
  state.bandit.released = true;
  state.bandit.carried = 0;
  state.bandit.birdsBeaten = 0;
  state.bandit.beaten = { blue: false, green: false, purple: false, red: false };

  return { t: 'banditRelease', pos, cell };
}

export function banditOnGrid(state: GameState): Pos | null {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c]?.kind === 'bandit') return { r, c };
    }
  }
  return null;
}

/** Sends the bandit back to its cage, keeping nothing. */
export function cageBandit(state: GameState): void {
  const pos = banditOnGrid(state);
  if (pos) state.grid[pos.r][pos.c] = null;
  state.bandit.released = false;
  state.bandit.carried = 0;
}

/**
 * Walks the bandit one cell toward the nearest bird. It is hunting a duel, and
 * closing the distance is what brings the stand-off — and its quiz question —
 * about rather than letting it strip the grid indefinitely.
 */
export function huntNearestBird(state: GameState): GameEvent | null {
  const from = banditOnGrid(state);
  if (!from) return null;

  let target: Pos | null = null;
  let best = Infinity;

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r][c]?.kind !== 'bird') continue;
      const dist = Math.abs(r - from.r) + Math.abs(c - from.c);
      if (dist < best) {
        best = dist;
        target = { r, c };
      }
    }
  }

  if (!target || best <= 1) return null;

  // One orthogonal step, whichever axis has further to travel.
  const dr = Math.sign(target.r - from.r);
  const dc = Math.sign(target.c - from.c);
  const step =
    Math.abs(target.r - from.r) >= Math.abs(target.c - from.c)
      ? { r: from.r + dr, c: from.c }
      : { r: from.r, c: from.c + dc };

  if (isCollector(state.grid[step.r][step.c])) return null;

  const bandit = state.grid[from.r][from.c];
  state.grid[from.r][from.c] = state.grid[step.r][step.c];
  state.grid[step.r][step.c] = bandit;

  return { t: 'collectorMove', moves: [{ from, to: step }] };
}

export interface BanditDuelOutcome {
  events: GameEvent[];
  /** Paid to the player when a bird wins and takes back the loot. */
  payout: number;
  /** The bandit has beaten all four birds, so the Coin Game is owed. */
  triggersCoinGame: boolean;
}

/**
 * Settles a stand-off between the bandit and one bird.
 *
 * The quiz decides it: answer correctly and the bird wins, claiming everything
 * the bandit has stolen so far. Answer wrong and the bandit wins, knocking
 * that bird off the grid — and if it beats all four, the Coin Game begins.
 */
export function resolveBanditDuel(
  state: GameState,
  bird: Duelist,
  birdWon: boolean,
): BanditDuelOutcome {
  const events: GameEvent[] = [];
  let payout = 0;
  let triggersCoinGame = false;

  if (birdWon) {
    payout = state.bandit.carried;
    events.push({
      t: 'banditDuelResult',
      birdId: bird.id,
      birdColor: bird.color,
      banditWon: false,
      payout,
    });
    cageBandit(state);
  } else {
    if (bird.color && !state.bandit.beaten[bird.color]) {
      state.bandit.beaten[bird.color] = true;
      state.bandit.birdsBeaten++;
    }

    // The beaten bird is knocked off the grid for the rest of the round.
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (state.grid[r][c]?.id === bird.id) state.grid[r][c] = null;
      }
    }

    events.push({
      t: 'banditDuelResult',
      birdId: bird.id,
      birdColor: bird.color,
      banditWon: true,
      payout: 0,
    });

    triggersCoinGame = GEM_COLORS.every((color: GemColor) => state.bandit.beaten[color]);
  }

  return { events, payout, triggersCoinGame };
}
