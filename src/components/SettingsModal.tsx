import { Fragment, useEffect, useId, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { CanvasBackgroundMode } from "../engine/CanvasEngine";
import "./SettingsModal.css";

function PencilIcon({ size = 15 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12.146.146a.5.5 0 0 1 .707 0l3 3a.5.5 0 0 1 0 .707l-10 10a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
    </svg>
  );
}

function BgIconBeige({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true">
      <rect x="1" y="1" width="34" height="34" rx="7" fill="#f5efe6" stroke="#d4c5b0" strokeWidth="1.5"/>
    </svg>
  );
}


function BgIconWhite({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true">
      <rect x="1" y="1" width="34" height="34" rx="7" fill="#ffffff" stroke="#d0d0d0" strokeWidth="1.5"/>
    </svg>
  );
}

function BgIconBlack({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true">
      <rect x="1" y="1" width="34" height="34" rx="7" fill="#111111" stroke="#444444" strokeWidth="1.5"/>
    </svg>
  );
}

function BgIconGrid({ size = 28 }: { size?: number }) {
  const id = useId();
  const clipId = `bgGridClip-${id}`;
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="1" y="1" width="34" height="34" rx="7"/>
        </clipPath>
      </defs>
      <rect x="1" y="1" width="34" height="34" rx="7" fill="#ffffff" stroke="#d0d0d0" strokeWidth="1.5"/>
      <g clipPath={`url(#${clipId})`} stroke="#888888" strokeWidth="0.9" strokeOpacity="0.5">
        <line x1="9" y1="1" x2="9" y2="35"/>
        <line x1="18" y1="1" x2="18" y2="35"/>
        <line x1="27" y1="1" x2="27" y2="35"/>
        <line x1="1" y1="9" x2="35" y2="9"/>
        <line x1="1" y1="18" x2="35" y2="18"/>
        <line x1="1" y1="27" x2="35" y2="27"/>
      </g>
    </svg>
  );
}

