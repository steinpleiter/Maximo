// This loop is the supplied music000 track trimmed at exactly 00:34.
import baseMusic from '../../assets/audio/music000-background.mp3?url';
import bonusMusic from '../../assets/audio/music001.mp3?url';
import { SoundEffects, type EffectCue } from './soundEffects';
import cueManifest from '../../assets/audio/cues.json';

const effectFiles = import.meta.glob('/assets/audio/cues/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const effectUrls = Object.fromEntries(Object.entries(effectFiles).map(([path, url]) => [path.split('/').pop()!, url]));
export type SoundCue = keyof typeof cueManifest.cues;

export type MusicMode = 'base' | 'bonus';
const SETTINGS_KEY = 'maximo.audio.v1';
const FADE_SECONDS = 0.45;

/** Streaming music, started only by a user gesture. Never holds up gameplay. */
export class GameAudio {
  private context: AudioContext | null = null;
  private readonly tracks: Record<MusicMode, HTMLAudioElement>;
  private readonly gains = new Map<MusicMode, GainNode>();
  private mode: MusicMode = 'base';
  private unlocked = false;
  private disposed = false;
  private version = 0;
  private fadeTimer: ReturnType<typeof setTimeout> | undefined;
  private muted = false;
  private volume = 0.3;
  private unavailable = false;
  private effects: SoundEffects | null = null;
  private effectCues: Record<string, EffectCue> = cueManifest.cues;
  private effectUrls: Record<string, string> = effectUrls;

  constructor(private readonly onChange: () => void = () => undefined) {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
      if (typeof saved?.muted === 'boolean') this.muted = saved.muted;
      if (typeof saved?.volume === 'number' && Number.isFinite(saved.volume)) this.volume = Math.min(1, Math.max(0, saved.volume));
    } catch { /* Browser storage may be unavailable. */ }
    this.tracks = { base: this.track(baseMusic, 'base'), bonus: this.track(bonusMusic, 'bonus') };
    window.addEventListener('pointerdown', this.onGesture, true);
    window.addEventListener('keydown', this.onGesture, true);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onVisibility);
  }

  get settings(): { muted: boolean; volume: number; unlocked: boolean; unavailable: boolean } {
    return { muted: this.muted, volume: this.volume, unlocked: this.unlocked, unavailable: this.unavailable };
  }

  cue(id: SoundCue, maxSeconds?: number): void {
    if (this.unlocked && !this.muted && this.volume > 0 && !document.hidden) this.effects?.play(id, maxSeconds);
  }

  private track(url: string, mode: MusicMode): HTMLAudioElement {
    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'none';
    audio.dataset.music = mode;
    return audio;
  }

  /** Called synchronously inside the click/key handler to satisfy autoplay rules. */
  unlock(): void {
    if (this.disposed || this.muted || document.hidden) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        for (const mode of ['base', 'bonus'] as const) {
          const gain = this.context.createGain();
          gain.gain.value = 0;
          this.context.createMediaElementSource(this.tracks[mode]).connect(gain);
          gain.connect(this.context.destination);
          this.gains.set(mode, gain);
        }
        if (Object.keys(this.effectCues).length > 0) {
          this.effects = new SoundEffects(this.context, this.effectCues, this.effectUrls);
          this.effects.preload();
        }
      }
      // Both calls happen in the gesture, before any await or network work.
      void this.context.resume().catch(() => {
        if (this.disposed) return;
        this.unlocked = false;
        this.onChange();
      });
      this.unlocked = true;
      this.unavailable = false;
      this.sync();
      this.onChange();
    } catch {
      this.unavailable = true;
      this.onChange();
    }
  }

  toggle(): void {
    // First click on the sound control enables sound instead of muting an
    // already silent, gesture-locked page.
    if (!this.unlocked && !this.muted) this.unlock();
    else {
      this.muted = !this.muted;
      this.persist();
      if (!this.muted) this.unlock();
      else this.sync();
    }
    this.onChange();
  }

  setVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    this.volume = Math.min(1, Math.max(0, value));
    this.persist();
    if (!this.unlocked) this.unlock();
    else this.sync();
    this.onChange();
  }

  setMode(mode: MusicMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.sync();
  }

  private persist(): void {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: this.muted, volume: this.volume })); }
    catch { /* Preferences are optional. */ }
  }

  private readonly onGesture = (event: Event): void => {
    if (event.target instanceof Element && event.target.closest('#audio-controls')) return;
    if (event instanceof KeyboardEvent && (event.repeat || ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key))) return;
    if (!this.unlocked) this.unlock();
  };

  private readonly onVisibility = (): void => { this.sync(); };
  private readonly onPageHide = (): void => { this.silence(); };

  private silence(): void {
    this.effects?.stop();
    this.version++;
    clearTimeout(this.fadeTimer);
    for (const track of Object.values(this.tracks)) track.pause();
    if (this.context) {
      for (const gain of this.gains.values()) {
        gain.gain.cancelScheduledValues(this.context.currentTime);
        gain.gain.setValueAtTime(0, this.context.currentTime);
      }
    }
  }

  private sync(): void {
    if (this.disposed || !this.unlocked || this.muted || this.volume === 0 || document.hidden || !this.context) {
      this.silence();
      return;
    }
    clearTimeout(this.fadeTimer);
    const version = ++this.version;
    this.effects?.setVolume(this.volume);
    const current = this.tracks[this.mode];
    const otherMode = this.mode === 'base' ? 'bonus' : 'base';
    const other = this.tracks[otherMode];
    // Stale play promises must not revive a muted, hidden or switched track.
    void current.play().then(() => {
      if (this.disposed || this.muted || document.hidden || this.volume === 0 || current !== this.tracks[this.mode]) current.pause();
      if (version !== this.version) return;
      this.unavailable = false;
      this.onChange();
    }).catch(() => {
      if (version !== this.version || this.disposed) return;
      this.unlocked = false;
      this.unavailable = true;
      this.silence();
      this.onChange();
    });
    const now = this.context.currentTime;
    for (const mode of ['base', 'bonus'] as const) {
      const param = this.gains.get(mode)!.gain;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(mode === this.mode ? this.volume : 0, now + FADE_SECONDS);
    }
    this.fadeTimer = setTimeout(() => {
      if (version === this.version) other.pause();
    }, FADE_SECONDS * 1000 + 30);
  }

  dispose(): void {
    this.disposed = true;
    this.silence();
    this.effects?.dispose();
    window.removeEventListener('pointerdown', this.onGesture, true);
    window.removeEventListener('keydown', this.onGesture, true);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('pageshow', this.onVisibility);
    for (const track of Object.values(this.tracks)) {
      track.removeAttribute('src');
      track.load();
    }
    void this.context?.close().catch(() => undefined);
  }
}
