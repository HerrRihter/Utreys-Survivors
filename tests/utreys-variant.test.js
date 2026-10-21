import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';

test('utreys-variant', async () => {
  const root = path.resolve(import.meta.dirname, '..');

  async function main() {
    const { heroDefinitions } = await import('../data/characters/heroes.js');
    const { abilityDefinitions } = await import('../data/characters/abilities.js');
    const { mapDefinitions } = await import('../data/maps/maps.js');
    const { unitDefinitions } = await import('../data/enemies/units.js');
    const { achievementDefinitions } = await import('../data/achievements.js');
    const { createArenas } = await import('../src/world/arenas.js');

    assert.deepEqual(Object.keys(heroDefinitions), [
      'utrace',
      'traceability',
      'serialization',
      'ba',
      'qa',
    ]);
    assert.equal(heroDefinitions.utrace.name, 'Utrace');
    assert.equal(abilityDefinitions.utrace.length, 2);
    assert.deepEqual(Object.keys(mapDefinitions), [
      'empty',
      'serverRoom',
      'pepsiDesk',
      'learningLab',
      'incidentLab',
    ]);

    // Verify new enemies: L3, CRPT, Pepsi, InBev, Mars
    const expectedEnemies = ['l3', 'crpt', 'pepsi', 'inbev', 'mars'];
    for (const enemy of expectedEnemies) {
      assert.ok(unitDefinitions[enemy], `Missing enemy: ${enemy}`);
    }

    for (const achievement of achievementDefinitions.filter(
      ({ category }) => category === 'mastery',
    )) {
      assert.equal(
        achievement.getProgress({ stats: { abilitiesUsed: achievement.target } }),
        achievement.target,
      );
    }

    const arena = createArenas().get('empty');
    assert.equal(arena.clear({ x: 500, y: 500 }, { x: 510, y: 510 }, 14), true);
    assert.equal(arena.blocked(5, 5, 14), true);

    const publicFiles = ['index.html', 'README.md', 'data/achievements.js'];
    const factionNames = /gaul|roman|legion|галл|римлян|римск|легион/i;
    for (const file of publicFiles) {
      if (fs.existsSync(path.join(root, file))) {
        assert.equal(
          factionNames.test(fs.readFileSync(path.join(root, file), 'utf8')),
          false,
          `${file} contains removed faction references`,
        );
      }
    }

    console.log(
      'PASS: Utrace character, datacenter arena, new enemies (L3, ЦРПТ, Пепси, Инбев, Марс) and zero legacy faction references.',
    );
  }

  await main();
});
