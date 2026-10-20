import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkContentIds, contentIds } from '../tools/check-game-contracts.cjs';
import { test } from 'vitest';

// Game rules and drawing do not compare content ids: the check passes on the project and
// catches a literal id in src/systems or src/rendering, but not in comments or data.
test('content-ids', async () => {
  const ids = contentIds();
  for (const [id, kind] of [
    ['orbit', 'weapon'],
    ['utrace', 'hero'],
    ['overclock', 'ability'],
    ['crpt', 'unit'],
    ['pepsiDesk', 'map'],
    ['friday', 'event'],
    ['freeze', 'pickup'],
  ])
    assert.equal(ids.get(id), kind, id);
  assert(checkContentIds().files > 50, 'the project passes');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utreys-content-ids-'));
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  const check = (exceptions = []) => checkContentIds({ root, ids, exceptions });
  try {
    write('src/systems/clean.js', "// 'orbit' in a comment\nexport const kind = 'orbiter';\n");
    write('data/weapons.js', "export const x = { kind: 'orbit' };\n");
    assert.deepEqual(check(), { files: 1 }, 'comments, other words and data pass');

    for (const [file, text, id] of [
      ['src/systems/weapons.js', "if (w.id === 'orbit') spin();\n", 'orbit'],
      ['src/systems/events.js', "switch (type) {\n  case 'friday':\n}\n", 'friday'],
      ['src/rendering/abilities.js', 'if (abilityActive(s, "overclock")) ring();\n', 'overclock'],
      ['src/rendering/pickups.js', 'const t = `freeze`;\n', 'freeze'],
    ]) {
      write(file, text);
      assert.throws(check, new RegExp(`${file}:\\d+ '${id}'`), file);
      fs.rmSync(path.join(root, file));
    }

    // An exception allows exactly its file and id; one that matches nothing is stale.
    write('src/rendering/art/logo.js', "word(g, 'multon');\n");
    assert.throws(check, /logo\.js:1 'multon' \(unit id\)/);
    const exception = { file: 'src/rendering/art/logo.js', id: 'multon' };
    check([exception]);
    fs.rmSync(path.join(root, 'src/rendering/art/logo.js'));
    assert.throws(() => check([exception]), /stale exception: 'multon'/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log('PASS: no content id literals in game rules or drawing; violations are caught');
});
