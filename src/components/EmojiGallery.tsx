import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIES } from "../data/emojis";
import "./EmojiGallery.css";

interface EmojiGalleryProps {
  open: boolean;
  onClose: () => void;
  onPick: (char: string) => void;
}

export function EmojiGallery({ open, onClose, onPick }: EmojiGalleryProps) {
  const [activeCat, setActiveCat] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const clickScroll = useRef(false); // ignore scroll events triggered by a tab tap

  // Reset to the top whenever the gallery is (re)opened.
  useEffect(() => {
    if (open) {
      setActiveCat(0);
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [open]);

  // Highlight the category whose section is currently at the top of the list.
  const handleScroll = useCallback(() => {
    if (clickScroll.current) return;
    const cont = scrollRef.current;
    if (!cont) return;
    const top = cont.scrollTop + 60; // a little below the very top edge
    let idx = 0;
    for (let i = 0; i < sectionRefs.current.length; i++) {
      const sec = sectionRefs.current[i];
      if (sec && sec.offsetTop <= top) idx = i;
    }
    setActiveCat(idx);
  }, []);

  const goToCat = useCallback((idx: number) => {
    setActiveCat(idx);
    const sec = sectionRefs.current[idx];
    const cont = scrollRef.current;
    if (!sec || !cont) return;
    // Suppress scroll-driven updates until the smooth scroll settles.
    clickScroll.current = true;
    cont.scrollTo({ top: sec.offsetTop, behavior: "smooth" });
    window.setTimeout(() => {
      clickScroll.current = false;
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
            {CATEGORIES.map((cat, idx) => (
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
          {CATEGORIES.map((cat, idx) => (
            <section
              key={cat.icon}
              className="cat-section"
              ref={(el) => {
                sectionRefs.current[idx] = el;
              }}
            >
              <div className="cat-cells">
                {cat.items.map((ch, i) => (
                  <button key={ch + i} className="cell" onClick={() => onPick(ch)}>
                    {ch}
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
