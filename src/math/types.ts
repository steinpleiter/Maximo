/**
 * Core data model for the collector-grid engine.
 *
 * Nothing in `src/math/` may import from `src/render/` — the whole module is
 * pure TypeScript so a round can be played out in Node, in a test, or (later)
 * on a server.
 */

export type GemColor = 'blue' | 'green' | 'purple' | 'red';

export const GEM_COLORS: readonly GemColor[] = ['blue', 'green', 'purple', 'red'];

/** Every kind of thing that can occupy a cell. */
export type SymbolKind =
  | 'gem'
  | 'bird'
  | 'bandit'
  | 'wild'
  | 'wildBandit'
  | 'upgrade'
  | 'upgradeAll'
  | 'coin'
  | 'dynamite'
  | 'peanut'
  | 'transform'
  | 'key'
  | 'bonus'
  | 'superBonus';

/** Special symbols a bird will pick up regardless of its own colour. */
export const SPECIAL_KINDS: readonly SymbolKind[] = [
  'wild',
  'wildBandit',
  'upgrade',
  'upgradeAll',
  'coin',
  'dynamite',
  'peanut',
  'transform',
  'key',
  'bonus',
  'superBonus',
];

export interface Cell {
  /** Stable per-instance id so the renderer can follow a symbol across drops. */
  id: number;
  kind: SymbolKind;
  /** Set for `gem` and `bird`. */
  color?: GemColor;
  /** Set for `coin` — a multiplier of the bet. */
  coinValue?: number;
  /** Set for `upgrade` / `upgradeAll` — how many levels it grants (1-3). */
  upgradeSteps?: number;
  /** Set for `upgrade` — which colour it targets. */
  upgradeColor?: GemColor;
}

export type Pos = { r: number; c: number };

/** `null` means an empty cell. Indexed `[row][col]`, row 0 is the top. */
export type Grid = (Cell | null)[][];

export interface BonusState {
  active: boolean;
  isSuper: boolean;
  dropsRemaining: number;
  dropsAwarded: number;
  dropsPlayed: number;
  totalWin: number;
}

export interface GameState {
  cols: number;
  rows: number;
  grid: Grid;
  /** Current upgrade level per colour, 1..7. */
  gemLevels: Record<GemColor, number>;
  /** Collection meter fill, 0..meterSize. */
  meter: number;
  /** Feature releases banked by the meter, awaiting the end of collections. */
  pendingReleases: number;
  /** Cells holding a train backdrop this round. */
  trainCells: Pos[];
  /**
   * Which edges each bird has robbed this drop. A heist needs both sides, but
   * not in a single walk — a bird can take the left edge on one cascade and
   * the right on another.
   */
  trainProgress: Record<number, { left: boolean; right: boolean }>;
  bandit: {
    released: boolean;
    /** Value the bandit has stolen and is carrying. */
    carried: number;
    /** How many of the four birds it has beaten. */
    birdsBeaten: number;
    beaten: Record<GemColor, boolean>;
  };
  bonus: BonusState;
  /** Scatters collected so far this round (or bonus). */
  scatters: number;
  superScatters: number;
  nextId: number;
}

// ---------------------------------------------------------------------------
// Events — the renderer's instruction tape
// ---------------------------------------------------------------------------

export type CellSnapshot = { r: number; c: number; cell: Cell | null };

export type GameEvent =
  | {
      t: 'roundStart';
      cols: number;
      rows: number;
      cells: CellSnapshot[];
      /** Cells wearing the train backdrop this drop. */
      trainCells: Pos[];
      gemLevels: Record<GemColor, number>;
      meter: number;
      meterSize: number;
      free: boolean;
    }
  /** Symbols dropped into empty cells from above. */
  | { t: 'refill'; cells: CellSnapshot[] }
  /** Existing symbols fell to fill gaps below them. */
  | { t: 'gravity'; moves: { from: Pos; to: Pos }[] }
  /** A bird walked a path eating symbols. */
  | {
      t: 'collect';
      birdId: number;
      color: GemColor | null;
      isBandit: boolean;
      /** Cells the collector moved through, in order, starting at its origin. */
      path: Pos[];
      eaten: { pos: Pos; cell: Cell; win: number }[];
      win: number;
    }
  | { t: 'gemUpgrade'; color: GemColor; from: number; to: number }
  | { t: 'transform'; color: GemColor; cells: Pos[] }
  | { t: 'meter'; value: number; size: number }
  | { t: 'meterRelease'; cells: CellSnapshot[] }
  | { t: 'duelStart'; birds: { id: number; color: GemColor | null; pos: Pos; isBandit: boolean }[] }
  | { t: 'quizAsked'; questionId: string }
  | { t: 'quizAnswered'; questionId: string; chosen: number; answer: number; correct: boolean }
  | {
      t: 'showdown';
      shots: { from: Pos; dir: Pos; cells: Pos[] }[];
      destroyed: { pos: Pos; cell: Cell; win: number }[];
      win: number;
    }
  | { t: 'duelFizzle' }
  /** Collectors repositioned themselves — after a duel, or to break a deadlock. */
  | { t: 'collectorMove'; moves: { from: Pos; to: Pos }[] }
  | {
      t: 'banditDuelResult';
      birdId: number;
      birdColor: GemColor | null;
      banditWon: boolean;
      payout: number;
    }
  | { t: 'switcheroo'; a: Pos; b: Pos }
  | { t: 'banditRelease'; pos: Pos; cell: Cell }
  | { t: 'dynamite'; pos: Pos; destroyed: Pos[] }
  | { t: 'gridExpand'; cols: number; rows: number }
  /** Ordinary symbols cleared off the board to make room for the Coin Game. */
  | { t: 'sweep'; cells: Pos[] }
  | { t: 'trainHeist'; birdId: number; laps: number; awarded: CellSnapshot[] }
  | {
      t: 'coinGame';
      picks: { pos: Pos; kind: 'coin' | 'scorpion'; value: number; by: GemColor | null }[];
      win: number;
    }
  | { t: 'scatters'; count: number; superCount: number }
  | { t: 'bonusStart'; drops: number; isSuper: boolean }
  | { t: 'bonusDropAwarded'; drops: number }
  | { t: 'bonusEnd'; totalWin: number }
  | { t: 'win'; amount: number; total: number }
  | { t: 'roundEnd'; win: number };

// ---------------------------------------------------------------------------
// Generator protocol
// ---------------------------------------------------------------------------

export interface QuizPrompt {
  questionId: string;
  question: string;
  options: string[];
  category: string;
  /** Who is squaring up — used for flavour in the modal. */
  duelists: { color: GemColor | null; isBandit: boolean }[];
  /** True when losing this duel hands the round to the bandit. */
  versusBandit: boolean;
}

/**
 * What the engine hands back to its host. `events` must be animated first; if
 * `quiz` is present the host then asks the question and resumes the generator
 * with the chosen option index.
 */
export interface RoundYield {
  events: GameEvent[];
  quiz?: QuizPrompt;
}

export interface RoundResult {
  /** Total win for the round, as a multiple of the bet. */
  win: number;
  events: GameEvent[];
}

/** The host sends an answer index back in for each `quiz` yield. */
export type RoundGenerator = Generator<RoundYield, RoundResult, number | undefined>;
