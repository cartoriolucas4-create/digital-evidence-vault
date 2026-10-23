import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves static files only. This app uses a client-side React
// entry point (src/main.tsx), so do not enable TanStack Start/Nitro SSR here.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/digital-evidence-vault/" : "/",
  plugins: [react()],
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssMinify: false,
  },
});
