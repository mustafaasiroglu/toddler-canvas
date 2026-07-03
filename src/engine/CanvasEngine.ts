import { AudioEngine } from "./audio";
import { angle, centroid, clamp, dist, type Point } from "./geometry";

export type Tool = "none" | "paint" | "eraser";

interface EmojiBase {
  cx: number;
  cy: number;
  x: number;
  y: number;
  scale: number;
  rot: number;
  dist: number;
  ang: number;
}

interface EmojiObj {
  el: HTMLDivElement;
  glyph: HTMLSpanElement;
  x: number;
  y: number;
  scale: number;
  rot: number;
  pointers: Map<number, Point>;
  base: EmojiBase | null;
}

interface Segment {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export interface CanvasEngineOptions {
  /** Fired the very first time the user interacts, to dismiss any hint UI. */
  onFirstInteraction?: () => void;
  /** Fired when a freehand stroke begins, e.g. to auto-hide the palette. */
  onDrawStart?: () => void;
  /** Fired when the user taps empty space (no emoji) while idle/select mode. */
  onEmptyTap?: () => void;
  /** Fired when the app should leave paint mode for select (none) mode. */
  onSelectMode?: () => void;
}

const HALF = 48; // half of the 96px emoji box
const BRUSH = 16; // thick brush for little fingers
const ERASE = 46; // even thicker eraser

/**
 * Owns the interactive stage: freehand drawing, emoji stickers with
 * multi-touch move / pinch / rotate, and eraser tap-to-delete. Objects and
 * drawings always stack in the order they were added (newest on top).
 *
 * This module manipulates its own DOM subtree imperatively so the delicate
 * pointer/gesture logic stays fast and portable. React only mounts it.
 */
export class CanvasEngine {
  readonly audio = new AudioEngine();

  private stage: HTMLElement;
  private layer: HTMLDivElement; // holds emojis + drawing segments (add order = z order)
  private overlay: HTMLCanvasElement; // transparent pointer-capture surface on top
  private overlayCtx: CanvasRenderingContext2D;
  private eraserCursor: HTMLDivElement; // circle shown under the eraser

  private activeTool: Tool = "none";
  private currentColor = "#4aa3ff";
  private emojis: EmojiObj[] = [];
  private segments: Segment[] = [];
  private currentSeg: Segment | null = null;
  private strokes = new Map<number, Point>();
  private overlayEmoji = new Map<number, EmojiObj>(); // pointers dragging an emoji via the overlay
  private paintFirstPending = false; // first interaction after the brush is selected
  private pendingSelectMode = false; // switch to select (none) mode once this gesture ends
  private dpr = window.devicePixelRatio || 1;
  private prevCssW = window.innerWidth;
  private prevCssH = window.innerHeight;
  private firstTouch = false;

  private opts: CanvasEngineOptions;
  private resizeTimer: number | null = null;

  constructor(stage: HTMLElement, opts: CanvasEngineOptions = {}) {
    this.opts = opts;
    this.stage = stage;

    this.layer = document.createElement("div");
    this.layer.className = "stage-layer";

    this.overlay = document.createElement("canvas");
    this.overlay.className = "stage-input";
    this.overlayCtx = this.overlay.getContext("2d")!;

    this.eraserCursor = document.createElement("div");
    this.eraserCursor.className = "eraser-cursor";
    const ec = this.eraserCursor.style;
    ec.position = "absolute";
    ec.left = "0";
    ec.top = "0";
    ec.width = ERASE + "px";
    ec.height = ERASE + "px";
    ec.marginLeft = -(ERASE / 2) + "px";
    ec.marginTop = -(ERASE / 2) + "px";
    ec.borderRadius = "50%";
    ec.border = "1px solid rgba(120, 120, 120, 0.55)";
    ec.boxSizing = "border-box";
    ec.pointerEvents = "none";
    ec.display = "none";
    ec.zIndex = "60";

    this.stage.appendChild(this.layer);
    this.stage.appendChild(this.overlay);
    this.stage.appendChild(this.eraserCursor);

    this.sizeAll();

    // input overlay drawing/erasing
    this.overlay.addEventListener("pointerdown", this.onInputDown);
    this.overlay.addEventListener("pointermove", this.onInputMove);
    this.overlay.addEventListener("pointerup", this.onInputUp);
    this.overlay.addEventListener("pointercancel", this.onInputUp);

    // page-level guards + resize
    window.addEventListener("resize", this.onResize);
    window.addEventListener("orientationchange", this.onOrientation);
    this.stage.addEventListener("pointerdown", this.onStageDown);
  }

  /* ---------------- public API ---------------- */

