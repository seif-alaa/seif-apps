import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  // Relative base so the build works from any static host or sub-path.
  base: "./",
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "sw-actions.js"],
      manifest: {
        name: "Ledger",
        short_name: "Ledger",
        description: "Private, offline-first money tracking that files your transactions for you.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#131211",
        theme_color: "#131211",
        // Android: "Share → Ledger" from Messages delivers alert text to ?text=…
        share_target: { action: "./", method: "GET", params: { title: "title", text: "text" } },
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html",
        importScripts: ["sw-actions.js"],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          charts: ["recharts"],
          data: ["dexie", "dexie-react-hooks", "date-fns", "zustand"],
        },
      },
    },
  },
  server: { host: true },
});
