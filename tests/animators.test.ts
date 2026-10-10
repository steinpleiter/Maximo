import { describe, expect, it, vi } from 'vitest';
import { playEvent, type AnimatorHooks } from '../src/render/animators';

vi.mock('../src/render/tween', () => ({
  delay: () => Promise.resolve(),
  all: (tasks: Promise<void>[]) => Promise.all(tasks),
  stagger: async <T>(items: T[], _gap: number, run: (item: T) => Promise<void>) => {
    for (const item of items) await run(item);
  },
}));

function hooks(): AnimatorHooks {
  return {
    board: {} as AnimatorHooks['board'],
    refit: vi.fn(), setLevels: vi.fn(), bumpLevel: vi.fn(), addWin: vi.fn(),
    banner: vi.fn(), setBonus: vi.fn(), setCageOpen: vi.fn(),
    setMeter: vi.fn().mockResolvedValue(undefined), releaseMeter: vi.fn().mockResolvedValue(undefined),
    nextDrop: vi.fn(), addDrops: vi.fn(), setScatters: vi.fn(),
    showBonus: vi.fn().mockResolvedValue(undefined), celebrate: vi.fn().mockResolvedValue(undefined),
  };
}

describe('feature presentation sequencing', () => {
  it('waits for the bonus entrance before the tape can continue', async () => {
    const h = hooks();
    let start!: () => void;
    h.showBonus = vi.fn(() => new Promise<void>(resolve => { start = resolve; }));
    let finished = false;
    const event = playEvent({ t: 'bonusStart', drops: 5, isSuper: true }, h).then(() => { finished = true; });
    await Promise.resolve();
    expect(h.setBonus).toHaveBeenCalledWith(5, true);
    expect(h.showBonus).toHaveBeenCalledWith(5, true);
    expect(finished).toBe(false);
    start();
    await event;
    expect(finished).toBe(true);
  });

  it('presents exact event amounts without changing winnings', async () => {
    const h = hooks();
    await playEvent({ t: 'win', amount: 0.018, total: 0.09 }, h);
    await playEvent({ t: 'roundEnd', win: 0.09 }, h);
    expect(h.addWin).toHaveBeenCalledWith(0.018, 0.09);
    expect(h.celebrate).toHaveBeenCalledWith(0.09, 'round');
  });

  it('updates meter, scatters and retriggers from event snapshots', async () => {
    const h = hooks();
    await playEvent({ t: 'meter', value: 9, size: 30 }, h);
    await playEvent({ t: 'scatters', count: 3, superCount: 1 }, h);
    await playEvent({ t: 'bonusDropAwarded', drops: 2 }, h);
    expect(h.setMeter).toHaveBeenCalledWith(9, 30);
    expect(h.setScatters).toHaveBeenCalledWith(3, 1);
    expect(h.addDrops).toHaveBeenCalledWith(2);
  });

  it('closes the bonus counter and presents the recorded bonus total', async () => {
    const h = hooks();
    await playEvent({ t: 'bonusEnd', totalWin: 74.12 }, h);
    expect(h.setBonus).toHaveBeenCalledWith(null, false);
    expect(h.celebrate).toHaveBeenCalledWith(74.12, 'bonus');
  });
});
