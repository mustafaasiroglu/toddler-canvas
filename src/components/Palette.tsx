import { useRef } from "react";
import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE } from "../engine/CanvasEngine";
import "./Palette.css";

interface PaletteProps {
  colors: string[];
  current: string;
  customColor: string;
  brushSize: number;
  visible: boolean;
  onSelect: (hex: string) => void;
  onSelectCustomColor: (hex: string) => void;
  onBrushSizeChange: (size: number) => void;
}

export function Palette({
  colors,
  current,
  customColor,
  brushSize,
  visible,
  onSelect,
  onSelectCustomColor,
  onBrushSizeChange,
}: PaletteProps) {
  const customInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div id="palette" className={visible ? "show" : undefined}>
      <div className="brushSliderRow">
        <span className="brushSliderLabel">Thin</span>
        <input
          className="brushSlider"
          type="range"
          min={MIN_BRUSH_SIZE}
          max={MAX_BRUSH_SIZE}
          value={brushSize}
          aria-label="Brush thickness"
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
        />
        <span className="brushSliderLabel">Thick</span>
      </div>

      <div className="paletteSwatches">
        {colors.map((hex, index) => (
          <button
            key={`${hex}-${index}`}
            type="button"
            className={"swatch" + (hex === current ? " sel" : "")}
            style={{ background: hex }}
            aria-label={`color ${hex}`}
            onClick={() => onSelect(hex)}
          />
        ))}

        <button
          type="button"
          className={"swatch swatch-custom" + (customColor === current ? " sel" : "")}
          style={{ background: customColor }}
          aria-label="Choose custom color"
          onClick={() => customInputRef.current?.click()}
        >
          <span className="swatchCustomBadge">+</span>
        </button>
      </div>

      <input
        ref={customInputRef}
        className="paletteCustomInput"
        type="color"
        value={customColor || "#333333"}
        onChange={(e) => onSelectCustomColor(e.target.value.toLowerCase())}
      />
    </div>
  );
}
