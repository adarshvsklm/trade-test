import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `vite dev` we proxy /api calls to the FastAPI backend so the
// frontend can talk to it without CORS hassles. In production the static
// bundle can be served by any host; set VITE_API_BASE to point at the API.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
