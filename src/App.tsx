import { useCallback, useEffect, useRef, useState } from "react";
import type { Tool } from "./engine/CanvasEngine";
import { DEFAULT_COLORS } from "./data/colors";
import { useCanvasEngine } from "./hooks/useCanvasEngine";
import { Toolbar } from "./components/Toolbar";
import { Palette } from "./components/Palette";
import { EmojiGallery } from "./components/EmojiGallery";
import { SettingsModal } from "./components/SettingsModal";
import { SplashScreen } from "./components/SplashScreen";
import { ToolHint } from "./components/ToolHint";

// Safari uses webkit-prefixed Fullscreen API methods.
type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => void;
};
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

// iOS (all browsers use WebKit) has no Fullscreen API for regular elements,
// so the button is hidden there. On iOS, "Add to Home Screen" gives fullscreen.
const fullscreenSupported = (() => {
  const el = document.documentElement as FsElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
})();

// Duration the tool hint animation plays before being unmounted (in ms).
// The CSS animation itself is 0.5 s; this adds a small buffer.
const HINT_DISPLAY_DURATION_MS = 600;

export default function App() {
  const [tool, setTool] = useState<Tool>("paint");
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [rainbowColor, setRainbowColor] = useState(DEFAULT_COLORS[3]); // last palette pick
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS);
  const [muted, setMuted] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintIsRainbow, setHintIsRainbow] = useState(false);
  const [splashOpen, setSplashOpen] = useState(true);
  const [customStickers, setCustomStickers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("tc-custom-stickers");
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { stageRef, engineRef } = useCanvasEngine(
    undefined,
    () => setPaletteOpen(false), // drawing on the canvas auto-hides the palette
  );

  // Keep the imperative engine in sync with declarative React state.
  useEffect(() => {
    engineRef.current?.setTool(tool);
  }, [tool, engineRef]);

  useEffect(() => {
    engineRef.current?.setColor(color);
  }, [color, engineRef]);

  useEffect(() => {
    engineRef.current?.setMuted(muted);
  }, [muted, engineRef]);

  // Track fullscreen so the enter button hides while fullscreen is active.
  useEffect(() => {
    const doc = document as FsDocument;
    const onFs = () =>
      setFullscreen(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  // Clean up the hint timer when the component unmounts to prevent stale state updates.
  useEffect(() => {
    return () => {
      if (hintTimerRef.current !== null) clearTimeout(hintTimerRef.current);
    };
  }, []);

  const resume = useCallback(() => engineRef.current?.resume(), [engineRef]);

  const startFromSplash = useCallback(() => {
    resume();
    setSplashOpen(false);
  }, [resume]);

  const triggerHint = useCallback(
    (rainbow: boolean) => {
      if (hintTimerRef.current !== null) clearTimeout(hintTimerRef.current);
      setHintIsRainbow(rainbow);
      setShowHint(false); // unmount first so the animation restarts
      // Use a microtask gap so React flushes the unmount before remounting
      requestAnimationFrame(() => {
        setShowHint(true);
        engineRef.current?.audio.playPop();
        hintTimerRef.current = setTimeout(() => setShowHint(false), HINT_DISPLAY_DURATION_MS);
      });
    },
    [engineRef],
  );

  const pickPen = useCallback(
    (hex: string) => {
      resume();
      setColor(hex);
      setTool("paint");
      setPaletteOpen(false); // fixed-color pens don't need the palette
      triggerHint(false);
    },
    [resume, triggerHint],
  );

  const openRainbow = useCallback(() => {
    resume();
    setColor(rainbowColor); // restore the last palette color (or the default first one)
    setTool("paint");
    setPaletteOpen(true); // the rainbow pen opens the full color palette
    triggerHint(true);
  }, [resume, rainbowColor, triggerHint]);

  const handleEraser = useCallback(() => {
    resume();
    setTool("eraser");
    triggerHint(false);
  }, [resume, triggerHint]);

  const handleEmoji = useCallback(() => {
    resume();
    setTool("emoji");
    setGalleryOpen(true);
  }, [resume]);

  const pickEmoji = useCallback(
    (char: string) => {
      setGalleryOpen(false);
      setTool("emoji");
      engineRef.current?.addEmoji(char);
    },
    [engineRef],
  );

  const selectColor = useCallback(
    (hex: string) => {
      setColor(hex);
      setRainbowColor(hex); // remember it for the next rainbow tap
      setPaletteOpen(false); // hide the palette once a color is chosen
      engineRef.current?.audio.playClick();
    },
    [engineRef],
  );

  const addColor = useCallback((hex: string) => {
    setColors((prev) => (prev.includes(hex) ? prev : [...prev, hex]));
  }, []);

  const removeColor = useCallback(
    (hex: string) => {
      setColors((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((c) => c !== hex);
        if (color === hex && next.length) setColor(next[0]);
        return next;
      });
    },
    [color],
  );

  const reorderColor = useCallback((from: number, to: number) => {
    setColors((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  // Persist custom stickers to localStorage whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem("tc-custom-stickers", JSON.stringify(customStickers));
    } catch {
      /* quota exceeded or private mode – ignore */
    }
  }, [customStickers]);

  const addCustomSticker = useCallback((item: string) => {
    setCustomStickers((prev) => (prev.includes(item) ? prev : [...prev, item]));
  }, []);

  const removeCustomSticker = useCallback((item: string) => {
    setCustomStickers((prev) => prev.filter((s) => s !== item));
  }, []);

  const openSettings = useCallback(() => {
    resume();
    setSettingsOpen(true);
  }, [resume]);

  const enterFullscreen = useCallback(() => {
    const el = document.documentElement as FsElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    const doc = document as FsDocument;
    if (doc.exitFullscreen) {
      doc.exitFullscreen().catch(() => {});
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    }
    setSettingsOpen(false);
  }, []);

  const clearCanvas = useCallback(() => {
    engineRef.current?.clear();
    engineRef.current?.audio.blip(400, 0.12, 0.08, "sine");
  }, [engineRef]);

  const exportImage = useCallback(async () => {
    const dataUrl = engineRef.current?.exportImage();
    if (!dataUrl) return;

    const filename = "toddler-canvas.png";

    // Web Share API: preferred on mobile (iOS Safari ignores anchor downloads).
    if (typeof navigator.share === "function") {
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "Toddler Canvas" });
          return;
        }
      } catch {
        // share cancelled or failed — fall through to anchor download
      }
    }

    // Fallback: anchor-click download (desktop browsers).
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }, [engineRef]);

  const penColors = colors.slice(0, 3); // first three show directly on screen
  const paletteColors = colors.slice(3); // the rest live inside the palette

  return (
    <div id="app">
      <div className="stage" ref={stageRef} />

      {splashOpen && <SplashScreen onStart={startFromSplash} />}

      {showHint && (
        <ToolHint
          tool={tool}
          color={color}
          rainbowColor={rainbowColor}
          isRainbow={hintIsRainbow}
        />
      )}

      {fullscreenSupported && !fullscreen && (
        <button id="fullscreen" aria-label="fullscreen" onClick={enterFullscreen}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path
              d="M4 9 V5 a1 1 0 0 1 1-1 h4 M20 9 V5 a1 1 0 0 0-1-1 h-4 M4 15 v4 a1 1 0 0 0 1 1 h4 M20 15 v4 a1 1 0 0 1-1 1 h-4"
              fill="none"
              stroke="#8a8f96"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      <button id="settings" aria-label="settings" onClick={openSettings}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <rect x="5" y="10" width="14" height="10" rx="2.5" fill="#8a8f96" />
          <path
            d="M8 10 V8 a4 4 0 0 1 8 0 v2"
            fill="none"
            stroke="#8a8f96"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="14.5" r="1.6" fill="#fff" />
          <rect x="11.2" y="14.5" width="1.6" height="3" rx="0.8" fill="#fff" />
        </svg>
      </button>

      <Palette
        colors={paletteColors}
        current={color}
        visible={tool === "paint" && paletteOpen}
        onSelect={selectColor}
      />

      <Toolbar
        tool={tool}
        color={color}
        penColors={penColors}
        rainbowColor={rainbowColor}
        onPickPen={pickPen}
        onRainbow={openRainbow}
        onEmoji={handleEmoji}
        onEraser={handleEraser}
        onClearAll={clearCanvas}
      />

      <EmojiGallery open={galleryOpen} customStickers={customStickers} onClose={() => setGalleryOpen(false)} onPick={pickEmoji} />

      <SettingsModal
        open={settingsOpen}
        muted={muted}
        colors={colors}
        fullscreen={fullscreen}
        fullscreenSupported={fullscreenSupported}
        customStickers={customStickers}
        onClose={() => setSettingsOpen(false)}
        onToggleSound={() => setMuted((m) => !m)}
        onClear={clearCanvas}
        onExportImage={exportImage}
        onAddColor={addColor}
        onRemoveColor={removeColor}
        onReorderColor={reorderColor}
        onEnterFullscreen={enterFullscreen}
        onExitFullscreen={exitFullscreen}
        onAddCustomSticker={addCustomSticker}
        onRemoveCustomSticker={removeCustomSticker}
      />
    </div>
  );
}
