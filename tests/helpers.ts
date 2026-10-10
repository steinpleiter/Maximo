import { Engine, type RoundOptions } from '../src/math/engine';
import { Rng } from '../src/math/rng';
import { ShuffledBagSource } from '../src/quiz/selector';
import { LOCAL_QUESTIONS } from '../src/quiz/source';
import type { GameEvent, QuizPrompt } from '../src/math/types';

const BY_ID = new Map(LOCAL_QUESTIONS.map((q) => [q.id, q]));

/** Answers every question correctly — the index comes from the bank. */
export function alwaysCorrect(prompt: QuizPrompt): number {
  return BY_ID.get(prompt.questionId)?.answer ?? 0;
}

/** Answers every question wrong, by picking anything but the right option. */
export function alwaysWrong(prompt: QuizPrompt): number {
  const answer = BY_ID.get(prompt.questionId)?.answer ?? 0;
  return (answer + 1) % prompt.options.length;
}

export interface PlayedRound {
  win: number;
  events: GameEvent[];
  prompts: QuizPrompt[];
  /** How many times the generator handed control back. */
  yields: number;
}

/**
 * Drives a round to completion with a given answering strategy — the same
 * contract the renderer implements, minus the animation.
 */
export function playRound(
  engine: Engine,
  answer: (prompt: QuizPrompt) => number,
  opts: RoundOptions = {},
): PlayedRound {
  const gen = engine.playRound(opts);
  const events: GameEvent[] = [];
  const prompts: QuizPrompt[] = [];

  let res = gen.next();
  let yields = 0;

  while (!res.done) {
    if (++yields > 20000) throw new Error('round did not terminate');
    events.push(...res.value.events);

    if (res.value.quiz) {
      prompts.push(res.value.quiz);
      res = gen.next(answer(res.value.quiz));
    } else {
      res = gen.next(undefined);
    }
  }

  return { win: res.value.win, events, prompts, yields };
}

export function makeEngine(seed: number | string): Engine {
  const rng = new Rng(seed);
  return new Engine({ rng, questions: new ShuffledBagSource(LOCAL_QUESTIONS, new Rng(seed)) });
}

export function eventsOfType<T extends GameEvent['t']>(
  events: GameEvent[],
  type: T,
): Extract<GameEvent, { t: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === type);
}
