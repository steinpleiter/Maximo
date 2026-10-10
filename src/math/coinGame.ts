import type { GameConfig } from '../config/gameConfig';
import { COIN_VALUES } from '../config/paytable';
import { birdColorsOnGrid } from './grid';
import type { Rng } from './rng';
import type { GameEvent, GameState, GemColor, Pos } from './types';

type Pick = { pos: Pos; kind: 'coin' | 'scorpion'; value: number; by: GemColor | null };

/**
 * The Coin Game, which fires when the grid has been swept completely clear.
 *
 * Coin bags and scorpions scatter across the empty grid and the collectors
 * take turns throwing a lasso. A missed throw snags a scorpion and that
 * collector is out; play continues until the bags are gone or nobody is left
 * to throw.
 */
export function runCoinGame(state: GameState, cfg: GameConfig, rng: Rng): { event: GameEvent; win: number } {
  const bagCount = rng.range(cfg.coinGame.coinBags);
  const scorpionCount = rng.range(cfg.coinGame.scorpions);

  // Lay the board out on the free cells.
  const free: Pos[] = [];
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.grid[r][c];
      if (!cell) free.push({ r, c });
    }
  }
  rng.shuffle(free);

  const bags: { pos: Pos; value: number }[] = [];
  for (const pos of free.splice(0, bagCount)) {
    bags.push({
      pos,
      value: rng.weighted(COIN_VALUES.map((v) => ({ item: v.value, weight: v.weight }))),
    });
  }
  const scorpions: Pos[] = free.splice(0, scorpionCount);

  // Who throws: every bird on the grid, plus the bandit if it is loose.
  const throwers: (GemColor | null)[] = [...birdColorsOnGrid(state)];
  if (state.bandit.released) throwers.push(null);
  if (throwers.length === 0) throwers.push(null);

  const picks: Pick[] = [];
  let win = 0;
  const out = new Set<number>();
  let turn = 0;
  const maxThrows = (bags.length + scorpions.length) * 4 + 8;

  for (let i = 0; i < maxThrows && bags.length > 0; i++) {
    if (out.size >= throwers.length) break;

    // Next thrower still in the game.
    let thrower = turn % throwers.length;
    let guard = 0;
    while (out.has(thrower) && guard++ < throwers.length) {
      turn++;
      thrower = turn % throwers.length;
    }
    turn++;
    if (out.has(thrower)) break;

    const by = throwers[thrower];

    if (rng.chance(cfg.coinGame.lassoAccuracy)) {
      const bag = bags.splice(rng.int(0, bags.length - 1), 1)[0];
      win += bag.value;
      picks.push({ pos: bag.pos, kind: 'coin', value: bag.value, by });
    } else if (scorpions.length > 0) {
      const pos = scorpions.splice(rng.int(0, scorpions.length - 1), 1)[0];
      picks.push({ pos, kind: 'scorpion', value: 0, by });
      out.add(thrower);
    } else {
      // Nothing left to sting them with, so a miss simply costs the turn.
      continue;
    }
  }

  return { event: { t: 'coinGame', picks, win }, win };
}
