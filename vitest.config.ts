import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    // Vitest loads .env.local like any Vite build, so a developer who points
    // their own checkout at a live backend would otherwise have App tests build
    // an HttpAdapter and fail against a server the suite never intended to hit.
    // The suite pins its own adapter; tests that want HTTP construct it directly.
    env: {
      VITE_ADAPTER: 'sample',
      VITE_HTTP_BASE_URL: '',
      VITE_HTTP_TOKEN: '',
      VITE_HTTP_PROXY_TARGET: '',
    },
  },
});
