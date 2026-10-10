import { Rng } from '../math/rng';
import { LOCAL_QUESTIONS, type Question, type QuestionRequest, type QuestionSource } from './source';

/**
 * Draws questions from a shuffled bag: nothing repeats until the bank has been
 * exhausted, at which point the bag is refilled and reshuffled.
 *
 * When a difficulty is requested it is honoured if the remaining bag can, and
 * quietly ignored if it cannot — a player should never be told "no question
 * available" in the middle of a duel.
 */
export class ShuffledBagSource implements QuestionSource {
  private readonly pool: readonly Question[];
  private bag: Question[] = [];
  private readonly rng: Rng;

  constructor(questions: readonly Question[] = LOCAL_QUESTIONS, rng: Rng = new Rng()) {
    if (questions.length === 0) throw new Error('ShuffledBagSource needs at least one question');
    this.pool = questions;
    this.rng = rng;
    this.refill();
  }

  size(): number {
    return this.pool.length;
  }

  /** Questions left before the bag reshuffles. */
  remaining(): number {
    return this.bag.length;
  }

  next(request: QuestionRequest = {}): Question {
    if (this.bag.length === 0) this.refill();

    let index = 0;
    if (request.difficulty !== undefined) {
      const match = this.bag.findIndex((q) => q.difficulty === request.difficulty);
      if (match >= 0) index = match;
    }

    const [question] = this.bag.splice(index, 1);
    return question;
  }

  private refill(): void {
    this.bag = this.rng.shuffle([...this.pool]);
  }
}
