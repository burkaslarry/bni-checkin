import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:10000",
        changeOrigin: true
      },
      "/ws": {
        target: "ws://localhost:10000",
        ws: true
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "EventXP for BNI Anchor",
        short_name: "EventXP",
        description: "QR code attendance tracker for BNI Anchor members.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: ".",
        icons: [
          {
            src: "/icon.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any maskable"
          },
          {
            src: "/icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      }
    })
  ]
});

