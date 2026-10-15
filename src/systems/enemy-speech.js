import { enemyPhrases, speechSettings } from '../../data/enemies/phrases.js';

export function updateEnemySpeech(context) {
  const s = context.state;
  for (const enemy of s.enemies)
    if (enemy.speech && (enemy.hp <= 0 || s.t >= enemy.speech.until)) enemy.speech = null;
  if (s.t < (s.nextSpeechAt ?? speechSettings.interval)) return;
  const width = context.W || 960,
    height = context.H || 640;
  const cx = Math.max(0, Math.min(context.WORLD - width, s.p.x - width / 2));
  const cy = Math.max(0, Math.min(context.WORLD - height, s.p.y - height / 2));
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
  const cursor = s.speechCursor || 0;
  const enemy = candidates[cursor % candidates.length];
  const phrases = enemyPhrases[enemy.unit];
  const index = s.speechPhraseIndex?.[enemy.unit] || 0;
  enemy.speech = { text: phrases[index % phrases.length], until: s.t + speechSettings.duration };
  enemy.nextSpeechAt = s.t + speechSettings.perEnemyCooldown;
  s.speechPhraseIndex ??= {};
  s.speechPhraseIndex[enemy.unit] = index + 1;
  s.speechCursor = cursor + 1;
  s.nextSpeechAt = s.t + speechSettings.interval;
}
