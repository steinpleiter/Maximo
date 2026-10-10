# Maximo

A collector-grid slot game where **every duel is gated behind a quiz question**.

Four birds perch on a 6×7 grid and eat the gems of their own colour. When two
or more end up next to each other they square up — and a question appears.
Answer correctly and the showdown fires: they shoot along rows, columns and
diagonals, clearing gems, banking coins and features, and lighting any dynamite
in the way. Answer wrong and they stand down.

Duels are tuned to fire roughly **once every two spins**, so the quiz is the
heartbeat of a session rather than a rare bonus.

```
npm install
npm run dev      # play it
npm test         # math + quiz suites
npm run build    # typecheck + production build
```

## What is where

```
src/
  config/
    gameConfig.ts     THE tuning file — every rate, weight and limit
    paytable.ts       gem ladder, payout scale, coin values
  math/               pure TypeScript, no DOM, no imports from render/
    engine.ts         playRound() — the resumable generator
    collect.ts        the collection mechanic: bird pathing
    duel.ts           duel detection, the quiz gate, shot geometry
    grid.ts           gravity, refill, bird placement, grid growth
    bandit.ts  train.ts  coinGame.ts  meter.ts  specials.ts
  quiz/
    questions.json    the question bank — see QUIZ.md
    selector.ts       shuffled bag, no repeats
  render/             PixiJS board + DOM chrome
    animators.ts      one engine event -> one animation
    board.ts          symbol pool, drops, pops, shot lines
    ui/               HUD, quiz modal, panels, dev tools
  game.ts             the session: money, bet, the round loop
tests/                vitest
```

**Docs:** [`ASSETS.md`](ASSETS.md) — swapping in your own art ·
[`QUIZ.md`](QUIZ.md) — writing questions

## The one architectural idea

A duel needs player input *in the middle of a round*, so the engine is not a
function that returns a finished result. It is a **resumable generator**:

```ts
const round = engine.playRound();
let step = round.next();

while (!step.done) {
  await animate(step.value.events);
  step = step.value.quiz
    ? round.next(await askTheQuestion(step.value.quiz))
    : round.next(undefined);
}
```

The engine runs the whole round — cascades, duels, the bandit, the train, the
coin game, every free drop — and stops only to ask a question. Everything else
follows from that:

- the math runs headless in Node, so both answer branches are testable;
- a round replays exactly from `(seed, answers[])`;
- turbo is just playing the tape faster, and the quiz is the natural pause;
- the math could move server-side without the renderer noticing.

## Tuning

Everything lives in `src/config/gameConfig.ts`. The model is tuned by feel, not
against an RTP target. The knobs that matter most:

| Knob | Effect |
| --- | --- |
| `duel.chanceTwoAdjacent` | How often two touching birds draw a question |
| `birds.clusterBias` | How strongly birds land near each other |
| `weights.birdRate` | How many birds are on the grid at all |
| `duel.maxPerDrop` | Ceiling on bird-vs-bird quizzes per drop |
| `PAYOUT_SCALE` (`paytable.ts`) | Global scale on gem payouts |

`npm test` prints a measured report so a change can be checked rather than
guessed at:

```
spins ................. 4000
spins per quiz ........ 2.00   (target 2-3)
avg birds on grid ..... 2.80
hit frequency ......... 95.9%
avg win per spin ...... 1.13x
bonus ................. 1 in 571
coin game ............. 1 in 444
train heist ........... 1 in 182
bandit released ....... 1 in 34
```

## Where this came from, and where it departs

The mechanics are modelled on ELK Studios' **Pirots 3** — 6×7 grid, collector
birds, cluster-free collection, seven-level gem upgrades, dynamite that grows
the grid toward 7×8, the caged bandit, the train heist, the coin game, and free
drops that keep grid size, meter and upgrades across the whole bonus.

Deliberate departures, all of them reasoned in comments at the point of change:

- **Quiz duels.** The whole point. Not in the original.
- **Duels are far more frequent**, with more birds on the grid and spawns biased
  to cluster.
- **Showdown shots do not pay for the gems they clear** (`duel.shotsPayGems`).
  Paying them roughly doubled the game's return.
- **A global `PAYOUT_SCALE`** on gem payouts. The published ladder is kept
  intact as the shape of the progression, but with this many birds, collections
  land on nearly every spin; unscaled, the balance only ever climbs.
- **The coin game accepts a nearly-swept grid** (`coinGame.clearThreshold`),
  because an exact sweep is close to unreachable here and the feature would
  otherwise be dead.
- **Bandit duels ignore the per-drop quiz cap**, so the bandit can work through
  all four birds — the run that triggers the coin game.
- **Bandit duel outcomes are decided by the quiz** — correct means the bird wins
  and claims the loot. Set `duel.quizDecidesBanditDuel: false` for a coin flip.

Mechanics are not protectable, but the Pirots name, art and characters are:
there is no ELK branding anywhere in this codebase, and the placeholder art is
original. Keep it that way when you add your own.
