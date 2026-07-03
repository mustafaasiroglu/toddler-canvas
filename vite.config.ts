import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built app works from any GitHub Pages sub-path
// (e.g. https://<user>.github.io/<repo>/) without hard-coding the repo name.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
