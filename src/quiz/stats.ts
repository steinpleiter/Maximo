const STORAGE_KEY = 'maximo.quizStats.v1';

export interface QuizStatsData {
  asked: number;
  correct: number;
  streak: number;
  bestStreak: number;
  /** Per-category tallies, so you can see which subjects are costing wins. */
  byCategory: Record<string, { asked: number; correct: number }>;
}

export function emptyStats(): QuizStatsData {
  return { asked: 0, correct: 0, streak: 0, bestStreak: 0, byCategory: {} };
}

export class QuizStats {
  data: QuizStatsData;

  constructor(data: QuizStatsData = emptyStats()) {
    this.data = data;
  }

  get accuracy(): number {
    return this.data.asked === 0 ? 0 : this.data.correct / this.data.asked;
  }

  record(category: string, correct: boolean): void {
    const d = this.data;
    d.asked++;
    if (correct) {
      d.correct++;
      d.streak++;
      d.bestStreak = Math.max(d.bestStreak, d.streak);
    } else {
      d.streak = 0;
    }

    const bucket = (d.byCategory[category] ??= { asked: 0, correct: 0 });
    bucket.asked++;
    if (correct) bucket.correct++;
  }

  reset(): void {
    this.data = emptyStats();
  }

  // Storage is a per-browser convenience, never a source of truth, so every
  // access is guarded: private windows and blocked site data both throw.
  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  }

  static load(): QuizStats {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new QuizStats();
      const parsed = JSON.parse(raw) as Partial<QuizStatsData>;
      return new QuizStats({ ...emptyStats(), ...parsed });
    } catch {
      return new QuizStats();
    }
  }
}
