import path from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.INTERNAL_API_URL;

  if (command === "serve" && !apiTarget) {
    throw new Error("INTERNAL_API_URL must be set in game-client/.env");
  }

  return {
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
    ...(command === "serve" && apiTarget
      ? {
          server: {
            port: 3000,
            host: "0.0.0.0",
            proxy: {
              "/rooms": apiTarget,
              "/register": apiTarget,
              "/config": apiTarget,
              "/upload-avatar": apiTarget,
              "/user-avatars": apiTarget,
              "/ws": {
                target: apiTarget,
                ws: true,
              },
            },
          },
        }
      : {}),
  };
});
