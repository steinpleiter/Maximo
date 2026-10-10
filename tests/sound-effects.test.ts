import { afterEach, describe, expect, it, vi } from 'vitest';
import { SoundEffects } from '../src/render/soundEffects';

function setup() {
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const context = {
    state: 'running', currentTime: 0, destination: {},
    createGain: () => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() }),
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 0.6 }),
    createBufferSource: () => {
      const node = { buffer: null, start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), onended: null };
      sources.push(node); return node;
    },
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }));
  const effects = new SoundEffects(context as unknown as AudioContext, { collect: { file: 'collect.mp3', gain: .5 } }, { 'collect.mp3': '/collect.mp3' });
  return { effects, sources, context };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
afterEach(() => { vi.unstubAllGlobals(); });

describe('short effects playback', () => {
  it('decodes only once and rate-limits repeated cascade cues', async () => {
    const { effects, sources, context } = setup();
    effects.preload(); await flush();
    effects.play('collect'); effects.play('collect'); await flush();
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(sources).toHaveLength(1);
    expect(sources[0].start).toHaveBeenCalledOnce();
    effects.dispose();
  });
  it('cancels pending cues when sound is muted before decode finishes', async () => {
    const { effects, sources } = setup();
    effects.play('collect'); effects.stop(); await flush();
    expect(sources).toHaveLength(0);
    effects.dispose();
  });
  it('failed audio requests never reject the game loop', async () => {
    const { effects, sources } = setup();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    effects.play('collect'); await flush();
    expect(sources).toHaveLength(0);
    effects.dispose();
  });
});
