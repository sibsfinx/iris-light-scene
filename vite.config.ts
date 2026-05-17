import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env['VITE_BASE_URL'] ?? './',
  server: {
    port: parseInt(process.env['PORT'] ?? '7341'),
    strictPort: true,
    open: false,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
})
