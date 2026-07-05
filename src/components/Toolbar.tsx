import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Tool } from "../engine/CanvasEngine";
import "./Toolbar.css";

interface ToolbarProps {
  tool: Tool;
  color: string;
  penColors: string[];
  rainbowColor: string;
  onPickPen: (hex: string) => void;
  onRainbow: () => void;
  onEmoji: () => void;
  onEraser: () => void;
  onClearAll: () => void;
}

const HOLD_MS = 2000; // press-and-hold the eraser this long to wipe everything
const HOLD_OVERLAY_DELAY_MS = 1000; // show hold animation only after this delay
const RING = 2 * Math.PI * 46; // circumference of the progress ring (r = 46)

export function Toolbar({
  tool,
  color,
  penColors,
  rainbowColor,
  onPickPen,
  onRainbow,
  onEmoji,
  onEraser,
  onClearAll,
}: ToolbarProps) {
  const painting = tool === "paint";
  const onPreset = painting && penColors.includes(color);

  const [holdProgress, setHoldProgress] = useState(0);
  const [holdActive, setHoldActive] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const completedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const cancelHold = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setHoldActive(false);
    setHoldProgress(0);
  };

  const startHold = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    completedRef.current = false;
    startRef.current = performance.now();
    setHoldActive(false);
    setHoldProgress(0);
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const p = Math.min(1, elapsed / HOLD_MS);
      const shouldShowOverlay = elapsed >= HOLD_OVERLAY_DELAY_MS;

      setHoldActive(shouldShowOverlay);
      if (shouldShowOverlay) {
        const visualDuration = Math.max(1, HOLD_MS - HOLD_OVERLAY_DELAY_MS);
        const visualProgress = Math.min(1, (elapsed - HOLD_OVERLAY_DELAY_MS) / visualDuration);
        setHoldProgress(visualProgress);
      } else {
        setHoldProgress(0);
      }
      if (p >= 1) {
        rafRef.current = null;
        completedRef.current = true;
        setHoldActive(false);
        setHoldProgress(0);
        onClearAll();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleEraserClick = () => {
    // A completed long-press already cleared the canvas; don't also re-select.
    if (completedRef.current) {
      completedRef.current = false;
      return;
    }
    onEraser();
  };

  const holdOverlay =
    holdActive &&
    createPortal(
      <div className="holdOverlay" aria-hidden="true">
        <div className="holdOverlayCircle">
          <span className="holdOverlayEmoji">🧽</span>
          <svg className="holdRing" viewBox="0 0 100 100">
            <circle className="holdRingTrack" cx="50" cy="50" r="46" />
            <circle
              className="holdRingFill"
              cx="50"
              cy="50"
              r="46"
              style={{
                strokeDasharray: RING,
                strokeDashoffset: RING * (1 - holdProgress),
              }}
            />
          </svg>
        </div>
      </div>,
      document.body,
    );

  return (
    <div id="toolbar" className={tool === "paint" || tool === "eraser" ? "hasactive" : undefined}>
      {holdOverlay}
      <div className="tool-section">
        {penColors.map((hex) => (
          <button
            key={hex}
            className={"tool tool-pen" + (painting && color === hex ? " active" : "")}
            aria-label={"pen " + hex}
            onClick={() => onPickPen(hex)}
          >
            <svg className="penIcon" viewBox="0 0 44 70" aria-hidden="true">
              {/* barrel reaching up out of view */}
              <rect
                x="13"
                y="0"
                width="18"
                height="38"
                rx="4"
                fill="#eef1f5"
                stroke="#c4cad1"
                strokeWidth="1.5"
              />
              {/* collar band */}
              <rect
                x="11.5"
                y="35"
                width="21"
                height="7"
                rx="2.5"
                fill="#d9dee4"
                stroke="#c4cad1"
                strokeWidth="1"
              />
              {/* big colored marker tip */}
              <path
                d="M12 41 H32 L26.5 63 Q22 68 17.5 63 Z"
                fill={hex}
                stroke="rgba(0,0,0,0.12)"
                strokeWidth="1"
              />
              {/* soft highlight on the tip */}
              <path d="M16 42 L19 42 L17.5 60 Z" fill="rgba(255,255,255,0.35)" />
            </svg>
          </button>
        ))}

        <button
          className={"tool tool-rainbow" + (painting && !onPreset ? " active" : "")}
          aria-label="rainbow pen"
          onClick={onRainbow}
        >
          <svg className="penIcon" viewBox="0 0 44 70" aria-hidden="true">
            <defs>
              <linearGradient id="rainbowBarrel" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ff5a5f" />
                <stop offset="20%" stopColor="#ff9f43" />
                <stop offset="40%" stopColor="#ffd93d" />
                <stop offset="60%" stopColor="#4cd964" />
                <stop offset="80%" stopColor="#4aa3ff" />
                <stop offset="100%" stopColor="#a66bff" />
              </linearGradient>
            </defs>
            {/* barrel stays rainbow */}
            <rect
              x="13"
              y="0"
              width="18"
              height="38"
              rx="4"
              fill="url(#rainbowBarrel)"
              stroke="#c4cad1"
              strokeWidth="1.5"
            />
            {/* collar band */}
            <rect
              x="11.5"
              y="35"
              width="21"
              height="7"
              rx="2.5"
              fill="#d9dee4"
              stroke="#c4cad1"
              strokeWidth="1"
            />
            {/* tip shows the selected color */}
            <path
              d="M12 41 H32 L26.5 63 Q22 68 17.5 63 Z"
              fill={rainbowColor}
              stroke="rgba(0,0,0,0.12)"
              strokeWidth="1"
            />
            <path d="M16 42 L19 42 L17.5 60 Z" fill="rgba(255,255,255,0.35)" />
          </svg>
        </button>

        <button
          className={"tool tool-eraser" + (tool === "eraser" ? " active" : "")}
          aria-label="eraser"
          onClick={handleEraserClick}
          onPointerDown={startHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={(e) => e.preventDefault()}
        >
          🧽
        </button>
      </div>

      <span className="tool-divider" aria-hidden="true" />

      <button className={"tool tool-emoji" + (tool === "emoji" ? " active" : "")} aria-label="emoji" onClick={onEmoji}>
        <div className="emojiIcon">
          <span>😀</span>
          <span>🌳</span>
          <span>🚗</span>
          <span>⭐</span>
        </div>
      </button>
    </div>
  );
}
