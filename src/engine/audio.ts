/**
 * Soft, synthesized sound effects. No external audio files.
 * Framework-agnostic so it can be reused on web and (later) native web views.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private brushSrc: AudioBufferSourceNode | null = null;
  muted = false;

  /** Lazily create / resume the AudioContext. Must run inside a user gesture. */
  ensure(): void {
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        this.ctx = new Ctor();
        const len = this.ctx.sampleRate * 1;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  blip(freq: number, dur: number, vol: number, type: OscillatorType = "sine"): void {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(this.ctx.destination);
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  playPop(): void {
    this.blip(540, 0.13, 0.1, "sine");
    this.blip(820, 0.1, 0.05, "sine");
  }

  playBubble(): void {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.connect(g);
    g.connect(this.ctx.destination);
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(720, t);
    o.frequency.exponentialRampToValueAtTime(210, t + 0.18);
    g.gain.setValueAtTime(0.13, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.start(t);
    o.stop(t + 0.22);
  }

  startBrush(): void {
    if (!this.ctx || this.muted || this.brushSrc || !this.noiseBuf) return;
    this.brushSrc = this.ctx.createBufferSource();
    this.brushSrc.buffer = this.noiseBuf;
    this.brushSrc.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 850;
    const g = this.ctx.createGain();
    g.gain.value = 0.028;
    this.brushSrc.connect(lp);
    lp.connect(g);
    g.connect(this.ctx.destination);
    this.brushSrc.start();
  }

  stopBrush(): void {
    if (this.brushSrc) {
      try {
        this.brushSrc.stop();
      } catch {
        /* already stopped */
      }
      this.brushSrc = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (m) this.stopBrush();
  }
}
