import { DEFAULT_CONFIG } from './config/gameConfig';
import { Engine, type BuyKind, type ForceFlags, type RoundOptions } from './math/engine';
import { refill, snapshot } from './math/grid';
import { Rng } from './math/rng';
import type { GemColor, QuizPrompt } from './math/types';
import { ShuffledBagSource } from './quiz/selector';
import { LOCAL_QUESTIONS } from './quiz/source';
import { QuizStats } from './quiz/stats';
import { playEvent, type AnimatorHooks } from './render/animators';
import { GameStage } from './render/app';
import { setSpeed } from './render/tween';
import { DebugPanel, type AutoAnswer } from './render/ui/debug';
import { applyChrome, setCageOpen } from './render/ui/chrome';
import { Hud } from './render/ui/hud';
import { Panels } from './render/ui/panels';
import { QuizModal } from './render/ui/quizModal';

const BET_STEPS = [0.2, 0.4, 0.6, 1, 2, 4, 6, 10, 20, 40, 60, 100];
const STARTING_BALANCE = 1000;
const STORAGE_KEY = 'maximo.session.v1';

const ANSWERS = new Map(LOCAL_QUESTIONS.map((q) => [q.id, q.answer]));

interface SessionData {
  balance: number;
  betIndex: number;
}

/**
 * The session: money, bet, the engine, and the loop that walks a round's event
 * tape into animations — pausing at every duel to put a question on screen.
 */
export class Game {
  private readonly stage = new GameStage();
  private engine: Engine;
  private readonly hud: Hud;
  private readonly quiz: QuizModal;
  private readonly panels: Panels;
  private debug: DebugPanel | null = null;

  private readonly stats = QuizStats.load();
  private balance = STARTING_BALANCE;
  private betIndex = BET_STEPS.indexOf(1);
  private busy = false;
  private autoplay = false;
  private seed: string | null = null;

  constructor() {
    this.engine = this.makeEngine();

    this.hud = new Hud({
      onSpin: () => void this.spin(),
      onBetChange: (delta) => this.changeBet(delta),
      onTurbo: (on) => setSpeed(on ? 3 : 1),
      onAuto: (on) => this.setAutoplay(on),
      onBuy: () => void this.openBuyMenu(),
      onInfo: () => this.panels.info(this.stats.data),
    });

    this.quiz = new QuizModal(required('quiz-layer'));
    this.panels = new Panels(required('modal-layer'));
  }

  get bet(): number {
    return BET_STEPS[this.betIndex];
  }

