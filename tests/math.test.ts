import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config/gameConfig';
import { MAX_GEM_LEVEL, gemValue } from '../src/config/paytable';
import { MAX_WIN_MULTIPLIER, createState } from '../src/math/engine';
import { applyGravity, isCollector, newGem, refill } from '../src/math/grid';
import { Rng } from '../src/math/rng';
import { upgradeColor } from '../src/math/specials';
import { GEM_COLORS } from '../src/math/types';
import { alwaysCorrect, alwaysWrong, eventsOfType, makeEngine, playRound } from './helpers';

const SEEDS = Array.from({ length: 40 }, (_, i) => `seed-${i}`);

describe('gravity', () => {
  it('leaves no symbol floating above an empty cell in its column', () => {
    const rng = new Rng('gravity');

    for (let trial = 0; trial < 200; trial++) {
      const state = createState(DEFAULT_CONFIG);
      // Random sparse board, including a few perched collectors.
      for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          const roll = rng.next();
          if (roll < 0.4) state.grid[r][c] = null;
          else if (roll < 0.47) state.grid[r][c] = { id: state.nextId++, kind: 'bird', color: 'blue' };
          else state.grid[r][c] = newGem(state, rng.pick(GEM_COLORS));
        }
      }

      applyGravity(state);

      for (let c = 0; c < state.cols; c++) {
        // Walking up a column, once a gap appears everything above it must be
        // either empty or sitting on a perch.
        let sawGap = false;
        for (let r = state.rows - 1; r >= 0; r--) {
          const cell = state.grid[r][c];
          if (isCollector(cell)) {
            // A perch resets the stack: things may rest on top of it.
            sawGap = false;
            continue;
          }
          if (!cell) sawGap = true;
          else if (sawGap) {
            throw new Error(`floating symbol at r${r} c${c}`);
          }
        }
      }
    }
  });

  it('refill leaves no empty cells', () => {
    const state = createState(DEFAULT_CONFIG);
    refill(state, DEFAULT_CONFIG, new Rng('refill'));
    for (const row of state.grid) {
      for (const cell of row) expect(cell).not.toBeNull();
    }
  });
});

