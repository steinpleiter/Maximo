import { DEFAULT_CONFIG, type GameConfig } from '../config/gameConfig';
import type { Question, QuestionSource } from '../quiz/source';
import { ShuffledBagSource } from '../quiz/selector';
import { huntNearestBird, releaseBandit, resolveBanditDuel } from './bandit';
import { runCollections, type CollectResult } from './collect';
import { runCoinGame } from './coinGame';
import {
  duelDifficulty,
  findDuelGroups,
  resolveShowdown,
  separateCollectors,
  shouldDuel,
  switcheroo,
  type Duelist,
} from './duel';
import {
  applyGravity,
  expandGrid,
  isGridCleared,
  makeGrid,
  refill,
  snapshot,
  spawnBirds,
} from './grid';
import { fillMeter, releaseFeatures } from './meter';
import { Rng } from './rng';
import { applyCollectedSpecials, explodeDynamite } from './specials';
import { checkTrainHeist, markTrainCells, runTrainHeist } from './train';
import type { GameEvent, GameState, Pos, QuizPrompt, RoundGenerator, RoundResult } from './types';

/** Hard ceiling on a round, matching the published 10,000x. */
export const MAX_WIN_MULTIPLIER = 10000;

/**
 * Steps a loose bandit may take toward a bird in one drop. Each step shortens
 * the distance, so this only ever bites if the board keeps it boxed out.
 */
const MAX_HUNTS_PER_DROP = 40;

export type BuyKind = 'bonusHunt' | 'banditEscape' | 'coinGame' | 'bonus' | 'superBonus';

export interface ForceFlags {
  dynamite?: boolean;
  key?: boolean;
  train?: boolean;
  coinGame?: boolean;
  duel?: boolean;
}

export interface RoundOptions {
  buy?: BuyKind;
  force?: ForceFlags;
}

export interface EngineOptions {
  config?: GameConfig;
  rng?: Rng;
  questions?: QuestionSource;
}

export function createState(cfg: GameConfig): GameState {
  return {
    cols: cfg.grid.baseCols,
    rows: cfg.grid.baseRows,
    grid: makeGrid(cfg.grid.baseCols, cfg.grid.baseRows),
    gemLevels: { blue: 1, green: 1, purple: 1, red: 1 },
    meter: 0,
    pendingReleases: 0,
    trainCells: [],
    trainProgress: {},
    bandit: {
      released: false,
      carried: 0,
      birdsBeaten: 0,
      beaten: { blue: false, green: false, purple: false, red: false },
    },
    bonus: {
      active: false,
      isSuper: false,
      dropsRemaining: 0,
      dropsAwarded: 0,
      dropsPlayed: 0,
      totalWin: 0,
    },
    scatters: 0,
    superScatters: 0,
    nextId: 1,
  };
}

/** What a buy costs, as a multiple of the bet. */
export function buyCost(cfg: GameConfig, buy: BuyKind): number {
  return cfg.buy[buy];
}

export class Engine {
  readonly cfg: GameConfig;
  readonly rng: Rng;
  readonly questions: QuestionSource;
  state: GameState;

  /** Set while a round is in flight, so a host can read the live grid. */
  lastQuestion: Question | null = null;

  constructor(opts: EngineOptions = {}) {
    this.cfg = opts.config ?? DEFAULT_CONFIG;
    this.rng = opts.rng ?? new Rng();
    this.questions = opts.questions ?? new ShuffledBagSource(undefined, this.rng);
    this.state = createState(this.cfg);
  }

