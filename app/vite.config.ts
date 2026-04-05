import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist/ui',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/worlds': 'http://localhost:3000',
      '/events': { target: 'http://localhost:3000', changeOrigin: true },
      '/shell': 'http://localhost:3000',
      '/config': 'http://localhost:3000',
    },
  },
})
