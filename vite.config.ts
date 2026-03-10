import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Optimizar React para producción
      babel: {
        plugins: []
      }
    })
  ],
  server: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    // Habilitar minificación y tree-shaking agresivo
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
      },
    },
    // Code splitting optimizado
    rollupOptions: {
      output: {
        manualChunks: {
          // React y ReactDOM - vendor principal
          'vendor-react': ['react', 'react-dom'],
          // Iconos - separado para cache
          'vendor-ui': ['lucide-react'],
          // Yjs y sincronización - vendor de estado
          'vendor-yjs': ['yjs', 'y-indexeddb', 'y-trystero', 'trystero'],
        },
        // Configurar nombre de chunks para mejor cache
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        // Split en chunks más pequeños para mejor lazy loading
        experimentalMinChunkSize: 10 * 1024,
        inlineDynamicImports: false,
      },
      // Tree shaking agresivo
      treeshake: {
        preset: 'recommended',
        annotations: true,
      },
    },
    // Aumentar límite para chunks grandes
    chunkSizeWarningLimit: 1000,
    // Target moderno para mejor optimización
    target: 'esnext',
    // CSS code splitting
    cssCodeSplit: true,
    // Assets inline limit
    assetsInlineLimit: 4096,
  },
  // Optimizaciones de desarrollo
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react'],
    exclude: ['yjs', 'trystero'],
  },
  // Pre-bundle dependencies
  preTransformRequests: true,
})