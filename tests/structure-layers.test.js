import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkLayers } from '../tools/check-structure.cjs';
import contract from '../tools/structure-contract.json' with { type: 'json' };
import { test } from 'vitest';

// The real tree follows the matrix.
test('structure-layers', async () => {
  assert(checkLayers().files > 0);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utrace-layers-'));
  const write = (file, text = '') => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  const violation = (pattern) => assert.throws(() => checkLayers({ root }), pattern);
  try {
    write('data/units.js', 'export const units = {};');
    write('src/core/math.js', "import { units } from '../../data/units.js';");
    write('src/app/run-state.js', "import { units } from '../../data/units.js';");
    write('src/systems/queries/abilities.js', "import { clamp } from '../../core/math.js';");
    write(
      'src/systems/simulation.js',
      "import { abilityActive } from './queries/abilities.js';\nimport '../core/math.js';",
    );
    write(
      'src/rendering/sprites.js',
      "import { abilityActive } from '../systems/queries/abilities.js';",
    );
    write('src/app/preview-kit.js', "import { abilityActive } from '../rendering/sprites.js';");
    write(
      'src/components/ArenaView.tsx',
      "import { createPreviewKit } from '../app/preview-kit.js';",
    );
    write('src/App.tsx', "import { ArenaView } from './components/ArenaView';");
    assert.equal(checkLayers({ root }).files, 9, 'allowed imports pass');

    // A lower layer reaching right: systems → app.
    write(
      'src/systems/simulation.js',
      "import {\n  defaultBindings,\n} from '../app/run-state.js';",
    );
    violation(
      /src\/systems\/simulation\.js \(systems\) imports src\/app\/run-state\.js \(app\); systems may import only: data, core, world/,
    );
    write('src/systems/simulation.js');

    // Rendering reads systems only through queries.
    write('src/systems/combat.js');
    write('src/rendering/sprites.js', "export { damage } from '../systems/combat.js';");
    violation(/rendering\) imports src\/systems\/combat\.js \(systems\)/);
    write('src/rendering/sprites.js');

    // Queries stay pure: no systems behind rendering's back.
    write('src/systems/queries/abilities.js', "import '../combat.js';");
    violation(/systems\/queries\) imports src\/systems\/combat\.js \(systems\)/);
    write('src/systems/queries/abilities.js');

    // Dynamic imports, type imports and data count too.
    write('src/core/math.js', "const late = () => import('../app/run-state.js');");
    violation(/src\/core\/math\.js \(core\) imports src\/app\/run-state\.js/);
    write('src/core/math.js');
    write('data/units.js', "import type { Y } from '../src/core/math.js';");
    violation(
      /data\/units\.js \(data\) imports src\/core\/math\.js \(core\); data may import only: nothing/,
    );
    write('data/units.js');

    // React reaches the game only through app: no renderer, system or data behind its back.
    write('src/components/ArenaView.tsx', "import { drawNodes } from '../rendering/sprites.js';");
    violation(
      /src\/components\/ArenaView\.tsx \(components\) imports src\/rendering\/sprites\.js \(rendering\); components may import only: app/,
    );
    write('src/components/ArenaView.tsx', "import type { Units } from '../../data/units.js';");
    violation(/components\) imports data\/units\.js \(data\)/);
    write('src/components/ArenaView.tsx');
    write('src/App.tsx', "import { units } from '../data/units.js';");
    violation(
      /src\/App\.tsx \(src\) imports data\/units\.js \(data\); src may import only: components/,
    );
    write('src/App.tsx');

    // A new src folder needs a row in the matrix.
    write('src/extras/thing.js');
    violation(/layer "extras" is missing/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  // Every src directory the structure contract allows has a row, and rows name known layers only.
  for (const dir of contract.directories.src)
    assert(contract.layers[dir], dir + ' has a layer row');
  const known = new Set(Object.keys(contract.layers));
  for (const [layer, allowed] of Object.entries(contract.layers))
    if (layer !== '$comment')
      for (const name of allowed) assert(known.has(name), `${layer} lists unknown layer ${name}`);
  console.log('PASS: layer import matrix holds and catches lower layers importing higher ones');
});
