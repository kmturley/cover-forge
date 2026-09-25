import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `base: './'` keeps asset paths relative so the build works on GitHub Pages subpaths.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'release' ? [viteSingleFile()] : [])],
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
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // jsbarcode's src/ files are extensionless ES modules; let Vite transform them instead of loading them with Node.
    server: { deps: { inline: [/jsbarcode/] } },
  },
});
