/**
 * Soft, synthesized sound effects. No external audio files.
 * Framework-agnostic so it can be reused on web and (later) native web views.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private brushSrc: AudioBufferSourceNode | null = null;
  private brushGain: GainNode | null = null;
  private eraserSrc: AudioBufferSourceNode | null = null;
  private eraserGain: GainNode | null = null;
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

  /** Soft, low click/tap for taps like color selection (no shrill tone). */
  playClick(): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // low, rounded thump
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
    o.connect(g);
    g.connect(this.ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.start(t);
    o.stop(t + 0.11);
    // short muted noise tick for the "tap" texture
    if (this.noiseBuf) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900;
      bp.Q.value = 0.6;
      const ng = this.ctx.createGain();
      n.connect(bp);
      bp.connect(ng);
      ng.connect(this.ctx.destination);
      ng.gain.setValueAtTime(0.05, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      n.start(t);
      n.stop(t + 0.05);
    }
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

  /**
   * Build the persistent brush graph once and leave it running for the app's
   * lifetime. Creating/destroying nodes per stroke produced a click when a
   * looping buffer was stopped mid-cycle, and overlapping the old (still
   * stopping) source with a fresh one on a quick second stroke caused a harsh
   * burst. A single always-on, gain-gated graph avoids both.
   */
  private ensureBrush(): void {
    if (!this.ctx || this.brushSrc || !this.noiseBuf) return;
    const t = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.8;

    // Soft band of noise: high-pass off the rumble, low-pass off the hiss, so
    // it reads as gentle paper friction rather than a harsh scratch.
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 300;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1600;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); // silent until movement drives it

    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);

    this.brushSrc = src;
    this.brushGain = g;
  }

  startBrush(): void {
    if (!this.ctx || this.muted) return;
    this.ensureBrush();
  }

  /**
   * Set how loud the brush is, 0..1, driven by drawing speed. Uses
   * setTargetAtTime for an exponential attack/decay so it can never jump
   * instantly (which caused a harsh burst on the first touch while the
   * AudioContext was still resuming), and fades toward silence when the
   * stroke pauses.
   */
  setBrushLevel(level: number): void {
    if (!this.ctx || !this.brushGain || this.muted) return;
    const t = this.ctx.currentTime;
    const target = 0.006 + Math.max(0, Math.min(1, level)) * 0.055;
    const g = this.brushGain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(target, t, 0.04); // smooth rise
    g.setTargetAtTime(0.0015, t + 0.05, 0.15); // decay when movement stops
  }

  stopBrush(): void {
    if (!this.ctx || !this.brushGain) return;
    const t = this.ctx.currentTime;
    // Just fade the always-on graph to silence; the source keeps running so
    // there is never a stop-click or an overlapping second source.
    try {
      this.brushGain.gain.cancelScheduledValues(t);
      this.brushGain.gain.setTargetAtTime(0.0001, t, 0.03);
    } catch {
      /* ignore */
    }
  }

  /** Persistent eraser graph: lower and more muffled than the pencil, like a
   * soft rubbing on paper. Same always-on, gain-gated design as the brush. */
  private ensureEraser(): void {
    if (!this.ctx || this.eraserSrc || !this.noiseBuf) return;
    const t = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.55;

    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 150;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);

    src.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);

    this.eraserSrc = src;
    this.eraserGain = g;
  }

  startEraser(): void {
    if (!this.ctx || this.muted) return;
    this.ensureEraser();
  }

  setEraserLevel(level: number): void {
    if (!this.ctx || !this.eraserGain || this.muted) return;
    const t = this.ctx.currentTime;
    const target = 0.006 + Math.max(0, Math.min(1, level)) * 0.06;
    const g = this.eraserGain.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(target, t, 0.04);
    g.setTargetAtTime(0.0015, t + 0.05, 0.15);
  }

  stopEraser(): void {
    if (!this.ctx || !this.eraserGain) return;
    const t = this.ctx.currentTime;
    try {
      this.eraserGain.gain.cancelScheduledValues(t);
      this.eraserGain.gain.setTargetAtTime(0.0001, t, 0.03);
    } catch {
      /* ignore */
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (m) {
      this.stopBrush();
      this.stopEraser();
    }
  }
}
