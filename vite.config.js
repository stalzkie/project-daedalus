import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cesium static assets (Workers, Assets, Widgets, ThirdParty) live in public/cesium/
// so Vite's dev server serves them automatically at /cesium/*.
// Run `cp -r node_modules/cesium/Build/Cesium/{Workers,ThirdParty,Assets,Widgets} public/cesium/`
// after install (or see package.json postinstall).

export default defineConfig({
  plugins: [react()],
  // satellite.js v7 WASM pthreads file has top-level await; 'es' workers support it
  worker: { format: 'es' },
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
    // esbuild needs esnext target to handle top-level await used by cesium and
    // satellite.js.  With this set we can let Vite pre-bundle both packages
    // normally — it handles all their CJS transitive deps automatically instead
    // of the whack-a-mole of excluding them and individually listing every CJS dep.
    esbuildOptions: { target: 'esnext' },
  },
  build: {
    target: 'esnext',   // satellite.js v7 WASM build uses top-level await
    // satellite.js WASM builds are pure ESM with top-level await.
    // Excluding them prevents @rollup/plugin-commonjs from wrapping them in an
    // iife-format resolver module, which can't handle top-level await.
    commonjsOptions: {
      exclude: [/satellite\.js/],
    },
    rollupOptions: {
      output: {
        manualChunks: { cesium: ['cesium'] },
      },
    },
  },
})
