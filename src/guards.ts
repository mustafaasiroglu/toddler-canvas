/**
 * Global guards to keep the toddler experience distraction-free:
 * kills page zoom, double-tap zoom, context menu, and multi-touch scroll.
 */
document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);

export {};
