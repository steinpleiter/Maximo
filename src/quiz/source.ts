import bank from './questions.json';

export interface Question {
  id: string;
  category: string;
  /** 1 = easy, 2 = medium, 3 = hard. */
  difficulty: number;
  question: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
}

export interface QuestionRequest {
  /** Preferred difficulty; the source falls back to any question if it cannot match. */
  difficulty?: number;
}

/**
 * Where questions come from. The game only ever talks to this interface, so an
 * API-backed source can be dropped in later without touching game code.
 */
export interface QuestionSource {
  next(request?: QuestionRequest): Question;
  /** Total questions the source can offer, where that is knowable. */
  size(): number;
}

/** The bundled bank, straight out of `questions.json`. */
export const LOCAL_QUESTIONS: readonly Question[] = bank as Question[];

export interface BankProblem {
  id: string;
  problem: string;
}

/**
 * Checks a bank for the mistakes that are easy to make by hand: a missing
 * field, the wrong number of options, an out-of-range answer index, a
 * duplicate id, duplicated option text.
 */
export function validateBank(questions: readonly Question[]): BankProblem[] {
  const problems: BankProblem[] = [];
  const seen = new Set<string>();

  for (const [i, q] of questions.entries()) {
    const id = q?.id ?? `#${i}`;

    if (!q.id) problems.push({ id, problem: 'missing id' });
    else if (seen.has(q.id)) problems.push({ id, problem: 'duplicate id' });
    else seen.add(q.id);

    if (!q.question?.trim()) problems.push({ id, problem: 'missing question text' });
    if (!q.category?.trim()) problems.push({ id, problem: 'missing category' });

    if (!Array.isArray(q.options) || q.options.length !== 4) {
      problems.push({ id, problem: `expected 4 options, got ${q.options?.length ?? 0}` });
    } else {
      if (q.options.some((o) => !o?.trim())) problems.push({ id, problem: 'blank option text' });
      if (new Set(q.options).size !== q.options.length) {
        problems.push({ id, problem: 'duplicate option text' });
      }
    }

    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length ?? 0)) {
      problems.push({ id, problem: `answer index ${q.answer} out of range` });
    }

    if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 3) {
      problems.push({ id, problem: `difficulty ${q.difficulty} outside 1-3` });
    }
  }

  return problems;
}
