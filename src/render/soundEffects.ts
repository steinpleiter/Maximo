export interface EffectCue {
  file: string;
  gain: number;
}

/** Small decoded clips, bounded polyphony, and no delayed audio after mute. */
export class SoundEffects {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<string, Promise<AudioBuffer | null>>();
  private readonly active = new Set<AudioBufferSourceNode>();
  private readonly lastPlayed = new Map<string, number>();
  private generation = 0;
  private disposed = false;
  private readonly output: GainNode;

  constructor(
    private readonly context: AudioContext,
    private readonly cues: Record<string, EffectCue>,
    private readonly urls: Record<string, string>,
  ) {
    this.output = context.createGain();
    this.output.gain.value = 0.3;
    this.output.connect(context.destination);
  }

  setVolume(volume: number): void {
    this.output.gain.setTargetAtTime(volume, this.context.currentTime, 0.02);
  }

  preload(): void {
    for (const id of Object.keys(this.cues)) void this.load(id);
  }

  private load(id: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id);
    if (cached) return Promise.resolve(cached);
    const inFlight = this.loading.get(id);
    if (inFlight) return inFlight;
    const cue = this.cues[id];
    const url = cue && this.urls[cue.file];
    if (!url || this.disposed) return Promise.resolve(null);
    const task = fetch(url)
      .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('Audio unavailable')))
      .then(bytes => this.context.decodeAudioData(bytes))
      .then(buffer => {
        if (this.disposed) return null;
        this.buffers.set(id, buffer);
        return buffer;
      })
      .catch(() => null);
    this.loading.set(id, task);
    return task;
  }

  play(id: string, maxSeconds?: number): void {
    if (this.disposed || this.context.state !== 'running' || !this.cues[id]) return;
    const requested = performance.now();
    // A cascade can emit several near-identical events in turbo mode.
    if (requested - (this.lastPlayed.get(id) ?? -Infinity) < 120) return;
    this.lastPlayed.set(id, requested);
    const generation = this.generation;
    void this.load(id).then(buffer => {
      if (!buffer || this.disposed || generation !== this.generation || performance.now() - requested > 300) return;
      if (this.active.size >= 4) {
        const oldest = this.active.values().next().value!;
        oldest.stop();
        this.active.delete(oldest);
      }
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      // Tiny edge fades prevent clicks from short sprite cuts.
      const now = this.context.currentTime;
      const duration = Math.min(buffer.duration, maxSeconds ?? buffer.duration);
      const level = Math.min(1, Math.max(0, this.cues[id].gain));
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level, now + 0.008);
      gain.gain.setValueAtTime(level, now + Math.max(0.008, duration - 0.035));
      gain.gain.linearRampToValueAtTime(0, now + duration);
      source.connect(gain);
      gain.connect(this.output);
      source.onended = () => { this.active.delete(source); source.disconnect(); gain.disconnect(); };
      this.active.add(source);
      source.start(0, 0, duration);
    });
  }

  stop(): void {
    this.generation++;
    for (const source of this.active) source.stop();
    this.active.clear();
    this.lastPlayed.clear();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.output.disconnect();
    this.buffers.clear();
    this.loading.clear();
  }
}
