import { describe, expect, it } from 'vitest';
import { Rng } from '../src/math/rng';
import { ShuffledBagSource } from '../src/quiz/selector';
import { LOCAL_QUESTIONS, validateBank } from '../src/quiz/source';
import { QuizStats } from '../src/quiz/stats';

describe('the bundled question bank', () => {
  it('passes schema validation', () => {
    const problems = validateBank(LOCAL_QUESTIONS);
    expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
  });

  it('has enough questions to be worth playing', () => {
    expect(LOCAL_QUESTIONS.length).toBeGreaterThanOrEqual(40);
  });

  it('spreads across several categories and all three difficulties', () => {
    const categories = new Set(LOCAL_QUESTIONS.map((q) => q.category));
    expect(categories.size).toBeGreaterThanOrEqual(5);

    for (const difficulty of [1, 2, 3]) {
      expect(LOCAL_QUESTIONS.some((q) => q.difficulty === difficulty)).toBe(true);
    }
  });

  it('does not always put the answer in the same slot', () => {
    // A bank where every answer is option A would be trivially gameable.
    const counts = [0, 0, 0, 0];
    for (const q of LOCAL_QUESTIONS) counts[q.answer]++;
    for (const count of counts) expect(count).toBeGreaterThan(0);
  });
});

describe('validateBank', () => {
  it('catches the mistakes that are easy to make by hand', () => {
    const problems = validateBank([
      { id: 'a', category: 'X', difficulty: 1, question: 'Q?', options: ['1', '2'], answer: 0 },
      { id: 'a', category: '', difficulty: 9, question: '', options: ['1', '1', '2', '3'], answer: 7 },
    ]);

    const text = problems.map((p) => p.problem).join('\n');
    expect(text).toContain('expected 4 options');
    expect(text).toContain('duplicate id');
    expect(text).toContain('missing category');
    expect(text).toContain('missing question text');
    expect(text).toContain('duplicate option text');
    expect(text).toContain('out of range');
    expect(text).toContain('outside 1-3');
  });
});

describe('ShuffledBagSource', () => {
  it('never repeats a question until the bank is exhausted', () => {
    const source = new ShuffledBagSource(LOCAL_QUESTIONS, new Rng('bag'));
    const seen = new Set<string>();

    for (let i = 0; i < LOCAL_QUESTIONS.length; i++) {
      const q = source.next();
      expect(seen.has(q.id), `repeated ${q.id} after ${i} draws`).toBe(false);
      seen.add(q.id);
    }

    expect(seen.size).toBe(LOCAL_QUESTIONS.length);
    // The next draw refills the bag, so repeats become legal again.
    expect(source.next()).toBeDefined();
  });

  it('honours a requested difficulty while one is still in the bag', () => {
    const source = new ShuffledBagSource(LOCAL_QUESTIONS, new Rng('difficulty'));
    for (let i = 0; i < 10; i++) {
      expect(source.next({ difficulty: 1 }).difficulty).toBe(1);
    }
  });

  it('falls back rather than failing when the difficulty cannot be matched', () => {
    const source = new ShuffledBagSource(LOCAL_QUESTIONS, new Rng('fallback'));
    expect(() => source.next({ difficulty: 99 })).not.toThrow();
  });

  it('is deterministic for a given seed', () => {
    const a = new ShuffledBagSource(LOCAL_QUESTIONS, new Rng('same'));
    const b = new ShuffledBagSource(LOCAL_QUESTIONS, new Rng('same'));
    for (let i = 0; i < 20; i++) expect(b.next().id).toBe(a.next().id);
  });

  it('refuses an empty bank rather than failing mid-duel', () => {
    expect(() => new ShuffledBagSource([], new Rng(1))).toThrow();
  });
});

describe('QuizStats', () => {
  it('tracks accuracy, streaks and per-category tallies', () => {
    const stats = new QuizStats();

    stats.record('Science', true);
    stats.record('Science', true);
    stats.record('History', false);
    stats.record('Science', true);

    expect(stats.data.asked).toBe(4);
    expect(stats.data.correct).toBe(3);
    expect(stats.accuracy).toBeCloseTo(0.75);
    expect(stats.data.streak).toBe(1);
    expect(stats.data.bestStreak).toBe(2);
    expect(stats.data.byCategory.Science).toEqual({ asked: 3, correct: 3 });
    expect(stats.data.byCategory.History).toEqual({ asked: 1, correct: 0 });
  });

  it('reports zero accuracy before anything is asked', () => {
    expect(new QuizStats().accuracy).toBe(0);
  });
});
