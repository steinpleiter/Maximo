import type { Board } from './board';
import { all, delay, stagger } from './tween';
import type { GameEvent, GemColor } from '../math/types';

/** Everything the animator needs from the surrounding game shell. */
export interface AnimatorHooks {
  board: Board;
  /** Called when the grid size changes, so the stage can refit. */
  refit(): void;
  setLevels(levels: Record<GemColor, number>): void;
  bumpLevel(color: GemColor, to: number): void;
  setMeter(value: number, size: number): void;
  setReleases(count: number): void;
  addWin(amount: number, total: number): void;
  banner(text: string, tone?: 'good' | 'bad'): void;
  setBonus(drops: number | null, isSuper: boolean): void;
  /** The rival is out of its cage (or back in it). */
  setCageOpen(open: boolean): void;
}

const AMBER = 0xe9a33a;
const RED = 0xe2614f;

/**
 * Plays a single engine event.
 *
 * The engine has already decided everything; this only decides how long the
 * player watches it happen. Each case awaits its own animation, so the tape
 * plays in order and `await` is the whole sequencing mechanism.
 */
export async function playEvent(ev: GameEvent, hooks: AnimatorHooks): Promise<void> {
  const { board } = hooks;

  switch (ev.t) {
    case 'roundStart': {
      board.resize(ev.cols, ev.rows, ev.trainCells);
      hooks.refit();
      hooks.setLevels(ev.gemLevels);
      hooks.setMeter(ev.meter, ev.meterSize);
      board.sync([], ev.gemLevels);

      // Rain the whole board in, column by column, so a fresh drop reads.
      const byColumn = new Map<number, typeof ev.cells>();
      for (const snap of ev.cells) {
        if (!snap.cell) continue;
        const list = byColumn.get(snap.c) ?? [];
        list.push(snap);
        byColumn.set(snap.c, list);
      }

      await stagger([...byColumn.keys()].sort((a, b) => a - b), 28, async (col) => {
        const column = byColumn.get(col) ?? [];
        await all(
          column.map((snap, i) =>
            board.dropIn(snap.r, snap.c, snap.cell!, 2 + (column.length - i) * 0.35),
          ),
        );
      });
      return;
    }

    case 'refill':
      await stagger(ev.cells, 14, (snap) =>
        snap.cell ? board.dropIn(snap.r, snap.c, snap.cell, 2) : Promise.resolve(),
      );
      return;

    case 'gravity': {
      // Resolve every id before anything moves: the move list is in the
      // engine's pre-gravity coordinates, and animating one move at a time
      // would let a later lookup read a cell that has already been claimed.
      const moves = ev.moves.map((m) => ({ id: board.idAt(m.from.r, m.from.c), to: m.to }));
      await all(moves.map((m) => board.moveTo(m.id, m.to.r, m.to.c)));
      return;
    }

    case 'collect': {
      const tint = board.colorFor(ev.color);
      const eatenAt = new Map(ev.eaten.map((e) => [`${e.pos.r},${e.pos.c}`, e]));

      // The collector walks its trail, swallowing each symbol as it arrives.
      for (const step of ev.path.slice(1)) {
        const eaten = eatenAt.get(`${step.r},${step.c}`);
        if (eaten) await board.pop(eaten.cell.id, 130);
        await board.moveTo(ev.birdId, step.r, step.c, 110);
      }

      // Anything the walk reported but did not step over (it should be nothing,
      // but the tape is the source of truth, not our reading of it).
      const leftovers = ev.eaten.filter(
        (e) => !ev.path.some((p) => p.r === e.pos.r && p.c === e.pos.c),
      );
      if (leftovers.length > 0) {
        await all(leftovers.map((e) => board.pop(e.cell.id, 120)));
      }

      if (ev.win > 0) await board.ring(lastPos(ev.path).r, lastPos(ev.path).c, tint, 70);
      return;
    }

    case 'gemUpgrade': {
      hooks.bumpLevel(ev.color, ev.to);
      const touched = board.refreshGems(ev.color, levelsWith(board, ev.color, ev.to));
      hooks.banner(`${ev.color} gems level ${ev.to}`, 'good');
      await all(touched.slice(0, 24).map((v) => board.pulse(v.cellId, 200)));
      return;
    }

    case 'transform':
      await all(
        ev.cells.map(async (pos) => {
          const id = board.idAt(pos.r, pos.c);
          board.reskin({ id, kind: 'gem', color: ev.color });
          await board.pulse(id, 180);
        }),
      );
      return;

    case 'meter':
      hooks.setMeter(ev.value, ev.size);
      return;

    case 'meterRelease':
      hooks.banner('Feature release', 'good');
      hooks.setReleases(0);
      await stagger(ev.cells, 70, async (snap) => {
        if (!snap.cell) return;
        board.remove(board.idAt(snap.r, snap.c));
        await board.dropIn(snap.r, snap.c, snap.cell, 0.6);
        await board.pulse(snap.cell.id, 160);
      });
      return;

    case 'duelStart': {
      await board.dim(true);
      await all(
        ev.birds.map(async (b) => {
          await board.highlight(b.id, true);
          await board.ring(b.pos.r, b.pos.c, b.isBandit ? RED : board.colorFor(b.color), 80);
        }),
      );
      return;
    }

    case 'quizAsked':
      // The modal is opened by the runner; nothing to draw here.
      return;

    case 'quizAnswered':
      hooks.banner(ev.correct ? 'Correct — showdown!' : 'Wrong — they stand down', ev.correct ? 'good' : 'bad');
      await board.dim(false);
      return;

    case 'showdown': {
      await all(ev.shots.map((shot) => board.shot(shot.from, shot.cells, AMBER)));
      await all(ev.destroyed.map((d) => board.pop(d.cell.id, 150)));
      return;
    }

    case 'duelFizzle':
      await board.shake(240);
      return;

    case 'collectorMove': {
      // A collector swaps with whatever was standing in its way.
      const swaps = ev.moves.map((m) => ({
        mover: board.idAt(m.from.r, m.from.c),
        displaced: board.idAt(m.to.r, m.to.c),
        from: m.from,
        to: m.to,
      }));
      await all(
        swaps.flatMap((s) => [
          board.moveTo(s.mover, s.to.r, s.to.c, 220),
          s.displaced >= 0 ? board.moveTo(s.displaced, s.from.r, s.from.c, 220) : Promise.resolve(),
        ]),
      );
      return;
    }

    case 'switcheroo': {
      const a = board.idAt(ev.a.r, ev.a.c);
      const b = board.idAt(ev.b.r, ev.b.c);
      await all([board.moveTo(a, ev.b.r, ev.b.c, 240), board.moveTo(b, ev.a.r, ev.a.c, 240)]);
      return;
    }

    case 'banditRelease':
      hooks.setCageOpen(true);
      hooks.banner('The rival is loose', 'bad');
      await board.ring(ev.pos.r, ev.pos.c, RED, 180);
      return;

    case 'banditDuelResult':
      if (ev.banditWon) {
        hooks.banner('The rival wins that one', 'bad');
      } else {
        hooks.setCageOpen(false);
        hooks.banner(`Loot recovered: ${ev.payout.toFixed(2)}x`, 'good');
      }
      await delay(200);
      return;

    case 'dynamite':
      await board.ring(ev.pos.r, ev.pos.c, RED, 240);
      await all(ev.destroyed.map((pos) => board.pop(board.idAt(pos.r, pos.c), 140)));
      return;

    case 'gridExpand':
      hooks.banner('The grid grows');
      board.resize(ev.cols, ev.rows);
      hooks.refit();
      await delay(180);
      return;

    case 'trainHeist':
      hooks.banner(`Train heist — ${ev.laps} lap${ev.laps === 1 ? '' : 's'}`, 'good');
      await board.trainSweep();
      await stagger(ev.awarded, 80, async (snap) => {
        if (!snap.cell) return;
        board.remove(board.idAt(snap.r, snap.c));
        await board.dropIn(snap.r, snap.c, snap.cell, 0.6);
      });
      return;

    case 'coinGame':
      hooks.banner('Coin game!', 'good');
      await stagger(ev.picks, 150, async (pick) => {
        const color = pick.kind === 'coin' ? AMBER : RED;
        await board.ring(pick.pos.r, pick.pos.c, color, 110);
      });
      await delay(220);
      return;

    case 'scatters':
      return;

    case 'bonusStart':
      hooks.setBonus(ev.drops, ev.isSuper);
      hooks.banner(ev.isSuper ? `Super bonus — ${ev.drops} drops` : `Bonus — ${ev.drops} drops`, 'good');
      await delay(500);
      return;

    case 'bonusDropAwarded':
      hooks.banner(`+${ev.drops} drop`, 'good');
      await delay(160);
      return;

    case 'bonusEnd':
      hooks.setBonus(null, false);
      hooks.banner(`Bonus total ${ev.totalWin.toFixed(2)}x`, 'good');
      await delay(600);
      return;

    case 'win':
      hooks.addWin(ev.amount, ev.total);
      return;

    case 'roundEnd':
      return;

    default: {
      // Exhaustiveness: a new event type should fail to compile here, not go
      // quietly unanimated.
      const never: never = ev;
      void never;
      return;
    }
  }
}

function lastPos<T>(list: readonly T[]): T {
  return list[list.length - 1];
}

function levelsWith(board: Board, color: GemColor, to: number): Record<GemColor, number> {
  const levels = { ...board.levels };
  levels[color] = to;
  return levels;
}
