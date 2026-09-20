import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset paths relative so the build works on GitHub Pages subpaths.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // Dev-only CORS workaround for the Steam Store API (production uses the /worker relay).
    proxy: {
      '/steam-store': {
        target: 'https://store.steampowered.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/steam-store/, ''),
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
