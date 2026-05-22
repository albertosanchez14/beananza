import path from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.INTERNAL_API_URL ?? "http://localhost:8080";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/rooms": apiTarget,
      "/register": apiTarget,
      "/config": apiTarget,
      "/upload-avatar": apiTarget,
      "/user-assets": apiTarget,
      "/ws": {
        target: apiTarget,
        ws: true,
      },
    },
  },
});
