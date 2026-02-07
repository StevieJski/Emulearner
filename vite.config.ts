import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist-app',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index-app.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: '/index-app.html',
    // Serve static files from root (for data/, roms/, etc.)
    fs: {
      allow: ['.'],
    },
  },
  // Don't copy public folder to build (EmulatorJS has its own assets)
  publicDir: false,
})
