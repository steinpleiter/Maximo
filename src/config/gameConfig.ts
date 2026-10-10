import type { GemColor, SymbolKind } from '../math/types';

/**
 * THE tuning file.
 *
 * Every probability, rate and limit in the game lives here. The math model is
 * tuned by feel rather than against an RTP target, so expect to come back and
 * push these numbers around after playing.
 */
export interface GameConfig {
  grid: {
    baseCols: number;
    baseRows: number;
    maxCols: number;
    maxRows: number;
  };

  /** Relative weights for what lands in an empty cell. */
  weights: {
    gems: Record<GemColor, number>;
    /** Chance (0..1) that a refilled cell is a special rather than a gem. */
    specialRate: number;
    specials: Partial<Record<SymbolKind, number>>;
    /** Chance (0..1) that a refilled cell is a bird, if that bird is missing. */
    birdRate: number;
  };

  birds: {
    /** This bird is always on the grid. */
    always: GemColor;
    /**
     * How strongly new birds are pulled toward the existing ones when they
     * land. 0 = uniform placement, 1 = always as close as possible. Raising
     * this makes duels — and therefore quizzes — more frequent.
     */
    clusterBias: number;
  };

  bandit: {
    /**
     * Clusters the bandit may steal in a single drop.
     *
     * This is a real limit, not just a safety valve: the bandit is colour-blind
     * and will eat anything, so an unbounded bandit never runs out of food and
     * the cascade never ends.
     */
    maxStealsPerDrop: number;
    /** After each steal it steps toward the nearest bird, hunting a duel. */
    hunts: boolean;
  };

  duel: {
    /** Chance of a duel when exactly two birds end up adjacent. */
    chanceTwoAdjacent: number;
    /** 3+ adjacent birds always duel. */
    alwaysAtThreeAdjacent: boolean;
    /** Cap on quizzes per drop, so one drop can't turn into a quiz marathon. */
    maxPerDrop: number;
    /** How far each shot reaches, in cells. */
    shotRadius: number;
    /** The bandit's shots reach further. */
    banditShotRadius: number;
    /** Shoot along diagonals as well as rows and columns. */
    includeDiagonals: boolean;
    /**
     * Do gems hit by showdown shots pay, or are they merely swept away?
     *
     * Paying them roughly doubles the game's return, so it is off: a showdown
     * earns its keep by clearing the board toward the Coin Game, banking the
     * coins and features in its path, and lighting any dynamite it touches.
     */
    shotsPayGems: boolean;
    /**
     * When a bird duels the bandit, does the quiz answer decide the winner?
     * `false` falls back to a coin flip and the quiz only drives the shots.
     */
    quizDecidesBanditDuel: boolean;
  };

  meter: {
    /** Collections needed to fill the meter. */
    size: number;
    /** Simultaneous releases the meter can bank. */
    maxStackedReleases: number;
    /** Gems converted into specials per release. */
    symbolsPerRelease: [number, number];
  };

  switcheroo: {
    /** Chance of a swap when collections have dried up. */
    chance: number;
    maxPerRound: number;
  };

  dynamite: {
    /** Chebyshev radius of the blast. */
    blastRadius: number;
    /** Each explosion grows the grid by one step until it hits the maximum. */
    expandsGrid: boolean;
  };

  train: {
    /** Cells marked with the train backdrop per round, per side. */
    markedPerSide: number;
    laps: [number, number];
    featuresAwarded: [number, number];
  };

  coinGame: {
    /**
     * How many ordinary symbols may remain and still count as a swept grid.
     *
     * Zero is the real game's rule, but on a 6x7 board with everything
     * refilling, an exact sweep is close to unreachable — this clone would
     * simply never show the feature. A couple of stragglers is the difference
     * between a rare treat and a dead mechanic.
     */
    clearThreshold: number;
    coinBags: [number, number];
    scorpions: [number, number];
    /** Chance a lasso throw lands on its target. */
    lassoAccuracy: number;
  };

  bonus: {
    scattersToTrigger: number;
    initialDrops: number;
    /** Extra drops per bonus symbol collected during the bonus. */
    dropsPerRetrigger: number;
  };

  buy: {
    bonusHunt: number;
    banditEscape: number;
    coinGame: number;
    bonus: number;
    superBonus: number;
    /** Multiplier applied to the bonus trigger rate during a Bonus Hunt spin. */
    bonusHuntMultiplier: number;
  };

  quiz: {
    /** Pick harder questions for bigger showdowns. */
    scaleDifficultyWithDuelSize: boolean;
  };

  /** Safety valve: hard cap on settle-loop iterations per drop. */
  maxSettleIterations: number;
  /**
   * Safety valve: collection passes allowed in one drop. A long cascade is
   * good drama; an endless one is a hung game. If this ever bites during
   * normal play the symbol weights need attention, not this number.
   */
  maxCollectionPasses: number;
  /** Safety valve: free drops a single bonus may ever play. */
  maxBonusDrops: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  grid: { baseCols: 6, baseRows: 7, maxCols: 7, maxRows: 8 },

  weights: {
    gems: { blue: 30, green: 28, purple: 22, red: 16 },
    specialRate: 0.05,
    specials: {
      wild: 24,
      wildBandit: 4,
      upgrade: 9,
      upgradeAll: 1.2,
      coin: 5,
      dynamite: 8,
      peanut: 8,
      transform: 8,
      key: 1,
      bonus: 4,
      superBonus: 0.28,
    },
    birdRate: 0.6,
  },

  birds: {
    always: 'blue',
    clusterBias: 0.72,
  },

  bandit: { maxStealsPerDrop: 6, hunts: true },

  duel: {
    chanceTwoAdjacent: 0.6,
    alwaysAtThreeAdjacent: true,
    maxPerDrop: 3,
    shotRadius: 4,
    banditShotRadius: 5,
    includeDiagonals: true,
    shotsPayGems: false,
    quizDecidesBanditDuel: true,
  },

  meter: {
    size: 18,
    maxStackedReleases: 3,
    symbolsPerRelease: [1, 3],
  },

  switcheroo: { chance: 0.35, maxPerRound: 2 },

  dynamite: { blastRadius: 1, expandsGrid: true },

  train: { markedPerSide: 1, laps: [1, 4], featuresAwarded: [1, 3] },

  coinGame: { clearThreshold: 2, coinBags: [4, 9], scorpions: [1, 3], lassoAccuracy: 0.78 },

  bonus: { scattersToTrigger: 3, initialDrops: 5, dropsPerRetrigger: 1 },

  buy: {
    bonusHunt: 3,
    banditEscape: 25,
    coinGame: 50,
    bonus: 100,
    superBonus: 500,
    bonusHuntMultiplier: 4,
  },

  quiz: { scaleDifficultyWithDuelSize: true },

  maxSettleIterations: 400,
  maxCollectionPasses: 150,
  maxBonusDrops: 60,
};

/** Deep-ish clone so callers can tweak a config without touching the default. */
export function cloneConfig(cfg: GameConfig = DEFAULT_CONFIG): GameConfig {
  return structuredClone(cfg);
}
