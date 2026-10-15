// Randomness is injected so simulations and tests can own their random source.
export function createMath(math) {
  return {
    random: () => math.random(),
    rand: (a, b) => a + math.random() * (b - a),
    clamp: (value, low, high) => math.max(low, math.min(high, value)),
    clock: (time) =>
      `${math
        .floor(time / 60)
        .toString()
        .padStart(2, '0')}:${math
        .floor(time % 60)
        .toString()
        .padStart(2, '0')}`,
  };
}
