import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: process.env.BACKEND_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
