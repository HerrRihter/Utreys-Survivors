'use strict';
const {buildSite} = require('./site-builder.cjs');
const {pages} = require('./publication-manifest.cjs');
try {
  const result = buildSite();
  console.log('Published pages: ' + pages.join(', '));
  console.log(`Published ${result.files.length} files, ${(result.bytes / 1e6).toFixed(2)} MB`);
} catch (error) {
  console.error('Site build failed: ' + error.message);
  process.exitCode = 1;
}
