import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("react")) return "react-vendor";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: [workspaceRoot],
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
});
