import { enemyPhrases, speechSettings } from '../../data/enemies/phrases.js';
import { cameraOrigin } from '../rendering/camera.js';

// Picks who speaks next among visible enemies; `view` = { W, H } of the screen.
export function updateEnemySpeech(s, view, worldSize) {
  for (const enemy of s.enemies)
    if (enemy.speech && (enemy.hp <= 0 || s.t >= enemy.speech.until)) enemy.speech = null;
  const r = s.runtime;
  if (s.t < r.nextSpeechAt) return;
  const width = view.W || 960,
    height = view.H || 640;
  const { x: cx, y: cy } = cameraOrigin(s.p, width, height, worldSize);
  const candidates = s.enemies.filter(
    (e) =>
      e.hp > 0 &&
      !e.speech &&
      s.t >= (e.nextSpeechAt || 0) &&
      enemyPhrases[e.unit]?.length &&
      e.x > cx + 60 &&
      e.x < cx + width - 60 &&
      e.y > cy + 110 &&
      e.y < cy + height - 30,
  );
  if (!candidates.length) return;
  // Cosmetic rotation does not consume the gameplay random source.
  const cursor = r.speechCursor;
  const enemy = candidates[cursor % candidates.length];
  const phrases = enemyPhrases[enemy.unit];
  const index = r.speechPhraseIndex[enemy.unit] || 0;
  enemy.speech = { text: phrases[index % phrases.length], until: s.t + speechSettings.duration };
  enemy.nextSpeechAt = s.t + speechSettings.perEnemyCooldown;
  r.speechPhraseIndex[enemy.unit] = index + 1;
  r.speechCursor = cursor + 1;
  r.nextSpeechAt = s.t + speechSettings.interval;
}
