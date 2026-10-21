// Top-left world point of the view centred on the player, kept inside the arena. A generated
// room (the learning mazes and hall, `free`) keeps the player centred even at its edge: its
// corridors run along the border, where a stopped camera would put the hero under the HUD.
export function cameraOrigin(player, width, height, world, free = false) {
  if (free) return { x: player.x - width / 2, y: player.y - height / 2 };
  return {
    x: Math.max(0, Math.min(world - width, player.x - width / 2)),
    y: Math.max(0, Math.min(world - height, player.y - height / 2)),
  };
}
