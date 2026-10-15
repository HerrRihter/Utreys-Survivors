const {loadModule}=require('./load-modules.cjs');
const {canvasContext}=require('./canvas-context.cjs');
'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const noop = () => {};

async function createHarness({createSession = true} = {}) {
  const nodes = new Map(), listeners = {}, scheduled = new Map();
  let frameId = 0;
  const context = new Proxy(canvasContext({createRadialGradient: () => ({addColorStop: noop})}), {
    get: (target, key) => target[key] || noop,
    set: (target, key, value) => (target[key] = value, true),
  });
  function node() {
    const events={};
    const el = {style: {}, className: '', dataset: {}, children: [], events,
      getContext: () => context, addEventListener: (name,handler)=>{events[name]=handler;}, setPointerCapture: noop,
      replaceChildren() {this.children = [];},
      append(...items) {this.children.push(...items);},
      querySelectorAll(selector) {
        return selector === '.run-hero' ? this.children.filter(child => child.className.split(/\s+/).includes('run-hero')) : [];
      },
    };
    el.classList = {
      toggle(name, on) {
        const present = el.className.split(/\s+/).includes(name);
        const active = on === undefined ? !present : on;
        el.className = el.className.split(/\s+/).filter(value => value && value !== name)
          .concat(active ? [name] : []).join(' ');
        return active;
      },
      contains: name => el.className.split(/\s+/).includes(name),
    };
    return el;
  }
  const document = {
    getElementById(id) {if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id);},
    createElement: node, querySelectorAll: () => [], addEventListener: noop,
  };
  const env = {document, window: {addEventListener: (event, handler) => {listeners[event] = handler;}},
    localStorage: {getItem: () => null, setItem: noop}, performance: {now: () => 0},
    requestAnimationFrame(callback) {const id = ++frameId; scheduled.set(id, callback); return id;},
    cancelAnimationFrame(id) {scheduled.delete(id);},
    // Each harness owns its random source; rare-drop tests cannot mutate host Math.
    Math: Object.create(Math), console,
    AssetPaths: {url: relative => 'assets/runtime/' + relative},
  };
  vm.createContext(env);
  for (const file of ['src/systems/upgrades.js', 'src/systems/persistence.js', 'src/rendering/art/projectile-art.js', 'src/entities/heroes.js',
    'src/rendering/art/roman-art-legacy.js', 'src/rendering/art/roman-art.js', 'src/world/village/collision.js', 'src/world/village/village-data.js', 'src/world/village/navigation.js', 'src/world/village/village-renderer.js', 'src/world/village/village.js',
    'src/entities/legion.js', 'src/systems/corpses.js', 'src/ui/menu-portraits.js', 'src/rendering/canvas.js','src/core/audio.js','src/rendering/sprite-renderer.js','src/ui/game-ui.js','src/app/game-flow.js','src/systems/enemy-spawning.js','src/systems/combat.js','src/systems/simulation.js','src/rendering/scene-renderer.js','src/core/input.js','src/core/game-loop.js','src/app/game-session.js']) {
    await loadModule(env,path.join(root,file));
  }
  function tick(now) {
    const [id, callback] = scheduled.entries().next().value;
    scheduled.delete(id);
    callback(now);
  }
  return {env, nodes, listeners, scheduled, tick, noop, context,
    session: createSession ? env.GameSession.create(env) : null};
}

module.exports = {createHarness};
