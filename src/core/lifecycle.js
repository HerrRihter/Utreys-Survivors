// Every subscription belongs to one session and is released exactly once.
export function createEventScope() {
  const cleanups = [];
  let disposed = false;
  return {
    listen(target, event, handler, options) {
      if (disposed) throw new Error('Cannot subscribe after disposal');
      target.addEventListener(event, handler, options);
      cleanups.push(() => target.removeEventListener(event, handler, options));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const cleanup of cleanups.reverse()) cleanup();
      cleanups.length = 0;
    },
  };
}
