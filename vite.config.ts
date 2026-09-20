import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/digital-evidence-vault/" : "/",
  plugins: [tanstackStart(), nitro(), react()],
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
});
