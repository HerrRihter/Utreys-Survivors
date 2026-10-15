'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {pathToFileURL} = require('node:url');
const {createHarness} = require('./helpers/game-harness.cjs');
const {generateFileBundles} = require('../tools/generate-file-bundles.cjs');
const root = path.resolve(__dirname, '..');

(async () => {
  const outputs = generateFileBundles({root, check: true});
  for (const output of outputs) new vm.Script(fs.readFileSync(path.join(root, output), 'utf8'), {filename: output});
  const pages=['index.html','legion-preview.html','village-preview.html',
    ...fs.readdirSync(path.join(root,'previews')).filter(f=>f.endsWith('.html')).map(f=>'previews/'+f)];
  for(const page of pages){
    const html=fs.readFileSync(path.join(root,page),'utf8');
    const launch=html.match(/<script data-entry="([^"]+)" data-file-bundle="([^"]+)">([\s\S]*?)<\/script>/);
    assert(launch,`Missing launcher: ${page}`);
    for(const protocol of ['file:','http:']){
      let appended;
      const document={currentScript:{dataset:{entry:launch[1],fileBundle:launch[2]}},
        createElement:()=>({}),body:{appendChild(script){appended=script;}}};
      vm.runInNewContext(launch[3],{document,location:{protocol}});
      assert.equal(appended.src,protocol==='file:'?launch[2]:launch[1]);
      assert.equal(appended.type,protocol==='file:'?undefined:'module');
      assert(fs.existsSync(path.resolve(root,path.dirname(page),appended.src)));
    }
  }
  const h = await createHarness({createSession: false});
  h.env.URL = URL;
  h.env.document.currentScript = {src: pathToFileURL(path.join(root,'runtime/src/main.js')).href};
  Object.assign(h.env.window, {localStorage:h.env.localStorage, requestAnimationFrame:h.env.requestAnimationFrame,
    cancelAnimationFrame:h.env.cancelAnimationFrame});
  const requests = [];
  h.env.Image = class {
    set src(value) {requests.push(value);}
  };
  vm.runInContext(fs.readFileSync(path.join(root,'runtime/src/main.js'),'utf8'),h.env);
  assert.equal(h.scheduled.size,1,'Classic bundle boots the real game loop');
  assert(requests.length > 10,'Image loaders run in the classic bundle');
  for(const url of requests){
    assert(url.startsWith(pathToFileURL(path.join(root,'assets/runtime')).href+'/'));
    assert(fs.existsSync(require('node:url').fileURLToPath(url)),`Missing image: ${url}`);
  }
  h.nodes.get('start').onclick();
  assert(h.nodes.get('runHeroes').children.length >= 2,'Hero selection opens');
  h.nodes.get('runHeroStart').onclick();
  h.tick(16);h.tick(32);
  assert(h.nodes.get('levelText').textContent.includes('110 / 110'),'Run starts and updates HUD');
  assert.equal(h.nodes.get('time').textContent,'00:00');
  console.log(`PASS: ${outputs.length} classic bundles compile; file URLs, images, hero selection and run bootstrap work.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
