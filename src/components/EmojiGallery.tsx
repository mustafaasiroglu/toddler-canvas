import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES } from "../data/emojis";
import "./EmojiGallery.css";

interface EmojiGalleryProps {
  open: boolean;
  customStickers: string[];
  onClose: () => void;
  onPick: (char: string) => void;
}

// Persisted across open/close cycles (survives component unmount).
let _savedCat = 0;
let _savedScrollTop = 0;
const OPEN_INTERACTION_LOCK_MS = 1000;
// Keep a short lock while the popup animates in, to prevent accidental taps.

export function EmojiGallery({ open, customStickers, onClose, onPick }: EmojiGalleryProps) {
  const [activeCat, setActiveCat] = useState(_savedCat);
  const [interactionLocked, setInteractionLocked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const clickScroll = useRef(false); // ignore scroll events triggered by a tab tap
  const lockTimerRef = useRef<number | null>(null);

  const allCategories = useMemo(() => {
    if (!customStickers.length) return CATEGORIES;
    return [{ icon: "📌", items: customStickers }, ...CATEGORIES];
  }, [customStickers]);

  // Restore last position and category whenever the gallery is (re)opened.
  useEffect(() => {
    if (lockTimerRef.current !== null) {
      window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }

    if (open) {
      setActiveCat(_savedCat);
      scrollRef.current?.scrollTo({ top: _savedScrollTop });
      setInteractionLocked(true);
      lockTimerRef.current = window.setTimeout(() => {
        setInteractionLocked(false);
        lockTimerRef.current = null;
      }, OPEN_INTERACTION_LOCK_MS);
    } else {
      setInteractionLocked(false);
    }

    return () => {
      if (lockTimerRef.current !== null) {
        window.clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
    };
  }, [open]);

  // Highlight the category whose section is currently at the top of the list.
  const handleScroll = useCallback(() => {
    if (clickScroll.current) return;
    const cont = scrollRef.current;
    if (!cont) return;
    _savedScrollTop = cont.scrollTop; // persist for next open
    const top = cont.scrollTop + 60; // a little below the very top edge
    let idx = 0;
    for (let i = 0; i < sectionRefs.current.length; i++) {
      const sec = sectionRefs.current[i];
      if (sec && sec.offsetTop <= top) idx = i;
    }
    _savedCat = idx;
    setActiveCat(idx);
  }, []);

  const goToCat = useCallback((idx: number) => {
    if (interactionLocked) return;
    _savedCat = idx;
    setActiveCat(idx);
    const sec = sectionRefs.current[idx];
    const cont = scrollRef.current;
    if (!sec || !cont) return;
    // Suppress scroll-driven updates until the smooth scroll settles.
    clickScroll.current = true;
    cont.scrollTo({ top: sec.offsetTop, behavior: "smooth" });
    window.setTimeout(() => {
      clickScroll.current = false;
      if (scrollRef.current) _savedScrollTop = scrollRef.current.scrollTop;
    }, 500);
  }, []);

  if (!open) return null;

  return (
    <div id="gallery" className="open" onClick={onClose}>
      <div className="gal-card" onClick={(e) => e.stopPropagation()}>

        {/* Left sidebar: close button + vertical category tabs */}
        <div id="galSidebar">
          <button id="closeGal" aria-label="close" onClick={onClose}>
            ✕
          </button>
          <div id="tabs">
            {allCategories.map((cat, idx) => (
              <button
                key={cat.icon}
                className={"tab" + (idx === activeCat ? " sel" : "")}
                onClick={() => goToCat(idx)}
              >
                {cat.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Right: scrollable emoji grid */}
        <div id="grid" ref={scrollRef} onScroll={handleScroll}>
          {allCategories.map((cat, idx) => (
            <section
              key={cat.icon}
              className="cat-section"
              ref={(el) => {
                sectionRefs.current[idx] = el;
              }}
            >
              <div className="cat-cells">
                {cat.items.map((ch, i) => (
                  <button
                    key={ch.startsWith("data:") ? `${ch.slice(0, 30)}-${ch.length}` : ch + i}
                    className="cell"
                    onClick={() => { if (!interactionLocked) onPick(ch); }}
                  >
                    {ch.startsWith("data:") ? (
                      <img src={ch} alt="sticker" className="cell-img" />
                    ) : (
                      ch
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
