import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const BACKEND = `http://127.0.0.1:${process.env.NEXORA_PORT ?? '8765'}`

export default defineConfig({
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
      output: {
        manualChunks: { three: ['three', '@react-three/fiber', '@react-three/drei'], monaco: ['monaco-editor'] },
      },
    },
  },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'], css: false },
})
