import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone app build: /visio-app (HTML served by the integration's view),
// assets under /visio-app/files/ (static path).
export default defineConfig({
  plugins: [react()],
  base: "/visio-app/files/",
  publicDir: "public-app",
  build: {
    outDir: "../custom_components/visio/www/app",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: { input: "visio-app.html" },
  },
});