  setTool(t: Tool): void {
    this.activeTool = t;
    this.paintFirstPending = t === "paint";
    if (t !== "paint") this.pendingSelectMode = false;
    const drawing = t === "paint" || t === "eraser";
    this.overlay.style.pointerEvents = drawing ? "auto" : "none";
    this.layer.style.pointerEvents = drawing ? "none" : "auto";
    if (!drawing) this.audio.stopBrush();
    if (t !== "eraser") {
      this.audio.stopEraser();
      this.hideEraserCursor();
    }
  }

  private moveEraserCursor(p: Point): void {
    const s = this.eraserCursor.style;
    s.display = "block";
    s.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  private hideEraserCursor(): void {
    this.eraserCursor.style.display = "none";
  }

  setColor(hex: string): void {
    this.currentColor = hex;
  }

  resume(): void {
    this.audio.ensure();
  }

  setMuted(m: boolean): void {
    this.audio.setMuted(m);
  }

  addEmoji(char: string, atX = window.innerWidth / 2, atY = window.innerHeight / 2): void {
    const el = document.createElement("div");
    el.className = "emoji";
    const glyph = document.createElement("span");
    glyph.className = "glyph pop";
    glyph.textContent = char;
    el.appendChild(glyph);

    const o: EmojiObj = {
      el,
      glyph,
      x: atX,
      y: atY,
      scale: 1.5,
      rot: 0,
      pointers: new Map(),
      base: null,
    };
    this.layer.appendChild(el); // appended last => on top of everything so far
    this.emojis.push(o);
    this.applyTransform(o);
    this.sealSegment(); // next stroke starts a fresh layer above this emoji
    this.audio.playPop();
    window.setTimeout(() => glyph.classList.remove("pop"), 420);

    el.addEventListener("pointerdown", (e) => this.onEmojiDown(o, e));
    el.addEventListener("pointermove", (e) => this.onEmojiMove(o, e));
    el.addEventListener("pointerup", (e) => this.onEmojiUp(o, e));
    el.addEventListener("pointercancel", (e) => this.onEmojiUp(o, e));
  }

  clear(): void {
    for (let i = this.emojis.length - 1; i >= 0; i--) this.emojis[i].el.remove();
    this.emojis.length = 0;
    for (const s of this.segments) s.canvas.remove();
    this.segments.length = 0;
    this.currentSeg = null;
  }

  destroy(): void {
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("orientationchange", this.onOrientation);
    this.stage.removeEventListener("pointerdown", this.onStageDown);
    this.overlay.removeEventListener("pointerdown", this.onInputDown);
    this.overlay.removeEventListener("pointermove", this.onInputMove);
    this.overlay.removeEventListener("pointerup", this.onInputUp);
    this.overlay.removeEventListener("pointercancel", this.onInputUp);
    this.clear();
    this.layer.remove();
    this.overlay.remove();
  }

  /* ---------------- sizing ---------------- */

  private sizeOneCanvas(c: HTMLCanvasElement, g: CanvasRenderingContext2D, preserve: boolean): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let tmp: HTMLCanvasElement | null = null;
    if (preserve && c.width && c.height) {
      tmp = document.createElement("canvas");
      tmp.width = c.width;
      tmp.height = c.height;
      tmp.getContext("2d")!.drawImage(c, 0, 0);
    }
    c.width = Math.round(w * this.dpr);
    c.height = Math.round(h * this.dpr);
    c.style.width = w + "px";
    c.style.height = h + "px";
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.lineCap = "round";
    g.lineJoin = "round";
    if (tmp) {
      g.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, this.prevCssW, this.prevCssH);
    }
  }

  private sizeAll = (): void => {
    this.dpr = window.devicePixelRatio || 1;
    this.sizeOneCanvas(this.overlay, this.overlayCtx, false);
    for (const s of this.segments) this.sizeOneCanvas(s.canvas, s.ctx, true);
    this.prevCssW = window.innerWidth;
    this.prevCssH = window.innerHeight;
  };

  private onResize = (): void => this.sizeAll();

  private onOrientation = (): void => {
    if (this.resizeTimer) window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(this.sizeAll, 250);
  };

  /* ---------------- drawing segments ---------------- */

  private makeSegment(): Segment {
    const c = document.createElement("canvas");
    c.className = "seg";
    const g = c.getContext("2d")!;
    this.layer.appendChild(c); // appended last => on top of everything so far
    const seg: Segment = { canvas: c, ctx: g };
    this.segments.push(seg);
    this.currentSeg = seg;
    this.sizeOneCanvas(c, g, false);
    return seg;
  }

  private ensureSeg(): Segment {
    return this.currentSeg || this.makeSegment();
  }

  private sealSegment(): void {
    this.currentSeg = null; // force a new top layer for the next stroke
  }

  private drawLine(a: Point, b: Point): void {
    const g = this.ensureSeg().ctx;
    g.globalCompositeOperation = "source-over";
    g.strokeStyle = this.currentColor;
    g.lineWidth = BRUSH;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }

