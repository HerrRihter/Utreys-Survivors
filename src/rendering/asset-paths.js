export let AssetPaths;
'use strict';
// Resolve from this root script, so nested previews and Pages prefixes share paths.
AssetPaths = (() => {
  const base = new URL('../../assets/runtime/', import.meta.url);
  return {url: relative => new URL(relative, base).href};
})();
