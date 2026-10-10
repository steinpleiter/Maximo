# Writing questions

All questions live in `src/quiz/questions.json`. Edit that one file; nothing
else needs to change.

```json
{
  "id": "geo-014",
  "category": "Geography",
  "difficulty": 2,
  "question": "Which river flows through Vienna?",
  "options": ["Rhine", "Danube", "Elbe", "Seine"],
  "answer": 1
}
```

| Field | Rule |
| --- | --- |
| `id` | Unique across the bank. The prefix is only a convention. |
| `category` | Free text. Shown above the question and tracked in the player's record. |
| `difficulty` | `1` easy, `2` medium, `3` hard. |
| `question` | One sentence. It is rendered as text, so punctuation and quotes are safe. |
| `options` | Exactly **4**. |
| `answer` | Index into `options`, `0`–`3`. |

## Check your work

```
npm test
```

The suite validates the whole bank: duplicate ids, wrong option counts,
out-of-range answer indices, blank or duplicated option text, and difficulties
outside 1–3. It also checks the correct answer is not always in the same slot,
which would make the game trivially gameable.

## How questions are chosen

A **shuffled bag**: the bank is shuffled, questions are dealt one at a time, and
nothing repeats until the bag is empty — then it reshuffles. With ~70 questions
a session will not feel repetitive; with 15 it will.

Bigger stand-offs ask harder questions: two birds draw difficulty 1, three draw
2, four or more draw 3. If the bag has no question left at the requested
difficulty it quietly deals any question rather than stalling a duel. Turn the
scaling off with `quiz.scaleDifficultyWithDuelSize` in
`src/config/gameConfig.ts`.

## Using a different source

The game only ever talks to the `QuestionSource` interface in
`src/quiz/source.ts`:

```ts
interface QuestionSource {
  next(request?: { difficulty?: number }): Question;
  size(): number;
}
```

To fetch from an API instead, implement that interface and pass it when the
engine is constructed in `src/game.ts`. Because `next()` is synchronous, a
remote source needs to prefetch into a local buffer — a duel cannot wait on a
network round trip without stalling the round.

## A note on the answer

The engine never tells its host which option is correct; the `QuizPrompt` it
yields carries only the question and the options. The shell looks the answer up
from the bank to colour the reveal. That split is deliberate: it is what would
let the math move to a server later without handing the client a cheat sheet.
If you add a remote source, keep it.