  private drawDot(p: Point): void {
    const g = this.ensureSeg().ctx;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = this.currentColor;
    g.beginPath();
    g.arc(p.x, p.y, BRUSH / 2, 0, Math.PI * 2);
    g.fill();
  }

  private eraseLine(a: Point, b: Point): void {
    for (const s of this.segments) {
      const g = s.ctx;
      g.globalCompositeOperation = "destination-out";
      g.lineWidth = ERASE;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      g.globalCompositeOperation = "source-over";
    }
  }

  private eraseDot(p: Point): void {
    for (const s of this.segments) {
      const g = s.ctx;
      g.globalCompositeOperation = "destination-out";
      g.beginPath();
      g.arc(p.x, p.y, ERASE / 2, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = "source-over";
    }
  }

  private coalesced(e: PointerEvent): PointerEvent[] {
    const anyE = e as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
    if (anyE.getCoalescedEvents) {
      const arr = anyE.getCoalescedEvents();
      if (arr && arr.length) return arr;
    }
    return [e];
  }

  /* ---------------- input overlay handlers ---------------- */

  private onInputDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.audio.ensure();
    const p: Point = { x: e.clientX, y: e.clientY };
    if (this.activeTool === "eraser") {
      this.moveEraserCursor(p);
      const hit = this.emojiAt(p.x, p.y);
      if (hit) {
        this.removeEmoji(hit);
        return;
      }
    }
    if (this.activeTool !== "paint" && this.activeTool !== "eraser") return;
    // Only the FIRST interaction after selecting the brush treats an emoji
    // specially: tapping an emoji leaves paint mode for select (none) mode;
    // tapping empty space just draws. Every later tap simply draws.
    if (this.activeTool === "paint" && (this.paintFirstPending || this.pendingSelectMode)) {
      const wasFirst = this.paintFirstPending;
      this.paintFirstPending = false;
      const hit = this.emojiAt(p.x, p.y);
      if (hit) {
        this.pendingSelectMode = true;
        this.beginOverlayEmoji(hit, e, p);
        return;
      }
      // Additional pointers during a select-mode gesture must not draw.
      if (!wasFirst) return;
    }
    try {
      this.overlay.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.strokes.set(e.pointerId, p);
    if (this.activeTool === "paint") {
      this.opts.onDrawStart?.();
      this.drawDot(p);
      this.audio.startBrush();
    } else {
      this.eraseDot(p);
      this.moveEraserCursor(p);
      this.audio.startEraser();
      this.audio.setEraserLevel(0.3);
    }
  };

  private onInputMove = (e: PointerEvent): void => {
    const drag = this.overlayEmoji.get(e.pointerId);
    if (drag) {
      e.preventDefault();
      this.onEmojiMove(drag, e);
      return;
    }
    let last = this.strokes.get(e.pointerId);
    if (!last) return;
    e.preventDefault();
    const evs = this.coalesced(e);
    let moved = 0;
    for (const ev of evs) {
      const p: Point = { x: ev.clientX, y: ev.clientY };
      if (p.x === undefined || Number.isNaN(p.x)) continue;
      if (this.activeTool === "paint") {
        this.drawLine(last, p);
        moved += dist(last, p);
      } else {
        this.eraseLine(last, p);
        moved += dist(last, p);
      }
      last = p;
    }
    this.strokes.set(e.pointerId, last);
    // Drive the brush volume from how fast the child is drawing.
    if (this.activeTool === "paint") this.audio.setBrushLevel(clamp(moved / 45, 0, 1));
    else if (this.activeTool === "eraser") {
      this.moveEraserCursor(last);
      this.audio.setEraserLevel(clamp(moved / 45, 0, 1));
    }
  };

  private onInputUp = (e: PointerEvent): void => {
    const drag = this.overlayEmoji.get(e.pointerId);
    if (drag) {
      this.overlayEmoji.delete(e.pointerId);
      try {
        this.overlay.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.endOverlayEmoji(drag, e);
      if (this.overlayEmoji.size === 0 && this.pendingSelectMode) {
        this.pendingSelectMode = false;
        this.setTool("none"); // leave paint for select mode after the gesture
        this.opts.onSelectMode?.();
      }
      return;
    }
    if (this.strokes.has(e.pointerId)) {
      this.strokes.delete(e.pointerId);
      try {
        this.overlay.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (this.strokes.size === 0) {
      this.audio.stopBrush();
      this.audio.stopEraser();
    }
    this.hideEraserCursor();
  };

  /** Start moving/pinching an emoji from the paint overlay (pointer already down). */
  private beginOverlayEmoji(o: EmojiObj, e: PointerEvent, p: Point): void {
    this.audio.stopBrush();
    try {
      this.overlay.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.overlayEmoji.set(e.pointerId, o);
    o.pointers.set(e.pointerId, p);
    o.el.classList.add("grab");
    if (o.pointers.size === 1) {
      o.glyph.classList.remove("tap");
      void o.glyph.offsetWidth;
      o.glyph.classList.add("tap");
    }
    this.captureBase(o);
  }

  /** Release a pointer that was dragging an emoji from the overlay. */
  private endOverlayEmoji(o: EmojiObj, e: PointerEvent): void {
    if (o.pointers.has(e.pointerId)) o.pointers.delete(e.pointerId);
    if (o.pointers.size > 0) this.captureBase(o);
    else o.el.classList.remove("grab");
  }

  /* ---------------- emojis ---------------- */

  private applyTransform(o: EmojiObj): void {
    o.el.style.left = o.x - HALF + "px";
    o.el.style.top = o.y - HALF + "px";
    o.el.style.transform = "rotate(" + o.rot + "rad) scale(" + o.scale + ")";
  }

  private captureBase(o: EmojiObj): void {
    const pts: Point[] = [];
    o.pointers.forEach((p) => pts.push(p));
    const c = centroid(pts);
    o.base = {
      cx: c.x,
      cy: c.y,
      x: o.x,
      y: o.y,
      scale: o.scale,
      rot: o.rot,
      dist: pts.length >= 2 ? dist(pts[0], pts[1]) : 0,
      ang: pts.length >= 2 ? angle(pts[0], pts[1]) : 0,
    };
  }

  private onEmojiDown(o: EmojiObj, e: PointerEvent): void {
    if (this.activeTool !== "none") return; // only movable in idle mode
    e.preventDefault();
    try {
      o.el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    o.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    o.el.classList.add("grab");
    if (o.pointers.size === 1) {
      o.glyph.classList.remove("tap");
      void o.glyph.offsetWidth;
      o.glyph.classList.add("tap");
    }
    this.captureBase(o); // keep strict add-order stacking; do not raise on grab
  }

  private onEmojiMove(o: EmojiObj, e: PointerEvent): void {
    if (!o.pointers.has(e.pointerId)) return;
    o.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts: Point[] = [];
    o.pointers.forEach((p) => pts.push(p));
    const c = centroid(pts);
    const base = o.base!;
    o.x = base.x + (c.x - base.cx);
    o.y = base.y + (c.y - base.cy);
    if (pts.length >= 2 && base.dist > 0) {
      const d = dist(pts[0], pts[1]);
      const a = angle(pts[0], pts[1]);
      o.scale = clamp(base.scale * (d / base.dist), 0.35, 6);
      o.rot = base.rot + (a - base.ang);
    }
    this.applyTransform(o);
  }

  private onEmojiUp(o: EmojiObj, e: PointerEvent): void {
    if (o.pointers.has(e.pointerId)) {
      o.pointers.delete(e.pointerId);
      try {
        o.el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (o.pointers.size > 0) this.captureBase(o);
    else o.el.classList.remove("grab");
  }

  private removeEmoji(o: EmojiObj): void {
    o.glyph.classList.add("bubble");
    this.audio.playBubble();
    window.setTimeout(() => {
      o.el.remove();
      const i = this.emojis.indexOf(o);
      if (i >= 0) this.emojis.splice(i, 1);
    }, 260);
  }

  /** Topmost emoji under a point (for eraser tap-to-delete). */
  private emojiAt(px: number, py: number): EmojiObj | null {
    for (let i = this.emojis.length - 1; i >= 0; i--) {
      const o = this.emojis[i];
      const r = HALF * o.scale * 0.95;
      const dx = px - o.x;
      const dy = py - o.y;
      if (dx * dx + dy * dy <= r * r) return o;
    }
    return null;
  }

  private onStageDown = (e: PointerEvent): void => {
    if (!this.firstTouch) {
      this.firstTouch = true;
      this.opts.onFirstInteraction?.();
    }
    // In idle/select mode, tapping empty space (not an emoji) switches to paint
    // and starts drawing immediately — no second tap needed.
    if (this.activeTool === "none" && !this.emojiAt(e.clientX, e.clientY)) {
      this.beginPaintFromIdle(e);
    }
  };

  /** Enter paint mode and begin a stroke from the current idle-mode pointerdown. */
  private beginPaintFromIdle(e: PointerEvent): void {
    this.setTool("paint"); // flips overlay pointer-events to auto synchronously
    this.paintFirstPending = false; // this empty tap is the first interaction (a draw)
    this.opts.onEmptyTap?.(); // keep React tool state in sync
    const p: Point = { x: e.clientX, y: e.clientY };
    try {
      this.overlay.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.strokes.set(e.pointerId, p);
    this.opts.onDrawStart?.();
    this.drawDot(p);
    this.audio.startBrush();
  }
}
