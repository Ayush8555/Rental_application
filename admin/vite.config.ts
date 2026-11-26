import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the panel and API share an origin through this proxy, so
// the session cookie works exactly like it will on admin./api. sub-domains.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/admin': { target: 'http://localhost:4000', changeOrigin: false },
      '/_local-storage': { target: 'http://localhost:4000', changeOrigin: false },
    },
  },
  build: {
    sourcemap: false, // no source maps on the public admin host
    target: 'es2022',
  },
});
