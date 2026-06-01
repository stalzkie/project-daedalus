import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cesium static assets (Workers, Assets, Widgets, ThirdParty) live in public/cesium/
// so Vite's dev server serves them automatically at /cesium/*.
// Run `cp -r node_modules/cesium/Build/Cesium/{Workers,ThirdParty,Assets,Widgets} public/cesium/`
// after install (or see package.json postinstall).

export default defineConfig({
  plugins: [react()],
  define: {
    // Tells CesiumJS where its workers/assets are at runtime
    CESIUM_BASE_URL: JSON.stringify('/cesium'),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws':  { target: 'ws://localhost:3001',   ws: true },
    },
  },
  optimizeDeps: {
    // Both packages use dynamic imports / top-level await that esbuild can't handle
    // at the default ES2020 target — serve them as raw ESM from node_modules instead.
    exclude: ['cesium', 'satellite.js'],
  },
  build: {
    target: 'esnext',   // satellite.js v7 WASM build uses top-level await
    rollupOptions: {
      output: {
        manualChunks: { cesium: ['cesium'] },
      },
    },
  },
})
