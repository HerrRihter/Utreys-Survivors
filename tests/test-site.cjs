'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {once} = require('node:events');
const {createServer} = require('../tools/server.cjs');
const {buildSite, publicationFiles} = require('../tools/site-builder.cjs');
const manifest = require('../tools/publication-manifest.cjs');
const {loadModule,linkModule,moduleFiles,resourcePath}=require('./helpers/load-modules.cjs');

function inventory(files) {
  return {pages: [], groups: [{files}]};
}

function listFiles(root, prefix = '') {
  return fs.readdirSync(root, {withFileTypes: true}).flatMap(entry => {
    const file = prefix + entry.name;
    return entry.isDirectory() ? listFiles(path.join(root, entry.name), file + '/') : [file];
  }).sort();
}

function checkBuildFailures() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gaul-site-test-'));
  try {
    fs.mkdirSync(path.join(root, '_site'));
    fs.writeFileSync(path.join(root, '_site', 'previous.txt'), 'last good build');
    assert.throws(() => buildSite({root, inventory: inventory(['missing.png'])}), /Missing publication resource/);
    assert.equal(fs.readFileSync(path.join(root, '_site', 'previous.txt'), 'utf8'), 'last good build');
    for (const file of ['../outside.js', '/outside.js', 'C:/outside.js', '_site/stale.js', 'a\\b.js']) {
      assert.throws(() => publicationFiles(inventory([file])), /Unsafe publication path/);
    }
    assert.throws(() => publicationFiles(inventory(['same.js', 'same.js'])), /Duplicate/);
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
    buildSite({root, inventory: inventory(['index.html'])});
    assert.deepEqual(listFiles(path.join(root, '_site')), ['.nojekyll', 'index.html'], 'Stale output is removed');
  } finally {
    // root is a unique directory allocated by this test under the OS temp directory.
    fs.rmSync(root, {recursive: true, force: true});
  }
}

// Exercise real asset-loading code with Image/Canvas stubs. This catches generated
// filenames and loads deferred walking atlases after isolated frames complete.
async function imageRequests(out, html, pageURL, baseURL) {
  const entries=[...html.matchAll(/data-entry="([^"]+)"\s+data-file-bundle="([^"]+)"/g)];
  assert.equal(entries.length,1, `${pageURL}: every interactive page must have exactly one launch entry`);
  const requests = new Set(), pending = [];
  const noop = () => {};
  const context = new Proxy({}, {get: () => noop});
  const env = {
    console, URL, Event: class {},
    document: {
      currentScript: null,
      dispatchEvent: noop,
      createElement: () => ({getContext: () => context}),
    },
    Image: class {
      naturalWidth = 256;
      naturalHeight = 256;
      set src(value) {
        const url=value.startsWith('file:')?new URL(path.relative(out,resourcePath(value)).replaceAll('\\','/'),baseURL):new URL(value,pageURL);
        requests.add(url.href);
        pending.push(this);
      }
    },
  };
  for (const match of entries) {
    requests.add(new URL(match[2],pageURL).href);
    const url = new URL(match[1], pageURL);
    const file = decodeURIComponent(url.pathname.slice(new URL(baseURL).pathname.length));
    await linkModule(env,path.join(out,file));
  }
  const graph=moduleFiles(env);
  for(const file of graph){
    requests.add(new URL(path.relative(out,file).replaceAll('\\','/'),baseURL).href);
    if(/(?:-art|roman-art-legacy)\.js$/.test(file))await loadModule(env,file);
  }
  while (pending.length) pending.shift().onload?.();
  return requests;
}

