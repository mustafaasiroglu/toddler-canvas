import "./Palette.css";

interface PaletteProps {
  colors: string[];
  current: string;
  visible: boolean;
  onSelect: (hex: string) => void;
}

export function Palette({ colors, current, visible, onSelect }: PaletteProps) {
  return (
    <div id="palette" className={visible ? "show" : undefined}>
      {colors.map((hex) => (
        <div
          key={hex}
          className={"swatch" + (hex === current ? " sel" : "")}
          style={{ background: hex }}
          onClick={() => onSelect(hex)}
        />
      ))}
    </div>
  );
}
