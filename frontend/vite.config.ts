import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Library build: a single ES module that defines the <visio-panel> web component.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define:
    command === "build" ? { "process.env.NODE_ENV": JSON.stringify("production") } : {},
  build: {
    outDir: "../custom_components/visio/www",
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: "src/panel.tsx",
      formats: ["es"],
      fileName: () => "visio-panel.js",
    },
  },
  test: { environment: "node" },
}));
