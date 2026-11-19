import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const BACKEND = `http://127.0.0.1:${process.env.NEXORA_PORT ?? '8765'}`

export default defineConfig({
  base: './', // relative asset paths so the static /play page can be hosted under any path
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1', // loopback only
    port: 5173,
    strictPort: true,
    proxy: {
      // The dev proxy attaches the per-launch token server-side; browser code never sees it in dev.
      '/api': { target: BACKEND, headers: { 'x-nexora-token': process.env.NEXORA_TOKEN ?? '' } },
    },
  },
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: { main: 'index.html', play: 'play.html' },
      output: {
        // Keep React separate so the lightweight /play page never downloads the 3D engine or the editor.
        manualChunks(id) {
          if (id.includes('commonjsHelpers') || id.includes('preload-helper')) return 'react' // shared runtime helpers
          if (!id.includes('node_modules')) return undefined
          const pkg = id.split(/node_modules[\\/]/).pop()!
          if (/^(react|react-dom|scheduler)[\\/]/.test(pkg)) return 'react'
          if (/^(three|@react-three)[\\/]/.test(pkg)) return 'three'
          if (/^(monaco-editor|@monaco-editor)[\\/]/.test(pkg)) return 'monaco'
          return undefined
        },
      },
    },
  },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'], css: false },
})
