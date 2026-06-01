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
    // cesium and satellite.js use top-level await / dynamic imports that esbuild
    // can't handle at ES2020 — serve them as raw ESM from node_modules.
    exclude: ['cesium', 'satellite.js'],
    // Their CJS transitive dependencies are not pre-bundled either when the
    // parents are excluded.  Explicitly including each one forces Vite to
    // convert module.exports → ESM default so imports resolve correctly.
    include: [
      'mersenne-twister',
      'urijs',
      'bitmap-sdf',
      'draco3d',
      'grapheme-splitter',
      'lerc',
      'protobufjs',
      'commander',
    ],
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
