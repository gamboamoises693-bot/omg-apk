import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg"],
      manifest: {
        name: "MG-CASH - GCash Store Manager",
        short_name: "MG-CASH",
        description: "GCash Cash In / Cash Out / Load manager para sa sari-sari store",
        theme_color: "#0B4DA2",
        background_color: "#0B4DA2",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        lang: "fil",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        // Never cache Firebase API calls; Firestore has its own offline cache.
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
});
