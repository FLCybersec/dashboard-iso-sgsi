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
    sourcemap: false,
    rollupOptions: {
      output: {
        // Separa las dependencias (MSAL, Graph SDK, preact...) en un chunk
        // "vendor" estable: cambia poco entre despliegues, asi el navegador lo
        // cachea y en cada release el usuario solo re-descarga el codigo de app.
        // exceljs queda FUERA (se carga de forma diferida solo al exportar).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('exceljs')) return undefined // chunk async propio
          return 'vendor'
        }
      }
    }
  }
})
