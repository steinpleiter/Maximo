import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from '../src/render/audio';
vi.mock('../src/render/soundEffects', () => ({ SoundEffects: class { preload() {} setVolume() {} stop() {} dispose() {} play() {} } }));

class MockTrack {
  static all: MockTrack[] = [];
  loop = false;
  preload = '';
  dataset = {};
  paused = true;
  currentTime = 0;
  play = vi.fn(() => { this.paused = false; return Promise.resolve(); });
  pause = vi.fn(() => { this.paused = true; });
  removeAttribute = vi.fn();
  load = vi.fn();
  constructor(public src: string) { MockTrack.all.push(this); }
}
class MockContext {
  currentTime = 0;
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  createGain() { return { connect: vi.fn(), gain: { value: 0, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } }; }
  createMediaElementSource() { return { connect: vi.fn() }; }
}
let audio: GameAudio;
let doc: EventTarget & { hidden: boolean };
let storage: Map<string, string>;
beforeEach(() => {
  vi.useFakeTimers();
  MockTrack.all = [];
  storage = new Map();
  doc = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', doc);
  vi.stubGlobal('Audio', MockTrack);
  vi.stubGlobal('AudioContext', MockContext);
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});
afterEach(() => { audio?.dispose(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('background audio lifecycle', () => {
  it('does not start or preload before interaction', () => {
    audio = new GameAudio();
    expect(MockTrack.all).toHaveLength(2);
    for (const track of MockTrack.all) { expect(track.play).not.toHaveBeenCalled(); expect(track.loop).toBe(true); expect(track.preload).toBe('none'); }
  });
  it('starts base music, crossfades bonus then stops the old track', async () => {
    audio = new GameAudio();
    audio.unlock();
    expect(MockTrack.all[0].paused).toBe(false);
    audio.setMode('bonus');
    expect(MockTrack.all[1].paused).toBe(false);
    await vi.advanceTimersByTimeAsync(500);
    expect(MockTrack.all[0].paused).toBe(true);
    expect(MockTrack.all[1].paused).toBe(false);
  });
  it('remembers mute and volume, and stays silent on reload until enabled', () => {
    audio = new GameAudio(); audio.unlock(); audio.setVolume(0.6); audio.toggle();
    expect(MockTrack.all.every(t => t.paused)).toBe(true);
    audio.dispose();
    audio = new GameAudio();
    expect(audio.settings).toMatchObject({ muted: true, volume: 0.6, unlocked: false });
    audio.unlock();
    expect(MockTrack.all.every(t => t.paused)).toBe(true);
    audio.toggle();
    expect(audio.settings.muted).toBe(false);
    expect(MockTrack.all[2].paused).toBe(false);
  });
  it('pauses hidden tabs and resumes only the active track', async () => {
    audio = new GameAudio(); audio.unlock(); audio.setMode('bonus');
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockTrack.all.every(t => t.paused)).toBe(true);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
    expect(MockTrack.all[0].paused).toBe(true);
    expect(MockTrack.all[1].paused).toBe(false);
  });
  it('does not let a pending play restart after mute', async () => {
    audio = new GameAudio();
    let finish!: () => void;
    MockTrack.all[0].play.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    audio.unlock(); audio.toggle();
    MockTrack.all[0].paused = false; finish();
    await Promise.resolve();
    expect(MockTrack.all[0].paused).toBe(true);
  });
  it('lets a user retry blocked playback without rejecting gameplay', async () => {
    audio = new GameAudio();
    MockTrack.all[0].play.mockRejectedValueOnce(new Error('blocked'));
    audio.unlock();
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.settings).toMatchObject({ unlocked: false, unavailable: true });
    audio.toggle();
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.settings).toMatchObject({ unlocked: true, unavailable: false });
  });
  it('zero volume silences both tracks and cannot be revived by a pending fade', async () => {
    audio = new GameAudio(); audio.unlock(); audio.setMode('bonus'); audio.setVolume(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockTrack.all.every(t => t.paused)).toBe(true);
  });
});
