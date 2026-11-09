export class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private soundBuffers: AudioBuffer[] = [];
  private isLoading = false;
  private baseAssetPath = './assets';

  constructor() {
    // Lazily initialized on first user gesture
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  public async load(baseAssetPath?: string): Promise<void> {
    if (baseAssetPath) {
      this.baseAssetPath = baseAssetPath;
    }
    if (this.soundBuffers.length > 0 || this.isLoading) return;
    this.isLoading = true;

    try {
      const ctx = this.initContext();
      if (!ctx) {
        this.isLoading = false;
        return;
      }

      // Minecraft authentic item.book.page_turn sound variants (open_flip1, open_flip2, open_flip3)
      const variants = ['open_flip1', 'open_flip2', 'open_flip3'];
      const loaded: AudioBuffer[] = [];

      for (const name of variants) {
        try {
          let resp = await fetch(`${this.baseAssetPath}/sounds/${name}.ogg`);
          if (!resp.ok) {
            resp = await fetch(`${this.baseAssetPath}/sounds/${name}.mp3`);
          }
          if (resp.ok) {
            const arrayBuffer = await resp.arrayBuffer();
            const decoded = await ctx.decodeAudioData(arrayBuffer);
            if (decoded) {
              loaded.push(decoded);
            }
          }
        } catch {
          // Fall through to synthesis if network or decoding is unavailable
        }
      }

      if (loaded.length > 0) {
        this.soundBuffers = loaded;
      }
    } catch {
      // Audio decoding or context unavailable
    } finally {
      this.isLoading = false;
    }
  }

  private initContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Plays the authentic Minecraft book page turn sound (SoundEvents.ITEM_BOOK_PAGE_TURN).
   * Randomly selects one of the 3 open_flip variants with slight pitch variation.
   */
  public playPageTurn(): void {
    if (!this.enabled) return;

    try {
      const ctx = this.initContext();
      if (!ctx) return;

      if (this.soundBuffers.length === 0 && !this.isLoading) {
        this.load().catch(() => {});
      }

      if (this.soundBuffers.length > 0) {
        // Authentic Minecraft behavior: randomly pick one of open_flip1, open_flip2, open_flip3
        const buffer = this.soundBuffers[Math.floor(Math.random() * this.soundBuffers.length)];
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // Subtle natural pitch variation: 0.96 to 1.04
        const pitch = 0.96 + Math.random() * 0.08;
        source.playbackRate.setValueAtTime(pitch, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.85, ctx.currentTime);

        source.connect(gain);
        gain.connect(ctx.destination);

        source.start(0);
        return;
      }

      // High-fidelity fallback synthesis when audio files are not loaded or in offline tests
      this.playSynthesizedPageTurn(ctx);
    } catch {
      // Audio playback failed or blocked by autoplay policy
    }
  }

  private playSynthesizedPageTurn(ctx: AudioContext): void {
    const now = ctx.currentTime;

    // 1. Dual-layer filtered white noise for soft parchment friction
    const duration = 0.16;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.6));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.07);
    filter.frequency.exponentialRampToValueAtTime(1200, now + duration);
    filter.Q.setValueAtTime(2.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + duration);

    // 2. Gentle page edge release click
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(450, now + 0.04);
    snapOsc.frequency.exponentialRampToValueAtTime(120, now + 0.08);

    snapGain.gain.setValueAtTime(0.001, now + 0.04);
    snapGain.gain.linearRampToValueAtTime(0.12, now + 0.045);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);

    snapOsc.start(now + 0.04);
    snapOsc.stop(now + 0.08);
  }

  /**
   * Synthesizes a soft, magical twinkling chime.
   */
  public playWink(): void {
    if (!this.enabled) return;

    try {
      const ctx = this.initContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.12); // E6

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Audio playback failed or blocked by autoplay policy
    }
  }

  /**
   * Synthesizes a crisp Minecraft UI button click sound.
   */
  public playButtonClick(): void {
    if (!this.enabled) return;

    try {
      const ctx = this.initContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Audio playback failed or blocked by autoplay policy
    }
  }
}

export const soundManager = new SoundManager();