async function main() {
  checkBuildFailures();
  const migration = require('../docs/MIGRATION-PATHS.json');
  for (const record of migration.filter(record => /\.(png|jpg|json|txt)$/.test(record.to))) {
    const bytes = fs.readFileSync(path.resolve(__dirname, '..', record.to));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), record.sha256,
      `Migration preserves source material: ${record.to}`);
  }
  const result = buildSite();
  const expected = [...publicationFiles(), '.nojekyll'].sort();
  assert.deepEqual(listFiles(result.out), expected, 'Output exactly matches the inventory');
  const second = buildSite();
  assert.equal(second.bytes, result.bytes);
  assert.deepEqual(listFiles(second.out), expected, 'Rebuild preserves the same inventory');

  const prefix = '/gaul-survivors/';
  const server = createServer({root: result.out, prefix});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${server.address().port}${prefix}`;
    const allRequests = new Set();
    for (const page of manifest.pages) {
      const pageURL = new URL(page, base);
      const response = await fetch(pageURL);
      assert.equal(response.status, 200, page);
      const html = await response.text();
      const requests = await imageRequests(result.out, html, pageURL, base);
      for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']|url\(["']?([^\s"')]+)["']?\)/gi)) {
        const value = match[1] || match[2];
        if (!/^(?:https?:|data:|mailto:|#)/i.test(value)) requests.add(new URL(value, pageURL).href);
      }
      // Audio loads only after a user gesture and is absent from the image loader graph.
      if (page === 'index.html') for (const file of publicationFiles().filter(file => file.startsWith('assets/runtime/audio/'))) requests.add(new URL(file, base).href);
      for (const request of requests) {
        assert(new URL(request).pathname.startsWith(prefix), `${page}: URL escapes project prefix: ${request}`);
        const resource = await fetch(request);
        assert.equal(resource.status, 200, `${page}: missing ${request}`);
        const file = decodeURIComponent(new URL(request).pathname.slice(prefix.length));
        if (file.endsWith('.mp3')) assert.equal(resource.headers.get('content-type'), 'audio/mpeg');
        if (file.endsWith('.ogg')) assert.equal(resource.headers.get('content-type'), 'audio/ogg');
        const body = Buffer.from(await resource.arrayBuffer());
        assert.deepEqual(body, fs.readFileSync(path.join(result.out, file)), 'Served resource matches build');
        if(file.endsWith('.css'))for(const match of body.toString().matchAll(/url\(["']?([^\s"')]+)["']?\)/g))requests.add(new URL(match[1],request).href);
        allRequests.add(file);
      }
    }
    assert.equal((await fetch(base)).status, 200, 'Project root opens the game');
    for (const file of publicationFiles()) {
      if (!manifest.pages.includes(file)) assert(allRequests.has(file), `Unaccounted published dependency: ${file}`);
    }
    for (const file of ['animation-audit.html', 'animation-preview.html', 'test.cjs',
      'menu-restored.png', 'hero-cacofonix-v1.png', 'menhir-flight.png', 'unit-dimensions.json']) {
      assert.equal((await fetch(new URL(file, base))).status, 404, `Development file excluded: ${file}`);
    }
    console.log(`PASS: ${manifest.pages.length} pages, ${allRequests.size} dependencies under project prefix, ` +
      'deferred image loads, exact inventory, repeat build, stale cleanup and missing-file failure.');
    console.log(`Publication: ${result.files.length} files + .nojekyll, ${(result.bytes / 1e6).toFixed(2)} MB.`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  // Local authoring pages stay functional after moving into previews/.
  const sourceRoot = path.resolve(__dirname, '..');
  const sourceServer = createServer({root: sourceRoot, prefix});
  sourceServer.listen(0, '127.0.0.1');
  await once(sourceServer, 'listening');
  try {
    const base = `http://127.0.0.1:${sourceServer.address().port}${prefix}`;
    const previews=fs.readdirSync(path.join(sourceRoot,'previews')).filter(file=>file.endsWith('.html'));
    for (const page of previews) {
      const pageURL = new URL('previews/' + page, base);
      const response = await fetch(pageURL);
      assert.equal(response.status, 200);
      const html = await response.text();
      const requests = await imageRequests(sourceRoot, html, pageURL, base);
      for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']|url\(["']?([^\s"')]+)["']?\)/gi)) {
        const value = match[1] || match[2];
        if (!/^(?:https?:|data:|mailto:|#)/i.test(value)) requests.add(new URL(value, pageURL).href);
      }
      for (const url of requests) assert.equal((await fetch(url)).status, 200, `${page}: missing ${url}`);
    }
    assert.equal((await fetch(base)).headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal((await fetch(new URL('src/rendering/asset-paths.js', base))).headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.equal((await fetch(new URL('missing.png', base))).status, 404);
    console.log(`PASS: all ${previews.length} local previews load scripts, images and navigation after migration.`);
  } finally {
    await new Promise(resolve => sourceServer.close(resolve));
  }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
