import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['5173-iys5mniiz7jb4wg6aawdx-d6669e93.manusvm.computer', '.manusvm.computer'],
    hmr: {
      clientPort: 5173,
    },
  },
  build: {
    outDir: 'dist',
  },
})