  /**
   * Plays one complete round: the base drop, every cascade and feature it sets
   * off, and the whole bonus if one triggers.
   *
   * The generator yields batches of events for the host to animate. When a
   * yield carries a `quiz`, the host must ask the question and resume with the
   * chosen option index.
   */
  *playRound(opts: RoundOptions = {}): RoundGenerator {
    const { cfg, rng } = this;
    const all: GameEvent[] = [];
    let buffer: GameEvent[] = [];

    const emit = (...events: (GameEvent | null)[]) => {
      for (const ev of events) {
        if (!ev) continue;
        buffer.push(ev);
        all.push(ev);
      }
    };
    const flush = (): GameEvent[] => {
      const out = buffer;
      buffer = [];
      return out;
    };

    const acc = { win: 0 };

    // --- set up the round --------------------------------------------------
    const buy = opts.buy;
    const startInBonus = buy === 'bonus' || buy === 'superBonus';

    this.resetForBaseSpin();

    if (buy === 'banditEscape') {
      emit(releaseBandit(this.state, rng));
    }

    if (startInBonus) {
      this.state.bonus = {
        active: true,
        isSuper: buy === 'superBonus',
        dropsRemaining: cfg.bonus.initialDrops,
        dropsAwarded: cfg.bonus.initialDrops,
        dropsPlayed: 0,
        totalWin: 0,
      };
      if (buy === 'superBonus') {
        // The Super bonus is played on the full grid from the first drop.
        while (expandGrid(this.state, cfg)) {
          /* grow to maximum */
        }
        emit({ t: 'gridExpand', cols: this.state.cols, rows: this.state.rows });
      }
      emit({ t: 'bonusStart', drops: cfg.bonus.initialDrops, isSuper: buy === 'superBonus' });
    }

    const bonusHunt = buy === 'bonusHunt';

    // --- the base drop -----------------------------------------------------
    if (!startInBonus) {
      emit(...this.prepareDrop(false, { bonusHunt }));
      yield { events: flush() };
      yield* this.settle(acc, emit, flush, opts);
      emit({ t: 'scatters', count: this.state.scatters, superCount: this.state.superScatters });

      if (this.state.scatters >= cfg.bonus.scattersToTrigger) {
        const isSuper = this.state.superScatters > 0;
        this.state.bonus = {
          active: true,
          isSuper,
          dropsRemaining: cfg.bonus.initialDrops,
          dropsAwarded: cfg.bonus.initialDrops,
          dropsPlayed: 0,
          totalWin: 0,
        };
        if (isSuper) {
          while (expandGrid(this.state, cfg)) {
            /* grow to maximum */
          }
          emit({ t: 'gridExpand', cols: this.state.cols, rows: this.state.rows });
        }
        emit({ t: 'bonusStart', drops: cfg.bonus.initialDrops, isSuper });
      }
    }

    // --- free drops --------------------------------------------------------
    if (this.state.bonus.active) {
      const winBeforeBonus = acc.win;
      let guard = 0;

      while (this.state.bonus.dropsRemaining > 0 && guard++ < cfg.maxBonusDrops) {
        this.state.bonus.dropsRemaining--;
        this.state.bonus.dropsPlayed++;

        emit(...this.prepareDrop(true, { bonusHunt: false }));
        yield { events: flush() };

        yield* this.settle(acc, emit, flush, opts);
      }

      this.state.bonus.totalWin = acc.win - winBeforeBonus;
      emit({ t: 'bonusEnd', totalWin: this.state.bonus.totalWin });
      this.state.bonus.active = false;
    }

    emit({ t: 'roundEnd', win: acc.win });
    yield { events: flush() };

    return { win: acc.win, events: all } satisfies RoundResult;
  }

  // -------------------------------------------------------------------------

  /** Clears everything that does not persist between base spins. */
  private resetForBaseSpin(): void {
    const { cfg } = this;
    if (this.state.bonus.active) return;

    this.state.cols = cfg.grid.baseCols;
    this.state.rows = cfg.grid.baseRows;
    this.state.grid = makeGrid(cfg.grid.baseCols, cfg.grid.baseRows);
    this.state.gemLevels = { blue: 1, green: 1, purple: 1, red: 1 };
    this.state.meter = 0;
    this.state.pendingReleases = 0;
    this.state.scatters = 0;
    this.state.superScatters = 0;
    this.state.trainCells = [];
    this.state.trainProgress = {};
    this.state.bandit = {
      released: false,
      carried: 0,
      birdsBeaten: 0,
      beaten: { blue: false, green: false, purple: false, red: false },
    };
  }

