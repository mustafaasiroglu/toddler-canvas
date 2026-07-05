import { Fragment, useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import "./SettingsModal.css";

interface SettingsModalProps {
  open: boolean;
  muted: boolean;
  colors: string[];
  fullscreen: boolean;
  fullscreenSupported: boolean;
  customStickers: string[];
  onClose: () => void;
  onToggleSound: () => void;
  onClear: () => void;
  onAddColor: (hex: string) => void;
  onRemoveColor: (hex: string) => void;
  onReorderColor: (from: number, to: number) => void;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  onAddCustomSticker: (item: string) => void;
  onRemoveCustomSticker: (item: string) => void;
}

interface Gate {
  a: number;
  b: number;
  options: number[];
}

function makeGate(): Gate {
  const a = 2 + Math.floor(Math.random() * 8); // 2..9
  const b = 2 + Math.floor(Math.random() * 8); // 2..9
  const answer = a + b;
  const options = [answer];
  while (options.length < 4) {
    const d = answer + (Math.floor(Math.random() * 11) - 5);
    if (d > 0 && !options.includes(d)) options.push(d);
  }
  for (let i = options.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [options[i], options[k]] = [options[k], options[i]];
  }
  return { a, b, options };
}

/** Resize an image File to a square thumbnail (max `size` px on longest side) and return a PNG data URL. */
function resizeImageFile(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, size / Math.max(img.width, img.height, 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get 2D context"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export function SettingsModal({
  open,
  muted,
  colors,
  fullscreen,
  fullscreenSupported,
  customStickers,
  onClose,
  onToggleSound,
  onClear,
  onAddColor,
  onRemoveColor,
  onReorderColor,
  onEnterFullscreen,
  onExitFullscreen,
  onAddCustomSticker,
  onRemoveCustomSticker,
}: SettingsModalProps) {
  const [passed, setPassed] = useState(false);
  const [gate, setGate] = useState<Gate>(makeGate);
  const [emojiInput, setEmojiInput] = useState("");
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const centers = useRef<number[]>([]);
  const startX = useRef(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [dragDX, setDragDX] = useState(0);

  const startDrag = (e: ReactPointerEvent, i: number) => {
    if ((e.target as HTMLElement).classList.contains("x")) return; // let the remove tap work
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // Snapshot the slot centers so neighbours can slide while the layout stays put.
    centers.current = chipRefs.current.map((el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return r.left + r.width / 2;
    });
    startX.current = e.clientX;
    setDragIdx(i);
    setOverIdx(i);
    setDragDX(0);
  };

  const moveDrag = (e: ReactPointerEvent) => {
    if (dragIdx === null) return;
    setDragDX(e.clientX - startX.current);
    // Insertion index = how many non-dragged chips sit left of the pointer.
    let t = 0;
    for (let k = 0; k < centers.current.length; k++) {
      if (k === dragIdx) continue;
      if (centers.current[k] < e.clientX) t++;
    }
    setOverIdx(t);
  };

  const endDrag = () => {
    if (dragIdx !== null && overIdx !== null && overIdx !== dragIdx) {
      onReorderColor(dragIdx, overIdx);
    }
    setDragIdx(null);
    setOverIdx(null);
    setDragDX(0);
  };

  // While dragging, shift the neighbours into the gap the dragged chip leaves.
  const chipTransform = (i: number): string | undefined => {
    if (i === dragIdx) return `translateX(${dragDX}px)`;
    if (dragIdx === null || overIdx === null) return undefined;
    const from = dragIdx;
    const to = overIdx;
    if (from < to && i > from && i <= to) {
      return `translateX(${centers.current[i - 1] - centers.current[i]}px)`;
    }
    if (from > to && i >= to && i < from) {
      return `translateX(${centers.current[i + 1] - centers.current[i]}px)`;
    }
    return "translateX(0px)";
  };

  // Fresh gate every time the popup opens; hide the panel again on close.
  useEffect(() => {
    if (open) {
      setGate(makeGate());
      setPassed(false);
      setEmojiInput("");
    }
  }, [open]);

  const handleAddEmoji = () => {
    const text = emojiInput.trim();
    if (!text) return;
    onAddCustomSticker(text);
    setEmojiInput("");
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      try {
        const dataUrl = await resizeImageFile(file, 128);
        onAddCustomSticker(dataUrl);
      } catch (err) {
        console.warn("Custom sticker: could not process image file", err);
      }
    }
    e.target.value = ""; // allow re-selecting the same file
  };

  if (!open) return null;

  const answer = gate.a + gate.b;

  return (
    <div
      id="settingsOverlay"
      className="open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {!passed ? (
        <div className="sheet">
          <h2>Grown-ups only 🔒</h2>
          <p>Answer to open settings</p>
          <div id="gateQ">
            {gate.a} + {gate.b} = ?
          </div>
          <div id="gateAns">
            {gate.options.map((v, i) => (
              <button
                key={v + "-" + i}
                className="gateBtn"
                onClick={() => (v === answer ? setPassed(true) : onClose())}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="sheet">
          <h2>Settings</h2>

          {fullscreenSupported && (
            <div className="srow">
              <span className="lbl">Full screen</span>
              <button
                className={"toggle" + (fullscreen ? " on" : "")}
                aria-label="full screen on/off"
                onClick={fullscreen ? onExitFullscreen : onEnterFullscreen}
              >
                <span className="knob" />
              </button>
            </div>
          )}

          <div className="srow">
            <span className="lbl">Sound Effects</span>
            <button
              className={"toggle" + (!muted ? " on" : "")}
              aria-label="sound on/off"
              onClick={onToggleSound}
            >
              <span className="knob" />
            </button>
          </div>

          <div className="srow" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span className="lbl" style={{ marginBottom: 8 }}>
              Palette colors
            </span>
            <div id="palEditor">
              {colors.map((hex, i) => (
                <Fragment key={hex}>
                  {i === 3 ? <span className="palPipe" aria-hidden /> : null}
                  <div
                    ref={(el) => {
                      chipRefs.current[i] = el;
                    }}
                    className={"palChip" + (dragIdx === i ? " dragging" : "")}
                    style={{
                      background: hex,
                      transform: chipTransform(i),
                    }}
                    onPointerDown={(e) => startDrag(e, i)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <span
                      className="x"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (colors.length > 1) onRemoveColor(hex);
                      }}
                    >
                      ×
                    </span>
                  </div>
                </Fragment>
              ))}
              <label className="palAdd">
                +
                <input
                  ref={colorInputRef}
                  type="color"
                  defaultValue="#ff88cc"
                  onChange={(e) => onAddColor(e.target.value.toLowerCase())}
                />
              </label>
            </div>
          </div>

          <div className="srow" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <span className="lbl" style={{ marginBottom: 8 }}>
              Custom Stickers
            </span>
            <div className="stickerInputRow">
              <input
                className="stickerEmojiInput"
                type="text"
                placeholder="Type an emoji 🐣"
                value={emojiInput}
                onChange={(e) => setEmojiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddEmoji();
                }}
              />
              <button className="stickerAddBtn" onClick={handleAddEmoji}>
                Add
              </button>
            </div>
            <label className="stickerUploadLabel">
              📁 Upload Image
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handleImageUpload}
              />
            </label>
            {customStickers.length > 0 && (
              <div className="stickerChips">
                {customStickers.map((s) => (
                  <div
                    key={s.startsWith("data:") ? `${s.slice(0, 30)}-${s.length}` : s}
                    className="stickerChip"
                  >
                    {s.startsWith("data:") ? (
                      <img src={s} alt="sticker" className="stickerThumb" />
                    ) : (
                      <span className="stickerGlyph">{s}</span>
                    )}
                    <span
                      className="x stickerRemove"
                      onClick={() => onRemoveCustomSticker(s)}
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="srow" style={{ justifyContent: "space-between" }}>
            <button
              className="btnBig btnDanger"
              onClick={() => {
                onClear();
                onClose();
              }}
            >
              Clear Canvas
            </button>
            <button className="btnBig btnPrimary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
