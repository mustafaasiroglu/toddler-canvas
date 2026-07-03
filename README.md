# Creative Canvas 🎨

A playful, toddler-friendly creative canvas. Draw with a chunky brush, drop
emoji stickers (drag, pinch-to-scale, twist-to-rotate), erase, and hear soft
synthesized sounds. A math-gated settings popup keeps grown-up controls out of
little hands.

Frontend-only. Runs in any modern browser today and is structured to become a
native mobile app later.

## Tech stack

- **React 18 + TypeScript + Vite** — fast, modular, type-safe.
- **Framework-agnostic engine** — the delicate canvas/gesture/audio logic lives
  in [`src/engine`](src/engine) as plain TypeScript classes, decoupled from the
  UI so it can be reused elsewhere.
- **No backend, no external assets** — sounds are synthesized with the Web Audio
  API; art is emoji + `<canvas>`.

## Project structure

```
src/
  engine/            # portable core (no React)
    CanvasEngine.ts  # stage: drawing segments + emoji stickers + gestures
    audio.ts         # synthesized sound effects
    geometry.ts      # small math helpers
  data/              # emoji categories + default palette
  hooks/             # useCanvasEngine (engine lifecycle)
  components/        # Toolbar, Palette, EmojiGallery, SettingsModal (+ CSS)
  styles/            # base + stage styles
  App.tsx            # wires state <-> engine
  main.tsx           # entry
```

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build
```

## Deploy (GitHub Pages)

Pushing to `main` triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml),
which builds and publishes `dist/` to GitHub Pages. Enable it once under
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

The Vite `base` is `./` (relative), so the app works from any Pages sub-path
without hard-coding the repository name.

## Going mobile later

Because the app is a self-contained web build with no backend, the intended
path to native iOS/Android is [Capacitor](https://capacitorjs.com/): wrap the
`dist/` output in a native shell. The canvas, gestures, and Web Audio already
work inside mobile web views, so little to no rewrite is expected. The
UI-independent engine also leaves the door open for a React Native port if
richer native rendering is ever needed.
