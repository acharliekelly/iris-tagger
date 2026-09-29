import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: 'apps/web', plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:4174', changeOrigin: true } } },
  build: { outDir: '../../apps/local-api/web-dist', emptyOutDir: true },
});