  async start(): Promise<void> {
    applyChrome();
    await this.stage.init(required('stage'));
    this.loadSession();

    if (import.meta.env.DEV) {
      this.debug = new DebugPanel(required('debug-layer'), {
        onSpin: (opts) => void this.spin(opts),
        onSeed: (seed) => this.reseed(seed),
        onAutoAnswer: () => undefined,
        onReset: () => this.resetSession(),
      });
    }

    this.showIdleBoard();
    this.refreshHud();
    this.hud.banner('Spin to begin', 'good');

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && !this.busy) {
        event.preventDefault();
        void this.spin();
      }
    });
  }

  /**
   * Fills the board with a cosmetic drop so the game does not look broken
   * before the first spin. The next spin clears it outright.
   */
  private showIdleBoard(): void {
    const state = this.engine.state;
    refill(state, DEFAULT_CONFIG, this.engine.rng);
    this.stage.board.idle(snapshot(state), state.gemLevels);
  }

  // --- session -------------------------------------------------------------

  private makeEngine(): Engine {
    const rng = this.seed ? new Rng(this.seed) : new Rng();
    const questionRng = this.seed ? new Rng(`${this.seed}:q`) : new Rng();
    return new Engine({
      rng,
      questions: new ShuffledBagSource(LOCAL_QUESTIONS, questionRng),
    });
  }

  private reseed(seed: string): void {
    this.seed = seed || null;
    this.engine = this.makeEngine();
    this.hud.banner(seed ? `Seed: ${seed}` : 'Random seed');
  }

  private loadSession(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<SessionData>;
      if (typeof data.balance === 'number' && data.balance > 0) this.balance = data.balance;
      if (
        typeof data.betIndex === 'number' &&
        data.betIndex >= 0 &&
        data.betIndex < BET_STEPS.length
      ) {
        this.betIndex = data.betIndex;
      }
    } catch {
      /* a fresh session is a fine fallback */
    }
  }

  private saveSession(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ balance: this.balance, betIndex: this.betIndex } satisfies SessionData),
      );
    } catch {
      /* ignore */
    }
    this.stats.save();
  }

  private resetSession(): void {
    this.balance = STARTING_BALANCE;
    this.stats.reset();
    this.saveSession();
    this.refreshHud();
    this.hud.banner('Session reset');
  }

  private changeBet(delta: number): void {
    this.betIndex = Math.min(BET_STEPS.length - 1, Math.max(0, this.betIndex + delta));
    this.refreshHud();
    this.saveSession();
  }

  private setAutoplay(on: boolean): void {
    this.autoplay = on;
    this.hud.setAuto(on);
    if (on && !this.busy) void this.spin();
  }

  private refreshHud(): void {
    this.hud.setBalance(this.balance);
    this.hud.setBet(this.bet);
    this.hud.setLevels(this.engine.state.gemLevels);
    this.hud.setQuizStats(this.stats.data.correct, this.stats.data.asked, this.stats.data.streak);
  }

  // --- the round loop ------------------------------------------------------

  private async openBuyMenu(): Promise<void> {
    const choice = await this.panels.buyMenu(this.bet, this.balance);
    if (choice) await this.spin({ buy: choice });
  }

  private async spin(opts: { buy?: BuyKind; force?: ForceFlags } = {}): Promise<void> {
    if (this.busy) return;

    const cost = opts.buy ? DEFAULT_CONFIG.buy[opts.buy] * this.bet : this.bet;
    if (cost > this.balance) {
      this.hud.banner('Not enough balance', 'bad');
      this.setAutoplay(false);
      return;
    }

    this.busy = true;
    setCageOpen(this.engine.state.bandit.released);
    this.stage.board.wake();
    this.hud.setBusy(true);
    this.balance -= cost;
    this.hud.setBalance(this.balance);
    this.hud.setWin(0);

    try {
      const win = await this.playRound(opts);
      this.balance += win * this.bet;
      this.hud.setBalance(this.balance);
      if (win > 0) this.hud.banner(`Round win ${win.toFixed(2)}x`, 'good');
      this.saveSession();
    } finally {
      this.busy = false;
      this.hud.setBusy(false);
    }

    if (this.autoplay && this.balance >= this.bet) {
      // A beat between spins, so an autoplay run stays watchable.
      setTimeout(() => void this.spin(), 350);
    } else if (this.autoplay) {
      this.setAutoplay(false);
    }
  }

  /**
   * Walks the engine's generator.
   *
   * This is the whole host contract: animate the batch, and when the batch
   * carries a quiz, ask it and resume with the answer.
   */
  private async playRound(opts: RoundOptions): Promise<number> {
    const hooks = this.animatorHooks();
    const generator = this.engine.playRound(opts);

    let step = generator.next();

    while (!step.done) {
      for (const event of step.value.events) {
        await playEvent(event, hooks);
      }
      // The engine's grid is the truth; never let a misread event leave two
      // symbols stacked in one cell.
      this.stage.board.reconcile(snapshot(this.engine.state), this.engine.state.gemLevels);

      if (step.value.quiz) {
        const chosen = await this.askQuiz(step.value.quiz);
        step = generator.next(chosen);
      } else {
        step = generator.next(undefined);
      }
    }

    return step.value.win;
  }

  private async askQuiz(prompt: QuizPrompt): Promise<number> {
    const correct = ANSWERS.get(prompt.questionId) ?? 0;
    const auto = this.debug?.autoAnswerMode ?? 'off';

    const chosen = await this.resolveAnswer(prompt, correct, auto);

    this.stats.record(prompt.category, chosen === correct);
    this.hud.setQuizStats(this.stats.data.correct, this.stats.data.asked, this.stats.data.streak);
    this.stats.save();

    return chosen;
  }

  private resolveAnswer(
    prompt: QuizPrompt,
    correct: number,
    auto: AutoAnswer,
  ): Promise<number> {
    if (auto === 'correct') return Promise.resolve(correct);
    if (auto === 'wrong') return Promise.resolve((correct + 1) % prompt.options.length);
    return this.quiz.ask(prompt, correct);
  }

  private animatorHooks(): AnimatorHooks {
    return {
      board: this.stage.board,
      refit: () => this.stage.fit(),
      setLevels: (levels: Record<GemColor, number>) => this.hud.setLevels(levels),
      bumpLevel: (color, to) => this.hud.bumpLevel(color, to),
      addWin: (_amount, total) => this.hud.setWin(total * this.bet),
      banner: (text, tone) => this.hud.banner(text, tone),
      setBonus: (drops, isSuper) => this.hud.setBonus(drops, isSuper),
      setCageOpen: (open) => setCageOpen(open),
    };
  }
}

function required(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
}
