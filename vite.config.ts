import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist-app',
  },
  server: {
    port: 3000,
    open: '/index-app.html',
  },
  // Serve data/ folder for EmulatorJS assets
  publicDir: false,
})