interface SettingsModalProps {
  open: boolean;
  muted: boolean;
  colors: string[];
  fullscreen: boolean;
  fullscreenSupported: boolean;
  customStickers: string[];
  canvasBackground: CanvasBackgroundMode;
  onClose: () => void;
  onToggleSound: () => void;
  onClear: () => void;
  onGetExportDataUrl: () => string | undefined;
  onAddColor: (hex: string) => void;
  onRemoveColor: (hex: string) => void;
  onReorderColor: (from: number, to: number) => void;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
  onAddCustomSticker: (item: string) => void;
  onRemoveCustomSticker: (item: string) => void;
  onCanvasBackgroundChange: (mode: CanvasBackgroundMode) => void;
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
  canvasBackground,
  onClose,
  onToggleSound,
  onClear,
  onGetExportDataUrl,
  onAddColor,
  onRemoveColor,
  onReorderColor,
  onEnterFullscreen,
  onExitFullscreen,
  onAddCustomSticker,
  onRemoveCustomSticker,
  onCanvasBackgroundChange,
}: SettingsModalProps) {
  const [passed, setPassed] = useState(false);
  const [gate, setGate] = useState<Gate>(makeGate);
  const [palettePopupOpen, setPalettePopupOpen] = useState(false);
  const [stickerPopupOpen, setStickerPopupOpen] = useState(false);
  const [stickerMode, setStickerMode] = useState<"emoji" | "image" | null>(null);
  const [emojiInput, setEmojiInput] = useState("");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [exportPopupOpen, setExportPopupOpen] = useState(false);
  const [exportDataUrl, setExportDataUrl] = useState<string | null>(null);
  // Covers classic iOS (iPhone/iPod/iPad) and modern iPadOS 13+ which reports as Macintosh.
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const emojiInputRef = useRef<HTMLInputElement | null>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const centers = useRef<number[]>([]);
  const startY = useRef(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [dragDY, setDragDY] = useState(0);

  const startDrag = (e: ReactPointerEvent, i: number) => {
    if ((e.target as HTMLElement).classList.contains("x")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    centers.current = chipRefs.current.map((el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    startY.current = e.clientY;
    setDragIdx(i);
    setOverIdx(i);
    setDragDY(0);
  };

  const moveDrag = (e: ReactPointerEvent) => {
    if (dragIdx === null) return;
    setDragDY(e.clientY - startY.current);
    let t = 0;
    for (let k = 0; k < centers.current.length; k++) {
      if (k === dragIdx) continue;
      if (centers.current[k] < e.clientY) t++;
    }
    setOverIdx(t);
  };

  const endDrag = () => {
    if (dragIdx !== null && overIdx !== null && overIdx !== dragIdx) {
      onReorderColor(dragIdx, overIdx);
    }
    setDragIdx(null);
    setOverIdx(null);
    setDragDY(0);
  };

  const chipTransform = (i: number): string | undefined => {
    if (i === dragIdx) return `translateY(${dragDY}px)`;
    if (dragIdx === null || overIdx === null) return undefined;
    const from = dragIdx;
    const to = overIdx;
    if (from < to && i > from && i <= to) {
      return `translateY(${centers.current[i - 1] - centers.current[i]}px)`;
    }
    if (from > to && i >= to && i < from) {
      return `translateY(${centers.current[i + 1] - centers.current[i]}px)`;
    }
    return "translateY(0px)";
  };

  // Fresh gate every time the popup opens; hide the panel again on close.
  useEffect(() => {
    if (open) {
      setGate(makeGate());
      setPassed(false);
      setEmojiInput("");
      setPalettePopupOpen(false);
      setStickerPopupOpen(false);
      setStickerMode(null);
      setClearConfirmOpen(false);
      setExportPopupOpen(false);
      setExportDataUrl(null);
    }
  }, [open]);

  // Auto-focus emoji input when emoji mode is selected
  useEffect(() => {
    if (stickerMode === "emoji" && emojiInputRef.current) {
      emojiInputRef.current.focus();
    }
  }, [stickerMode]);

  const handleEmojiInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmojiInput(val);
    // Auto-submit and close when a single character (emoji) is entered
    const trimmed = val.trim();
    if (trimmed.length > 0) {
      // Use Intl.Segmenter to correctly handle multi-codepoint grapheme clusters
      // (e.g. flag emojis like 🇹🇷 are two code points but one visible character).
      const segmenter = new Intl.Segmenter();
      const segments = Array.from(segmenter.segment(trimmed));
      if (segments.length > 0) {
        onAddCustomSticker(segments[0].segment);
        setEmojiInput("");
        setStickerMode(null);
        // Blur the input to dismiss the keyboard on mobile
        emojiInputRef.current?.blur();
      }
    }
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
    e.target.value = "";
    setStickerMode(null);
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

          <div className="srow">
            <span className="lbl">Background</span>
            <div className="bgOptions">
              <button
                className={"bgOptBtn" + (canvasBackground === "beige" ? " sel" : "")}
                aria-label="Beige background"
                onClick={() => onCanvasBackgroundChange("beige")}
              >
                <BgIconBeige />
              </button>
              <button
                className={"bgOptBtn" + (canvasBackground === "white" ? " sel" : "")}
                aria-label="White background"
                onClick={() => onCanvasBackgroundChange("white")}
              >
                <BgIconWhite />
              </button>
              <button
                className={"bgOptBtn" + (canvasBackground === "black" ? " sel" : "")}
                aria-label="Black background"
                onClick={() => onCanvasBackgroundChange("black")}
              >
                <BgIconBlack />
              </button>
              <button
                className={"bgOptBtn" + (canvasBackground === "grid" ? " sel" : "")}
                aria-label="Grid background"
                onClick={() => onCanvasBackgroundChange("grid")}
              >
                <BgIconGrid />
              </button>
            </div>
          </div>

          {/* Palette colors – preview + edit icon */}
          <div className="srow">
            <span className="lbl">Palette colors</span>
            <div className="palPreviewRow">
              {colors.slice(0, 3).map((hex) => (
                <span key={hex} className="palPreviewDot" style={{ background: hex }} />
              ))}
              {colors.length > 3 && <span className="palPreviewMore">+{colors.length - 3}</span>}
              <button
                className="palEditBtn"
                aria-label="Edit palette"
                onClick={() => setPalettePopupOpen(true)}
              >
                <PencilIcon size={15} />
              </button>
            </div>
          </div>

          {/* Custom Stickers – preview + edit button */}
          <div className="srow">
            <span className="lbl">Custom Stickers</span>
            <div className="stickerPreviewRow">
              {customStickers.slice(0, 3).map((s) => (
                <span
                  key={s.startsWith("data:") ? `${s.slice(0, 30)}-${s.length}` : s}
                  className="stickerPreviewItem"
                >
                  {s.startsWith("data:") ? (
                    <img src={s} alt="sticker" className="stickerPreviewThumb" />
                  ) : (
                    <span className="stickerPreviewGlyph">{s}</span>
                  )}
                </span>
              ))}
              {customStickers.length > 3 && (
                <span className="stickerPreviewMore">+{customStickers.length - 3}</span>
              )}
              <button
                className="stickerEditBtnSmall"
                aria-label="Edit stickers"
                onClick={() => setStickerPopupOpen(true)}
              >
                <PencilIcon size={14} />
              </button>
            </div>
          </div>

          {/* Canvas Actions */}
          <div className="srow">
            <span className="lbl">Canvas Actions</span>
            <div className="canvasActionsButtons">
              <button
                className="actionBtn actionBtnDanger"
                onClick={() => setClearConfirmOpen(true)}
              >
                Clear
              </button>
              <button
                className="actionBtn actionBtnExport"
                onClick={() => {
                  const url = onGetExportDataUrl();
                  if (url) {
                    setExportDataUrl(url);
                    setExportPopupOpen(true);
                  }
                }}
              >
                Export
              </button>
            </div>
          </div>

          <div className="srow" style={{ justifyContent: "flex-end", borderBottom: "none" }}>
            <button className="btnBig btnPrimary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Palette editor popup */}
      {palettePopupOpen && (
        <div
          className="subPopupOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPalettePopupOpen(false);
          }}
        >
          <div className="subPopup">
            <div className="subPopupHeader">
              <h3>Edit Palette</h3>
              <button className="subPopupClose" onClick={() => setPalettePopupOpen(false)}>
                ✕
              </button>
            </div>
            <div className="palListVertical">
              {colors.map((hex, i) => (
                <Fragment key={hex}>
                  <div
                    ref={(el) => {
                      chipRefs.current[i] = el;
                    }}
                    className={"palListItem" + (dragIdx === i ? " dragging" : "")}
                    style={{ transform: chipTransform(i) }}
                    onPointerDown={(e) => startDrag(e, i)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <span className="palListGrip">☰</span>
                    <span className="palListSwatch" style={{ background: hex }} />
                    <span className="palListHex">{hex}</span>
                    {colors.length > 1 && (
                      <span
                        className="palListRemove"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveColor(hex);
                        }}
                      >
                        ×
                      </span>
                    )}
                  </div>
                </Fragment>
              ))}
            </div>
            <label className="palAddRow">
              <span className="palAddLabel">+ Add color</span>
              <input
                ref={colorInputRef}
                type="color"
                defaultValue="#ff88cc"
                onChange={(e) => onAddColor(e.target.value.toLowerCase())}
              />
            </label>
          </div>
        </div>
      )}

      {/* Sticker add popup */}
      {stickerPopupOpen && (
        <div
          className="subPopupOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setStickerPopupOpen(false);
              setStickerMode(null);
            }
          }}
        >
          <div className="subPopup">
            <div className="subPopupHeader">
              <h3>Custom Stickers</h3>
              <button
                className="subPopupClose"
                onClick={() => {
                  setStickerPopupOpen(false);
                  setStickerMode(null);
                }}
              >
                ✕
              </button>
            </div>

            {/* Existing stickers list */}
            {customStickers.length > 0 && (
              <div className="stickerListVertical">
                {customStickers.map((s) => (
                  <div
                    key={s.startsWith("data:") ? `${s.slice(0, 30)}-${s.length}` : s}
                    className="stickerListItem"
                  >
                    {s.startsWith("data:") ? (
                      <img src={s} alt="sticker" className="stickerListThumb" />
                    ) : (
                      <span className="stickerListGlyph">{s}</span>
                    )}
                    <span
                      className="stickerListRemove"
                      onClick={() => onRemoveCustomSticker(s)}
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Add mode selection */}
            {stickerMode === null && (
              <div className="stickerModeButtons">
                <button className="stickerModeBtn" onClick={() => setStickerMode("emoji")}>
                  😀 Add Emoji
                </button>
                <button className="stickerModeBtn" onClick={() => setStickerMode("image")}>
                  🖼️ Upload Image
                </button>
              </div>
            )}

            {/* Emoji input */}
            {stickerMode === "emoji" && (
              <div className="stickerEmojiSection">
                <input
                  ref={emojiInputRef}
                  className="stickerEmojiInputNew"
                  type="text"
                  placeholder="Type an emoji 🐣"
                  value={emojiInput}
                  onChange={handleEmojiInputChange}
                />
                <button
                  className="stickerModeCancelBtn"
                  onClick={() => {
                    setStickerMode(null);
                    setEmojiInput("");
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Image upload */}
            {stickerMode === "image" && (
              <div className="stickerImageSection">
                <label className="stickerUploadLabel">
                  📁 Choose Image
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={handleImageUpload}
                  />
                </label>
                <button
                  className="stickerModeCancelBtn"
                  onClick={() => setStickerMode(null)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clear confirmation popup */}
      {clearConfirmOpen && (
        <div
          className="subPopupOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setClearConfirmOpen(false);
          }}
        >
          <div className="subPopup confirmPopup">
            <h3 className="confirmTitle">Clear canvas?</h3>
            <p className="confirmDesc">This will erase everything. This cannot be undone.</p>
            <div className="confirmButtons">
              <button
                className="btnBig btnPrimary"
                onClick={() => setClearConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btnBig btnDanger"
                onClick={() => {
                  onClear();
                  setClearConfirmOpen(false);
                  onClose();
                }}
              >
                Yes, Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export PNG popup */}
      {exportPopupOpen && exportDataUrl && (
        <div
          className="subPopupOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExportPopupOpen(false);
          }}
        >
          <div className="subPopup exportPopup">
            <div className="subPopupHeader">
              <h3>Export PNG</h3>
              <button className="subPopupClose" onClick={() => setExportPopupOpen(false)}>
                ✕
              </button>
            </div>
            <img
              src={exportDataUrl}
              alt="Canvas export preview"
              className="exportPreviewImg"
              onContextMenu={(e) => e.nativeEvent.stopPropagation()}
            />
            {isIOS ? (
              <p className="exportSaveHint">📱 Press and hold the image above, then tap <strong>Save to Photos</strong></p>
            ) : (
              <a
                href={exportDataUrl}
                download="toddler-canvas.png"
                className="btnBig btnPrimary exportDownloadBtn"
              >
                ⬇ Download
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
