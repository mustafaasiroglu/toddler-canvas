import type { Tool } from "../engine/CanvasEngine";
import "./Toolbar.css";

interface ToolbarProps {
  tool: Tool;
  showHint: boolean;
  currentColor: string;
  onPaint: () => void;
  onEmoji: () => void;
  onEraser: () => void;
}

export function Toolbar({ tool, showHint, currentColor, onPaint, onEmoji, onEraser }: ToolbarProps) {
  const drawing = tool === "paint" || tool === "eraser";
  return (
    <div id="toolbar" className={drawing ? "hasactive" : undefined}>
      <button
        className={"tool tool-small" + (tool === "paint" ? " active" : "")}
        aria-label="paint"
        onClick={onPaint}
      >
        🖌️
        <span id="paintDot" style={{ background: currentColor }} />
      </button>

      <button
        className={"tool tool-emoji" + (showHint ? " hint" : "")}
        aria-label="emoji"
        onClick={onEmoji}
      >
        <div className="emojiIcon">
          <span>😀</span>
          <span>😍</span>
          <span>🚗</span>
          <span>⭐</span>
        </div>
      </button>

      <button
        className={"tool tool-small" + (tool === "eraser" ? " active" : "")}
        aria-label="eraser"
        onClick={onEraser}
      >
        🧽
      </button>
    </div>
  );
}
