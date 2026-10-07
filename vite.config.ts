import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: '.',
  publicDir: 'public',
  resolve: { alias: { '@shared': path.resolve('src/shared'), '@': path.resolve('src/web') } },
  build: { outDir: 'dist/web', emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks(id: string) { if (!id.includes('node_modules')) return; if (/recharts|d3-|victory/.test(id)) return 'charts'; if (/react-dom|react-router|@tanstack|scheduler|\/react\//.test(id)) return 'vendor' } } } },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: false } } },
})