  /**
   * Drops a fresh set of symbols. Grid size, gem levels and the collection
   * meter are deliberately left alone — during a bonus they persist across
   * every drop, which is where the big wins come from.
   */
  private prepareDrop(isFree: boolean, opts: { bonusHunt: boolean }): GameEvent[] {
    const { cfg, rng, state } = this;

    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) state.grid[r][c] = null;
    }

    // The bandit stays out until a bird beats it.
    if (state.bandit.released) {
      const pos = this.freeCell();
      if (pos) state.grid[pos.r][pos.c] = { id: state.nextId++, kind: 'bandit' };
    }

    spawnBirds(state, cfg, rng);
    markTrainCells(state, cfg, rng);

    const scatterBoost = opts.bonusHunt ? cfg.buy.bonusHuntMultiplier : 1;
    const dropCfg = scatterBoost === 1 ? cfg : withScatterBoost(cfg, scatterBoost);
    refill(state, dropCfg, rng);

    return [
      {
        t: 'roundStart',
        cols: state.cols,
        rows: state.rows,
        cells: snapshot(state),
        trainCells: state.trainCells.map((p) => ({ ...p })),
        gemLevels: { ...state.gemLevels },
        meter: state.meter,
        meterSize: cfg.meter.size,
        free: isFree,
      },
    ];
  }

  private freeCell(): Pos | null {
    const candidates: Pos[] = [];
    for (let r = 0; r < this.state.rows; r++) {
      for (let c = 0; c < this.state.cols; c++) {
        if (!this.state.grid[r][c]) candidates.push({ r, c });
      }
    }
    return candidates.length > 0 ? this.rng.pick(candidates) : null;
  }

  /**
   * The settle loop: collect, duel, release, explode, sweep, repeat until the
   * grid goes quiet. Every exit path is bounded, and the whole thing is capped
   * by `cfg.maxSettleIterations` as a last resort.
   */
  private *settle(
    acc: { win: number },
    emit: (...events: (GameEvent | null)[]) => void,
    flush: () => GameEvent[],
    opts: RoundOptions,
  ): Generator<{ events: GameEvent[]; quiz?: QuizPrompt }, void, number | undefined> {
    const { cfg, rng, state } = this;

    let duels = 0;
    let swaps = 0;
    let passes = 0;
    let hunts = 0;
    let banditSteals = 0;
    let coinGamePlayed = false;
    const pendingDynamite: Pos[] = [];
    let coinGameOwed = opts.buy === 'coinGame' || !!opts.force?.coinGame;

    const addWin = (amount: number) => {
      if (amount <= 0) return;
      acc.win = Math.min(MAX_WIN_MULTIPLIER, acc.win + amount);
      emit({ t: 'win', amount, total: acc.win });
    };

    /** Runs eaten specials through their effects, wherever they came from. */
    const resolveSpecials = (results: CollectResult[]) => {
      const outcome = applyCollectedSpecials(state, cfg, results);
      emit(...outcome.events);
      pendingDynamite.push(...outcome.dynamite);
      if (outcome.keyCollected) emit(releaseBandit(state, rng));
    };

    const settleGrid = () => {
      const moves = applyGravity(state);
      if (moves.length > 0) emit({ t: 'gravity', moves });
      const filled = refill(state, cfg, rng);
      if (filled.length > 0) emit({ t: 'refill', cells: filled });
    };

    if (opts.force?.key) emit(releaseBandit(state, rng));

    for (let iteration = 0; iteration < cfg.maxSettleIterations; iteration++) {
      // --- 1. collections -------------------------------------------------
      const skipBandit = banditSteals >= cfg.bandit.maxStealsPerDrop;
      const results =
        passes < cfg.maxCollectionPasses
          ? runCollections(state, cfg, rng, { skipBandit })
          : [];

      if (results.length > 0) {
        passes++;
        let birdWin = 0;

        for (const result of results) {
          emit({
            t: 'collect',
            birdId: result.birdId,
            color: result.color,
            isBandit: result.isBandit,
            path: result.path,
            eaten: result.eaten,
            win: result.win,
          });

          // The bandit steals rather than pays: its haul sits with it until a
          // bird wins it back in a duel.
          if (result.isBandit) {
            state.bandit.carried += result.win;
            banditSteals++;
            if (cfg.bandit.hunts) emit(huntNearestBird(state));
          } else {
            birdWin += result.win;
          }
        }

        addWin(birdWin);
        resolveSpecials(results);
        emit(...fillMeter(state, cfg, results));

        const trainBird = checkTrainHeist(state, results);
        if (trainBird !== null) emit(runTrainHeist(state, cfg, rng, trainBird));

        if (!coinGamePlayed && isGridCleared(state, cfg.coinGame.clearThreshold)) {
          const game = runCoinGame(state, cfg, rng);
          coinGamePlayed = true;
          addWin(game.win);
          emit(game.event);
        }

        settleGrid();
        yield { events: flush() };
        continue;
      }

      // --- 2. duels — the quiz gate ---------------------------------------
      {
        // The per-drop cap holds back bird-on-bird duels only. A bandit
        // stand-off always goes ahead: the bandit has to be able to work
        // through all four birds, which is what triggers the Coin Game.
        const group = this.pickDuelGroup(
          !!opts.force?.duel && duels === 0,
          duels >= cfg.duel.maxPerDrop,
        );
        if (group) {
          // Only bird-on-bird duels spend the per-drop allowance.
          if (!group.some((d) => d.isBandit)) duels++;
          emit({
            t: 'duelStart',
            birds: group.map((d) => ({
              id: d.id,
              color: d.color,
              pos: d.pos,
              isBandit: d.isBandit,
            })),
          });

          const question = this.questions.next({ difficulty: duelDifficulty(group, cfg) });
          this.lastQuestion = question;
          emit({ t: 'quizAsked', questionId: question.id });

          const versusBandit = group.some((d) => d.isBandit);
          const prompt: QuizPrompt = {
            questionId: question.id,
            question: question.question,
            options: question.options,
            category: question.category,
            duelists: group.map((d) => ({ color: d.color, isBandit: d.isBandit })),
            versusBandit,
          };

          // Hand control to the host and wait for an answer.
          const chosen = yield { events: flush(), quiz: prompt };
          const correct = chosen === question.answer;

          emit({
            t: 'quizAnswered',
            questionId: question.id,
            chosen: chosen ?? -1,
            answer: question.answer,
            correct,
          });

          if (versusBandit && cfg.duel.quizDecidesBanditDuel) {
            const bird = group.find((d) => !d.isBandit);
            if (bird) {
              const outcome = resolveBanditDuel(state, bird, correct);
              addWin(outcome.payout);
              emit(...outcome.events);
              if (outcome.triggersCoinGame) coinGameOwed = true;
            }
            // A bird that wins also gets its shots off.
            if (correct) {
              const survivors = group.filter((d) => !d.isBandit);
              if (survivors.length > 0) {
                const showdown = resolveShowdown(state, cfg, survivors);
                addWin(showdown.win);
                emit(showdown.event);
                resolveSpecials(showdown.results);
              }
            }
          } else if (correct) {
            const showdown = resolveShowdown(state, cfg, group);
            addWin(showdown.win);
            emit(showdown.event);
            resolveSpecials(showdown.results);
          } else {
            emit({ t: 'duelFizzle' });
          }

          emit(separateCollectors(state, rng, group));

          if (!coinGamePlayed && isGridCleared(state, cfg.coinGame.clearThreshold)) {
            const game = runCoinGame(state, cfg, rng);
            coinGamePlayed = true;
            addWin(game.win);
            emit(game.event);
          }

          settleGrid();
          yield { events: flush() };
          continue;
        }
      }

      // --- 3. a loose bandit closes on the nearest bird --------------------
      if (state.bandit.released && hunts < MAX_HUNTS_PER_DROP) {
        const step = huntNearestBird(state);
        if (step) {
          hunts++;
          emit(step);
          yield { events: flush() };
          continue;
        }
      }

      // --- 4. banked meter releases ---------------------------------------
      if (state.pendingReleases > 0) {
        const released = releaseFeatures(state, cfg, rng);
        if (released) {
          emit(released);
          yield { events: flush() };
          continue;
        }
      }

      // --- 5. dynamite ----------------------------------------------------
      if (opts.force?.dynamite && iteration === 0) {
        pendingDynamite.push({
          r: rng.int(0, state.rows - 1),
          c: rng.int(0, state.cols - 1),
        });
      }

      if (pendingDynamite.length > 0) {
        const origin = pendingDynamite.shift() as Pos;
        const { destroyed } = explodeDynamite(state, cfg, origin);
        emit({ t: 'dynamite', pos: origin, destroyed });

        if (cfg.dynamite.expandsGrid && expandGrid(state, cfg)) {
          emit({ t: 'gridExpand', cols: state.cols, rows: state.rows });
        }

        if (!coinGamePlayed && isGridCleared(state, cfg.coinGame.clearThreshold)) {
          const game = runCoinGame(state, cfg, rng);
          coinGamePlayed = true;
          addWin(game.win);
          emit(game.event);
        }

        settleGrid();
        yield { events: flush() };
        continue;
      }

      // --- 6. a coin game we owe ------------------------------------------
      if (coinGameOwed && !coinGamePlayed) {
        coinGameOwed = false;
        coinGamePlayed = true;
        // Sweep the board so the lassos have somewhere to land.
        for (let r = 0; r < state.rows; r++) {
          for (let c = 0; c < state.cols; c++) {
            const cell = state.grid[r][c];
            if (cell && cell.kind !== 'bird' && cell.kind !== 'bandit') state.grid[r][c] = null;
          }
        }
        const game = runCoinGame(state, cfg, rng);
        addWin(game.win);
        emit(game.event);
        settleGrid();
        yield { events: flush() };
        continue;
      }

      // --- 7. switcheroo --------------------------------------------------
      if (swaps < cfg.switcheroo.maxPerRound && rng.chance(cfg.switcheroo.chance)) {
        const swap = switcheroo(state, rng);
        if (swap) {
          swaps++;
          emit(swap);
          yield { events: flush() };
          continue;
        }
      }

      break;
    }

    // Hand over whatever the final pass emitted but did not yield.
    const tail = flush();
    if (tail.length > 0) yield { events: tail };
  }

  /**
   * The first touching group that rolls a duel this pass, if any.
   *
   * Bandit stand-offs are offered first and ignore the per-drop cap, so the
   * bandit can always be confronted.
   */
  private pickDuelGroup(force: boolean, banditOnly: boolean): Duelist[] | null {
    const groups = findDuelGroups(this.state);
    if (groups.length === 0) return null;

    const ordered = [
      ...groups.filter((g) => g.some((d) => d.isBandit)),
      ...groups.filter((g) => !g.some((d) => d.isBandit)),
    ];

    for (const group of ordered) {
      const hasBandit = group.some((d) => d.isBandit);
      if (banditOnly && !hasBandit) continue;
      // A cornered bandit always fights; birds roll for it.
      if (hasBandit || force || shouldDuel(group, this.cfg, this.rng)) return group;
    }

    return null;
  }
}

/** A shallow config override that raises the scatter weights for one drop. */
function withScatterBoost(cfg: GameConfig, factor: number): GameConfig {
  return {
    ...cfg,
    weights: {
      ...cfg.weights,
      specials: {
        ...cfg.weights.specials,
        bonus: (cfg.weights.specials.bonus ?? 0) * factor,
        superBonus: (cfg.weights.specials.superBonus ?? 0) * factor,
      },
    },
  };
}
