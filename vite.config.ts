import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    // ============================================
    // CONFIGURACION ACTUAL: 4 ARCHIVOS
    // ============================================
    // Separa vendors grandes, consolida el resto
    rollupOptions: {
      output: {
        manualChunks: {
          // React - 193 kB (cache a largo plazo)
          'vendor-react': ['react', 'react-dom'],
          // Iconos - 23 kB (estable)
          'vendor-ui': ['lucide-react']
        }
      }
    },
    chunkSizeWarningLimit: 700
  }
})