// Resolve relative to the page, including deployments beneath a repository prefix.
const pageBase =
  typeof document !== 'undefined' && document.baseURI
    ? new URL(import.meta.env?.BASE_URL || './', document.baseURI)
    : new URL(/* @vite-ignore */ '../../', import.meta.url);
const base = new URL('assets/runtime/', pageBase);
export const AssetPaths = { url: (relative) => new URL(relative, base).href };
