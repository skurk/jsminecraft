/** Procedurally synthesised sound effects, so the game ships no audio assets. */
export class Sfx {
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  /** Browsers only allow audio after a gesture, so call this from a click or key press. */
  unlock(): void {
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
  }

  /** A bright hiss of breaking panes followed by a few falling shards. */
  glassBreak(): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    this.shatter(ctx, now);
    for (let i = 0; i < 4; i++) {
      this.tinkle(ctx, now + 0.03 + i * 0.045 + Math.random() * 0.03);
    }
  }

  /** Soft muffled "pff" of a crop being torn up. */
  cropBreak(): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0004, now + 0.15);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(now);
    source.stop(now + 0.18);
  }

  private shatter(ctx: AudioContext, at: number): void {
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2400, at);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, at);
    gain.gain.exponentialRampToValueAtTime(0.0008, at + 0.26);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(at);
    source.stop(at + 0.3);
  }

  private tinkle(ctx: AudioContext, at: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1900 + Math.random() * 2500, at);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, at);
    gain.gain.exponentialRampToValueAtTime(0.0005, at + 0.13);

    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.15);
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const length = Math.floor(ctx.sampleRate * 0.3);
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }
}
