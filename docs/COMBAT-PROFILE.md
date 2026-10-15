# Combat stalls — 2026-10-11

Reproduction: `node tools/profile-combat.cjs docs/COMBAT-PROFILE.json`.
Requires Playwright and Microsoft Edge; set NODE_PATH to the installed Playwright package root if needed.
The script runs a real browser and the normal animation loop, with an isolated
browser profile, 1920×1080 viewport, seeded random, 120 mixed enemies, moving
invulnerable player and 600 frames on each of three arenas. Audio code/assets
are unchanged. CPU sampling and update/draw timing are enabled.

## Findings

- CPU samples concentrated in collision `distance2`, `clear`, navigation
  `direction` and `field`. Sustained slow updates occurred beside obstacles,
  including frames where the player position was unchanged.
- An unreachable target was not cached, so each enemy could repeat the seed
  search. A reusable seed also failed to update the cached target cell.
- Collision buckets returned nearby but nonintersecting polygons, which still
  underwent all point/edge distance tests.
- Stationary/attacking enemies still requested a route. Zero displacement still
  invoked collision checks.
- Scenery outside the viewport was still submitted to the canvas renderer.

The fixes share the flow-field result for each exact target position and body
radius (including failed searches), update the reused seed's cell, reject
nonintersecting polygon bounds, skip unused route/motion queries, and cull scenery
using the actual image height so visible roofs are retained.

## Measurements

| Arena | Update p95 before → final (ms) | Frame interval p95 before → final (ms) | Frames >33.4 ms before → final |
| --- | --- | --- | --- |
| Village | 27.1 → 8.3 | 36.3 → 23.6 | 49 → 13 |
| Forest | 25.4 → 15.2 | 40.4 → 39.6 | 65 → 60 |
| Camp | 22.4 → 7.4 | 34.7 → 23.1 | 74 → 10 |

Full samples and top CPU stacks: `COMBAT-PROFILE-before.json`,
`COMBAT-PROFILE-after.json` (navigation/collision), `COMBAT-PROFILE-final.json`
(also scenery culling).

These are individual headless Edge runs, not a guaranteed FPS target. Real
delta-time means the actor trajectories differ between runs despite seeded
random. OS/browser scheduling and canvas/GPU work are included in frame
intervals, while only JS callback duration is assigned to update/draw. The
camp runs also show isolated ~1 second RAF intervals with much shorter JS
callbacks; those gaps cannot be attributed to simulation from this CPU profile.
Forest rendering remains expensive and occasional long frames remain; this
does not establish that every reported freeze has been eliminated.

Regression coverage includes shared unreachable-target queries and invalidation
when the hero moves, offscreen scenery/visible roof bounds, existing route and
collision scenarios, combat simulation, all arenas, and classic file bundles.