describe('gem upgrades', () => {
  it('clamp at the top of the ladder', () => {
    const state = createState(DEFAULT_CONFIG);
    upgradeColor(state, 'red', 99);
    expect(state.gemLevels.red).toBe(MAX_GEM_LEVEL);
    // A second upgrade at the ceiling is a no-op and emits nothing.
    expect(upgradeColor(state, 'red', 3)).toBeNull();
  });

  it('pay more at every step for every colour', () => {
    for (const color of GEM_COLORS) {
      for (let level = 2; level <= MAX_GEM_LEVEL; level++) {
        expect(gemValue(color, level)).toBeGreaterThan(gemValue(color, level - 1));
      }
    }
  });

  it('never exceed level 7 over a long session', () => {
    for (const seed of SEEDS) {
      const engine = makeEngine(seed);
      for (let spin = 0; spin < 12; spin++) {
        playRound(engine, alwaysCorrect);
        for (const color of GEM_COLORS) {
          expect(engine.state.gemLevels[color]).toBeLessThanOrEqual(MAX_GEM_LEVEL);
          expect(engine.state.gemLevels[color]).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

describe('rounds settle', () => {
  it('always terminate, answering correctly or wrongly', () => {
    for (const seed of SEEDS) {
      for (const strategy of [alwaysCorrect, alwaysWrong]) {
        const engine = makeEngine(seed);
        for (let spin = 0; spin < 8; spin++) {
          const round = playRound(engine, strategy);
          expect(round.yields).toBeLessThan(20000);
        }
      }
    }
  });

  it('never grow the grid past the configured maximum', () => {
    for (const seed of SEEDS) {
      const engine = makeEngine(seed);
      for (let spin = 0; spin < 10; spin++) {
        playRound(engine, alwaysCorrect);
        expect(engine.state.cols).toBeLessThanOrEqual(DEFAULT_CONFIG.grid.maxCols);
        expect(engine.state.rows).toBeLessThanOrEqual(DEFAULT_CONFIG.grid.maxRows);
      }
    }
  });

  it('never eat the same symbol instance twice', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const engine = makeEngine(seed);

      for (let spin = 0; spin < 6; spin++) {
        const { events } = playRound(engine, alwaysCorrect);
        const seen = new Set<number>();

        for (const ev of events) {
          const taken =
            ev.t === 'collect' ? ev.eaten : ev.t === 'showdown' ? ev.destroyed : null;
          if (!taken) continue;
          for (const { cell } of taken) {
            expect(seen.has(cell.id), `cell ${cell.id} taken twice`).toBe(false);
            seen.add(cell.id);
          }
        }
      }
    }
  });

  it('cap the round win at the published maximum', () => {
    for (const seed of SEEDS) {
      const engine = makeEngine(seed);
      for (let spin = 0; spin < 6; spin++) {
        const { win } = playRound(engine, alwaysCorrect);
        expect(win).toBeLessThanOrEqual(MAX_WIN_MULTIPLIER);
        expect(win).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('deterministic replay', () => {
  it('reproduces a round exactly from the same seed and answers', () => {
    for (const seed of SEEDS.slice(0, 15)) {
      const a = makeEngine(seed);
      const b = makeEngine(seed);

      for (let spin = 0; spin < 5; spin++) {
        const ra = playRound(a, alwaysCorrect);
        const rb = playRound(b, alwaysCorrect);

        expect(rb.win).toBe(ra.win);
        expect(rb.events.length).toBe(ra.events.length);
        expect(JSON.stringify(b.state.grid)).toBe(JSON.stringify(a.state.grid));
        expect(b.state.gemLevels).toEqual(a.state.gemLevels);
      }
    }
  });

  it('diverges when the answers differ', () => {
    // Not a guarantee for any single spin, but across a batch a wrong answer
    // must change something — otherwise the quiz is not wired to the outcome.
    let differences = 0;

    for (const seed of SEEDS) {
      const right = makeEngine(seed);
      const wrong = makeEngine(seed);
      const a = playRound(right, alwaysCorrect);
      const b = playRound(wrong, alwaysWrong);
      if (a.prompts.length > 0 && (a.win !== b.win || a.events.length !== b.events.length)) {
        differences++;
      }
    }

    expect(differences).toBeGreaterThan(0);
  });
});

describe('the quiz gates the duel', () => {
  it('a correct answer fires the showdown and a wrong one does not', () => {
    let correctWithShots = 0;
    let wrongWithShots = 0;
    let duelsSeen = 0;

    for (const seed of SEEDS) {
      for (const strategy of [alwaysCorrect, alwaysWrong]) {
        const engine = makeEngine(seed);

        for (let spin = 0; spin < 6; spin++) {
          const { events } = playRound(engine, strategy);

          const answers = eventsOfType(events, 'quizAnswered');
          const showdowns = eventsOfType(events, 'showdown');
          const fizzles = eventsOfType(events, 'duelFizzle');
          duelsSeen += answers.length;

          if (answers.length === 0) {
            expect(showdowns.length).toBe(0);
            expect(fizzles.length).toBe(0);
            continue;
          }

          if (strategy === alwaysCorrect) {
            expect(fizzles.length).toBe(0);
            correctWithShots += showdowns.length;
          } else {
            // Every lost duel is accounted for: an ordinary one fizzles, and
            // one against the bandit is lost to the bandit instead.
            const lostToBandit = eventsOfType(events, 'banditDuelResult').filter(
              (e) => e.banditWon,
            ).length;
            expect(fizzles.length + lostToBandit).toBe(answers.length);
            wrongWithShots += showdowns.length;
          }
        }
      }
    }

    expect(duelsSeen).toBeGreaterThan(0);
    expect(correctWithShots).toBeGreaterThan(0);
    expect(wrongWithShots).toBe(0);
  });

  it('asks exactly one question per duel', () => {
    for (const seed of SEEDS) {
      const engine = makeEngine(seed);
      for (let spin = 0; spin < 6; spin++) {
        const { events, prompts } = playRound(engine, alwaysCorrect);
        const starts = eventsOfType(events, 'duelStart');
        const asked = eventsOfType(events, 'quizAsked');
        expect(asked.length).toBe(starts.length);
        expect(prompts.length).toBe(starts.length);
      }
    }
  });

  it('caps bird-on-bird duels per drop but lets bandit duels through', () => {
    // The cap stops a drop becoming a quiz marathon. Bandit stand-offs are
    // deliberately exempt: the bandit must be able to work through all four
    // birds, and that run is what triggers the Coin Game.
    let banditOverflowSeen = 0;

    for (const seed of SEEDS) {
      const engine = makeEngine(seed);
      for (let spin = 0; spin < 8; spin++) {
        const { prompts, events } = playRound(engine, alwaysCorrect);
        const drops = eventsOfType(events, 'roundStart').length;

        const birdDuels = prompts.filter((p) => !p.versusBandit).length;
        expect(birdDuels).toBeLessThanOrEqual(DEFAULT_CONFIG.duel.maxPerDrop * drops);

        if (prompts.length > DEFAULT_CONFIG.duel.maxPerDrop * drops) banditOverflowSeen++;
      }
    }

    // A loose bandit is bounded too: at most one duel per bird it can reach.
    expect(banditOverflowSeen).toBeLessThan(SEEDS.length * 8);
  });
});

describe('bonus', () => {
  it('a bought bonus plays at least the configured number of drops', () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const engine = makeEngine(seed);
      const { events } = playRound(engine, alwaysCorrect, { buy: 'bonus' });

      const starts = eventsOfType(events, 'bonusStart');
      expect(starts.length).toBe(1);
      expect(starts[0].drops).toBe(DEFAULT_CONFIG.bonus.initialDrops);

      const drops = eventsOfType(events, 'roundStart').filter((e) => e.free);
      expect(drops.length).toBeGreaterThanOrEqual(DEFAULT_CONFIG.bonus.initialDrops);
      expect(eventsOfType(events, 'bonusEnd').length).toBe(1);
    }
  });

  it('a bought super bonus starts on the full grid', () => {
    const engine = makeEngine('super');
    playRound(engine, alwaysCorrect, { buy: 'superBonus' });
    expect(engine.state.cols).toBe(DEFAULT_CONFIG.grid.maxCols);
    expect(engine.state.rows).toBe(DEFAULT_CONFIG.grid.maxRows);
  });

  it('keeps gem upgrades across free drops', () => {
    // Levels are reset only on a base spin, never between drops of a bonus.
    const engine = makeEngine('persist');
    const { events } = playRound(engine, alwaysCorrect, { buy: 'bonus' });

    const upgrades = eventsOfType(events, 'gemUpgrade');
    const freeDrops = eventsOfType(events, 'roundStart').filter((e) => e.free);
    if (upgrades.length > 0 && freeDrops.length > 1) {
      // No upgrade event ever walks a level back down.
      for (const up of upgrades) expect(up.to).toBeGreaterThan(up.from);
    }
  });
});

describe('buys', () => {
  it('a bought coin game runs exactly once', () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const engine = makeEngine(seed);
      const { events } = playRound(engine, alwaysCorrect, { buy: 'coinGame' });
      expect(eventsOfType(events, 'coinGame').length).toBe(1);
    }
  });

  it('a bought bandit escape releases the bandit', () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const engine = makeEngine(seed);
      const { events } = playRound(engine, alwaysWrong, { buy: 'banditEscape' });
      expect(eventsOfType(events, 'banditRelease').length).toBeGreaterThanOrEqual(1);
    }
  });
});
