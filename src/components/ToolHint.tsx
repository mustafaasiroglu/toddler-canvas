import type { Tool } from "../engine/CanvasEngine";
import "./ToolHint.css";

interface ToolHintProps {
  tool: Tool;
  color: string;
  rainbowColor: string;
  isRainbow: boolean;
}

export function ToolHint({ tool, color, rainbowColor, isRainbow }: ToolHintProps) {
  return (
    <div className="toolHint">
      <div className="toolHintCircle">
        {tool === "eraser" ? (
          <span className="toolHintEmoji">🧽</span>
        ) : isRainbow ? (
          <svg className="toolHintPen" viewBox="0 0 44 70" aria-hidden="true">
            <defs>
              <linearGradient id="thRainbowBarrel" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ff5a5f" />
                <stop offset="20%" stopColor="#ff9f43" />
                <stop offset="40%" stopColor="#ffd93d" />
                <stop offset="60%" stopColor="#4cd964" />
                <stop offset="80%" stopColor="#4aa3ff" />
                <stop offset="100%" stopColor="#a66bff" />
              </linearGradient>
            </defs>
            <rect x="13" y="0" width="18" height="38" rx="4" fill="url(#thRainbowBarrel)" stroke="#c4cad1" strokeWidth="1.5" />
            <rect x="11.5" y="35" width="21" height="7" rx="2.5" fill="#d9dee4" stroke="#c4cad1" strokeWidth="1" />
            <path d="M12 41 H32 L26.5 63 Q22 68 17.5 63 Z" fill={rainbowColor} stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
            <path d="M16 42 L19 42 L17.5 60 Z" fill="rgba(255,255,255,0.35)" />
          </svg>
        ) : (
          <svg className="toolHintPen" viewBox="0 0 44 70" aria-hidden="true">
            <rect x="13" y="0" width="18" height="38" rx="4" fill="#eef1f5" stroke="#c4cad1" strokeWidth="1.5" />
            <rect x="11.5" y="35" width="21" height="7" rx="2.5" fill="#d9dee4" stroke="#c4cad1" strokeWidth="1" />
            <path d="M12 41 H32 L26.5 63 Q22 68 17.5 63 Z" fill={color} stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
            <path d="M16 42 L19 42 L17.5 60 Z" fill="rgba(255,255,255,0.35)" />
          </svg>
        )}
      </div>
    </div>
  );
}
