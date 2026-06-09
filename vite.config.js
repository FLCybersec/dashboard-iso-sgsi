import { defineConfig } from 'vite'

// Preact via alias: react -> preact/compat no es necesario porque usamos
// preact + htm directamente (sin JSX/transpilador adicional).
export default defineConfig({
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
