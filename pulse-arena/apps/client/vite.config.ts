import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const serverTarget = process.env.PULSE_SERVER ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin proxy so phones on the local network reach the game server through Vite.
    proxy: {
      '/socket.io': { target: serverTarget, ws: true, changeOrigin: true },
      '/api': { target: serverTarget, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/socket.io': { target: serverTarget, ws: true, changeOrigin: true },
      '/api': { target: serverTarget, changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
  },
});
