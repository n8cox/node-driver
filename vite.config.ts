import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // A backend on another port is a DIFFERENT ORIGIN, and a browser will refuse
  // the request unless that server sends CORS headers. Alignment's local server
  // does not, so pointing VITE_HTTP_BASE_URL straight at :3001 fails in the
  // browser even though the same URL works from curl. Proxying /api through the
  // dev server keeps every request same-origin, which is why this exists.
  const proxyTarget = env.VITE_HTTP_PROXY_TARGET;

  return {
    // Relative base so packaged Electron can load assets via file://
    base: './',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: proxyTarget
      ? {
          proxy: {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
            },
          },
        }
      : undefined,
  };
});
