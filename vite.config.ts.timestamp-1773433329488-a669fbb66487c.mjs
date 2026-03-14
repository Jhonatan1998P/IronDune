// vite.config.ts
import { defineConfig } from "file:///home/runner/workspace/node_modules/vite/dist/node/index.js";
import react from "file:///home/runner/workspace/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react({
      // Optimizar React para producción
      babel: {
        plugins: []
      }
    })
  ],
  server: {
    port: 5e3,
    host: "0.0.0.0",
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 1e3,
      ignored: ["**/node_modules/**", "**/.cache/**", "**/dist/**"]
    }
  },
  build: {
    // Habilitar minificación y tree-shaking agresivo
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info"]
      }
    },
    // Code splitting optimizado
    rollupOptions: {
      output: {
        manualChunks: {
          // React y ReactDOM - vendor principal
          "vendor-react": ["react", "react-dom"],
          // Iconos - separado para cache
          "vendor-ui": ["lucide-react"],
          // Yjs y sincronización - vendor de estado
          "vendor-yjs": ["yjs", "y-indexeddb", "y-trystero", "trystero"]
        },
        // Configurar nombre de chunks para mejor cache
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
        // Split en chunks más pequeños para mejor lazy loading
        experimentalMinChunkSize: 10 * 1024,
        inlineDynamicImports: false
      },
      // Tree shaking agresivo
      treeshake: {
        preset: "recommended",
        annotations: true
      }
    },
    // Aumentar límite para chunks grandes
    chunkSizeWarningLimit: 1e3,
    // Target moderno para mejor optimización
    target: "esnext",
    // CSS code splitting
    cssCodeSplit: true,
    // Assets inline limit
    assetsInlineLimit: 4096
  },
  // Optimizaciones de desarrollo
  optimizeDeps: {
    include: ["react", "react-dom", "lucide-react"],
    exclude: ["yjs", "trystero"]
  }
  // Pre-bundle dependencies
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3J1bm5lci93b3Jrc3BhY2Uvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KHtcbiAgICAgIC8vIE9wdGltaXphciBSZWFjdCBwYXJhIHByb2R1Y2NpXHUwMEYzblxuICAgICAgYmFiZWw6IHtcbiAgICAgICAgcGx1Z2luczogW11cbiAgICAgIH1cbiAgICB9KVxuICBdLFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiA1MDAwLFxuICAgIGhvc3Q6ICcwLjAuMC4wJyxcbiAgICBhbGxvd2VkSG9zdHM6IHRydWUsXG4gICAgd2F0Y2g6IHtcbiAgICAgIHVzZVBvbGxpbmc6IHRydWUsXG4gICAgICBpbnRlcnZhbDogMTAwMCxcbiAgICAgIGlnbm9yZWQ6IFsnKiovbm9kZV9tb2R1bGVzLyoqJywgJyoqLy5jYWNoZS8qKicsICcqKi9kaXN0LyoqJ10sXG4gICAgfVxuICB9LFxuICBidWlsZDoge1xuICAgIC8vIEhhYmlsaXRhciBtaW5pZmljYWNpXHUwMEYzbiB5IHRyZWUtc2hha2luZyBhZ3Jlc2l2b1xuICAgIG1pbmlmeTogJ3RlcnNlcicsXG4gICAgdGVyc2VyT3B0aW9uczoge1xuICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgZHJvcF9jb25zb2xlOiB0cnVlLFxuICAgICAgICBkcm9wX2RlYnVnZ2VyOiB0cnVlLFxuICAgICAgICBwdXJlX2Z1bmNzOiBbJ2NvbnNvbGUubG9nJywgJ2NvbnNvbGUuaW5mbyddLFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIENvZGUgc3BsaXR0aW5nIG9wdGltaXphZG9cbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgLy8gUmVhY3QgeSBSZWFjdERPTSAtIHZlbmRvciBwcmluY2lwYWxcbiAgICAgICAgICAndmVuZG9yLXJlYWN0JzogWydyZWFjdCcsICdyZWFjdC1kb20nXSxcbiAgICAgICAgICAvLyBJY29ub3MgLSBzZXBhcmFkbyBwYXJhIGNhY2hlXG4gICAgICAgICAgJ3ZlbmRvci11aSc6IFsnbHVjaWRlLXJlYWN0J10sXG4gICAgICAgICAgLy8gWWpzIHkgc2luY3Jvbml6YWNpXHUwMEYzbiAtIHZlbmRvciBkZSBlc3RhZG9cbiAgICAgICAgICAndmVuZG9yLXlqcyc6IFsneWpzJywgJ3ktaW5kZXhlZGRiJywgJ3ktdHJ5c3Rlcm8nLCAndHJ5c3Rlcm8nXSxcbiAgICAgICAgfSxcbiAgICAgICAgLy8gQ29uZmlndXJhciBub21icmUgZGUgY2h1bmtzIHBhcmEgbWVqb3IgY2FjaGVcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLltoYXNoXS5qcycsXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiAnYXNzZXRzL1tuYW1lXS5baGFzaF0uanMnLFxuICAgICAgICBhc3NldEZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV0uW2hhc2hdLltleHRdJyxcbiAgICAgICAgLy8gU3BsaXQgZW4gY2h1bmtzIG1cdTAwRTFzIHBlcXVlXHUwMEYxb3MgcGFyYSBtZWpvciBsYXp5IGxvYWRpbmdcbiAgICAgICAgZXhwZXJpbWVudGFsTWluQ2h1bmtTaXplOiAxMCAqIDEwMjQsXG4gICAgICAgIGlubGluZUR5bmFtaWNJbXBvcnRzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICAvLyBUcmVlIHNoYWtpbmcgYWdyZXNpdm9cbiAgICAgIHRyZWVzaGFrZToge1xuICAgICAgICBwcmVzZXQ6ICdyZWNvbW1lbmRlZCcsXG4gICAgICAgIGFubm90YXRpb25zOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIEF1bWVudGFyIGxcdTAwRURtaXRlIHBhcmEgY2h1bmtzIGdyYW5kZXNcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXG4gICAgLy8gVGFyZ2V0IG1vZGVybm8gcGFyYSBtZWpvciBvcHRpbWl6YWNpXHUwMEYzblxuICAgIHRhcmdldDogJ2VzbmV4dCcsXG4gICAgLy8gQ1NTIGNvZGUgc3BsaXR0aW5nXG4gICAgY3NzQ29kZVNwbGl0OiB0cnVlLFxuICAgIC8vIEFzc2V0cyBpbmxpbmUgbGltaXRcbiAgICBhc3NldHNJbmxpbmVMaW1pdDogNDA5NixcbiAgfSxcbiAgLy8gT3B0aW1pemFjaW9uZXMgZGUgZGVzYXJyb2xsb1xuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdsdWNpZGUtcmVhY3QnXSxcbiAgICBleGNsdWRlOiBbJ3lqcycsICd0cnlzdGVybyddLFxuICB9LFxuICAvLyBQcmUtYnVuZGxlIGRlcGVuZGVuY2llc1xufSkiXSwKICAibWFwcGluZ3MiOiAiO0FBQW9QLFNBQVMsb0JBQW9CO0FBQ2pSLE9BQU8sV0FBVztBQUdsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUE7QUFBQSxNQUVKLE9BQU87QUFBQSxRQUNMLFNBQVMsQ0FBQztBQUFBLE1BQ1o7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixjQUFjO0FBQUEsSUFDZCxPQUFPO0FBQUEsTUFDTCxZQUFZO0FBQUEsTUFDWixVQUFVO0FBQUEsTUFDVixTQUFTLENBQUMsc0JBQXNCLGdCQUFnQixZQUFZO0FBQUEsSUFDOUQ7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUE7QUFBQSxJQUVMLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLFVBQVU7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLGVBQWU7QUFBQSxRQUNmLFlBQVksQ0FBQyxlQUFlLGNBQWM7QUFBQSxNQUM1QztBQUFBLElBQ0Y7QUFBQTtBQUFBLElBRUEsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBO0FBQUEsVUFFWixnQkFBZ0IsQ0FBQyxTQUFTLFdBQVc7QUFBQTtBQUFBLFVBRXJDLGFBQWEsQ0FBQyxjQUFjO0FBQUE7QUFBQSxVQUU1QixjQUFjLENBQUMsT0FBTyxlQUFlLGNBQWMsVUFBVTtBQUFBLFFBQy9EO0FBQUE7QUFBQSxRQUVBLGdCQUFnQjtBQUFBLFFBQ2hCLGdCQUFnQjtBQUFBLFFBQ2hCLGdCQUFnQjtBQUFBO0FBQUEsUUFFaEIsMEJBQTBCLEtBQUs7QUFBQSxRQUMvQixzQkFBc0I7QUFBQSxNQUN4QjtBQUFBO0FBQUEsTUFFQSxXQUFXO0FBQUEsUUFDVCxRQUFRO0FBQUEsUUFDUixhQUFhO0FBQUEsTUFDZjtBQUFBLElBQ0Y7QUFBQTtBQUFBLElBRUEsdUJBQXVCO0FBQUE7QUFBQSxJQUV2QixRQUFRO0FBQUE7QUFBQSxJQUVSLGNBQWM7QUFBQTtBQUFBLElBRWQsbUJBQW1CO0FBQUEsRUFDckI7QUFBQTtBQUFBLEVBRUEsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLFNBQVMsYUFBYSxjQUFjO0FBQUEsSUFDOUMsU0FBUyxDQUFDLE9BQU8sVUFBVTtBQUFBLEVBQzdCO0FBQUE7QUFFRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
