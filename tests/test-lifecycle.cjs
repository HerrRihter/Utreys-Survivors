const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');

(async () => {
  const h = await createHarness({ createSession: false });
  const baseline = h.eventCount();
  for (let mount = 0; mount < 3; mount++) {
    const session = h.env.GameSession.create(h.env);
    assert(h.eventCount() > baseline);
    session.run();
    session.run();
    assert.equal(h.scheduled.size, 1, 'one RAF per session');
    session.start();
    h.listeners.keydown({ code: 'Escape', preventDefault() {} });
    assert.equal(session.mode, 'pause', 'one keypress pauses exactly once');
    session.dispose();
    session.dispose();
    assert.equal(h.eventCount(), baseline, 'all subscriptions released');
    assert.equal(h.scheduled.size, 0, 'RAF released');
    session.run();
    assert.equal(h.scheduled.size, 0, 'disposed sessions cannot restart');
  }
  console.log('PASS: session mount/dispose, subscriptions, keyboard and RAF');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
