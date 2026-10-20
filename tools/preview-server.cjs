'use strict';
const path = require('node:path');

// The production build in dist/, served by Vite's preview server on a free local port under
// `base` (the browser smoke test also checks a subdirectory). Resolves to { url, close }.
async function startPreview({ base = '/' } = {}) {
  const { preview } = await import('vite');
  const server = await preview({
    configFile: false,
    root: path.resolve(__dirname, '..'),
    base,
    logLevel: 'silent',
    preview: { host: '127.0.0.1', port: 0, strictPort: true },
  });
  return { url: server.resolvedUrls.local[0], close: () => server.close() };
}

module.exports = { startPreview };
