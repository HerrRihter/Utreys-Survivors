// Top-left world point of the view centred on the player, kept inside the arena.
export function cameraOrigin(player, width, height, world) {
  return {
    x: Math.max(0, Math.min(world - width, player.x - width / 2)),
    y: Math.max(0, Math.min(world - height, player.y - height / 2)),
  };
}
