import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/digital-evidence-vault/" : "/",
  plugins: [
    tanstackStart(),
    nitro({
      output: {
        dir: "dist",
        serverDir: "{{ output.dir }}/server",
        publicDir: "{{ output.dir }}/client",
      },
    }),
    react(),
  ],
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
  build: {
    cssMinify: false,
  },
});
