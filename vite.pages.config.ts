import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "/digital-evidence-vault/",
  plugins: [tsconfigPaths(), react()],
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
    cssMinify: false,
  },
});
