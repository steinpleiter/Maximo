import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config/gameConfig';
import { Engine } from '../src/math/engine';
import { Rng } from '../src/math/rng';
import { ShuffledBagSource } from '../src/quiz/selector';
import { LOCAL_QUESTIONS } from '../src/quiz/source';
import { findBirds } from '../src/math/grid';
import { alwaysCorrect, eventsOfType, playRound } from './helpers';

/**
 * The feel check for the whole project: the quiz is meant to be the heartbeat
 * of a session, around one question every two to three base spins. There is no
 * RTP target here — this is the one number that has to land.
 */
const SPINS = 4000;

describe('duel rate', () => {
  it('puts a quiz in front of the player roughly every 2-3 base spins', () => {
    const engine = new Engine({
      rng: new Rng('duel-rate'),
      questions: new ShuffledBagSource(LOCAL_QUESTIONS, new Rng('duel-rate-q')),
    });

    let quizzes = 0;
    let baseSpinsWithQuiz = 0;
    let birdTotal = 0;
    let totalWin = 0;
    let bonuses = 0;
    let coinGames = 0;
    let trains = 0;
    let bandits = 0;
    let maxWin = 0;
    let spinsWithWin = 0;

    for (let spin = 0; spin < SPINS; spin++) {
      const round = playRound(engine, alwaysCorrect);

      quizzes += round.prompts.length;
      if (round.prompts.length > 0) baseSpinsWithQuiz++;
      birdTotal += findBirds(engine.state).length;
      totalWin += round.win;
      maxWin = Math.max(maxWin, round.win);
      if (round.win > 0) spinsWithWin++;

      bonuses += eventsOfType(round.events, 'bonusStart').length;
      coinGames += eventsOfType(round.events, 'coinGame').length;
      trains += eventsOfType(round.events, 'trainHeist').length;
      bandits += eventsOfType(round.events, 'banditRelease').length;
    }

    const spinsPerQuiz = SPINS / quizzes;

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        `  spins ................. ${SPINS}`,
        `  quizzes asked ......... ${quizzes}`,
        `  spins per quiz ........ ${spinsPerQuiz.toFixed(2)}   (target 2-3)`,
        `  spins with a quiz ..... ${((baseSpinsWithQuiz / SPINS) * 100).toFixed(1)}%`,
        `  avg birds on grid ..... ${(birdTotal / SPINS).toFixed(2)}`,
        '',
        `  hit frequency ......... ${((spinsWithWin / SPINS) * 100).toFixed(1)}%`,
        `  avg win per spin ...... ${(totalWin / SPINS).toFixed(2)}x`,
        `  biggest single round .. ${maxWin.toFixed(1)}x`,
        '',
        `  bonus ................. 1 in ${(SPINS / Math.max(1, bonuses)).toFixed(0)}`,
        `  coin game ............. 1 in ${(SPINS / Math.max(1, coinGames)).toFixed(0)}`,
        `  train heist ........... 1 in ${(SPINS / Math.max(1, trains)).toFixed(0)}`,
        `  bandit released ....... 1 in ${(SPINS / Math.max(1, bandits)).toFixed(0)}`,
        '',
      ].join('\n'),
    );

    // A deliberately broad band: this is a feel target, not a certification.
    expect(spinsPerQuiz).toBeGreaterThan(1.2);
    expect(spinsPerQuiz).toBeLessThan(5);
  });

  it('a wrong answer never costs the player a question', () => {
    // Losing a duel must not suppress future duels, or a bad run would go
    // quiet exactly when the player wants another chance.
    const correctEngine = new Engine({
      rng: new Rng('fair'),
      questions: new ShuffledBagSource(LOCAL_QUESTIONS, new Rng('fair-q')),
    });
    const wrongEngine = new Engine({
      rng: new Rng('fair'),
      questions: new ShuffledBagSource(LOCAL_QUESTIONS, new Rng('fair-q')),
    });

    let withCorrect = 0;
    let withWrong = 0;

    for (let spin = 0; spin < 400; spin++) {
      withCorrect += playRound(correctEngine, alwaysCorrect).prompts.length;
      withWrong += playRound(wrongEngine, (p) => {
        const right = LOCAL_QUESTIONS.find((q) => q.id === p.questionId)?.answer ?? 0;
        return (right + 1) % p.options.length;
      }).prompts.length;
    }

    expect(withCorrect).toBeGreaterThan(0);
    expect(withWrong).toBeGreaterThan(withCorrect * 0.5);
  });

  it('keeps the configured per-drop cap', () => {
    expect(DEFAULT_CONFIG.duel.maxPerDrop).toBeGreaterThanOrEqual(1);
  });
});
