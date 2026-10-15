import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import activeAssets from './tools/active-assets.json' with { type: 'json' };

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'active-game-assets',
      buildStart() {
        for (const file of ['opponents-preview.html', 'arena-preview.html']) {
          this.emitFile({
            type: 'asset',
            fileName: file,
            source: readFileSync(new URL(file, import.meta.url)),
          });
        }
        for (const file of activeAssets) {
          this.emitFile({
            type: 'asset',
            fileName: `assets/runtime/${file}`,
            source: readFileSync(new URL(`./assets/runtime/${file}`, import.meta.url)),
          });
        }
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
});
