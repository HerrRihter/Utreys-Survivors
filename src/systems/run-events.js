import { clamp } from '../core/math.js';
import { getWaveSchedule, selectWaveUnit } from './wave-schedule.js';

const TAU = Math.PI * 2;

// Mid-run events. `state.eventPlan` (from the seed) says when each starts; `state.event` is the
// running one: { type, left, progress, need, x, y, radius }. The type's data (the map's
// schedule `events`, data/enemies/waves.js) names its `kind`, its numbers, its messages and
// its `reward`; the kind says what happens:
//   siege    a ring of `count` enemies arrives from `distance` away; survive `duration`
//   hold     stand in a marked point for `hold` seconds within `duration`
//   collect  pick up `need` of `tokens` scattered event codes within `duration`
// `c` is { s, world, spawning }; `begin` sets the event's goal, `update` advances it,
// `code` counts a picked event code, `survived` says whether running out of time is a success.
export const eventKinds = {
  siege: {
    begin(c, event, spec) {
      const { s, world } = c;
      for (let i = 0; i < spec.count; i++) {
        const a = (i / spec.count) * TAU,
          x = clamp(s.p.x + Math.cos(a) * spec.distance, 40, world.arena.size - 40),
          y = clamp(s.p.y + Math.sin(a) * spec.distance, 60, world.arena.size - 40);
        c.spawning.spawn(selectWaveUnit(getWaveSchedule(s.map), s.t, s.rng.random()), false, {
          x,
          y,
        });
      }
    },
    survived: (s) => s.p.hp > 0,
  },
  hold: {
    begin(c, event, spec) {
      const { s, world } = c;
      event.need = spec.hold;
      event.radius = spec.radius;
      for (let attempt = 0; attempt < 30; attempt++) {
        const a = s.rng.rand(0, TAU);
        event.x = clamp(s.p.x + Math.cos(a) * spec.distance, 120, world.arena.size - 120);
        event.y = clamp(s.p.y + Math.sin(a) * spec.distance, 140, world.arena.size - 120);
        if (!world.arena.blocked(event.x, event.y, spec.radius * 0.5)) break;
      }
    },
    update(s, e, dt) {
      if (Math.hypot(s.p.x - e.x, s.p.y - e.y) <= e.radius)
        e.progress = Math.min(e.need, e.progress + dt);
    },
  },
  collect: {
    begin(c, event, spec) {
      const { s, world } = c;
      event.need = spec.need;
      for (let i = 0; i < spec.tokens; i++) {
        let x = s.p.x,
          y = s.p.y;
        for (let attempt = 0; attempt < 20; attempt++) {
          const a = s.rng.rand(0, TAU),
            d = s.rng.rand(spec.near, spec.far);
          x = clamp(s.p.x + Math.cos(a) * d, 60, world.arena.size - 60);
          y = clamp(s.p.y + Math.sin(a) * d, 80, world.arena.size - 60);
          if (!world.arena.blocked(x, y, 10)) break;
        }
        s.codes.push({ x, y, value: 1, event: true });
      }
    },
    code(e) {
      e.progress++;
    },
  },
};

export const RunEvents = {
  create({ run, world, spawning, progression, toast, audio }) {
    const specOf = (s, type) => getWaveSchedule(s.map).events[type];
    const kindOf = (s, e) => eventKinds[specOf(s, e.type).kind];

    function begin(s, type) {
      const spec = specOf(s, type);
      const event = { type, left: spec.duration, progress: 0, need: 0 };
      eventKinds[spec.kind].begin({ s, world, spawning }, event, spec);
      s.event = event;
      toast(spec.message);
      audio.effect('boss');
    }

    // A success pays the type's `reward`: `codes` to the account, or a `pickup` at the hero.
    function end(s, success) {
      const e = s.event,
        spec = specOf(s, e.type);
      s.event = null;
      s.eventIndex++;
      if (success) s.eventsDone++;
      if (!success) {
        toast(spec.failed);
        return;
      }
      const { codes, pickup } = spec.reward;
      if (codes) {
        s.earned += progression.earn(codes);
        toast(`${spec.success}: +${codes} кодов`);
      } else {
        s.pickups.push({ x: s.p.x, y: s.p.y, type: pickup });
        toast(spec.success);
      }
      audio.effect('level');
    }

    function update(dt) {
      const s = run.state;
      if (!s?.eventPlan) return;
      const next = s.eventPlan[s.eventIndex];
      if (!s.event && next && s.t >= next.time && !s.bossSpawned) begin(s, next.type);
      const e = s.event;
      if (!e) return;
      e.left -= dt;
      const kind = kindOf(s, e);
      kind.update?.(s, e, dt);
      if (e.need && e.progress >= e.need) end(s, true);
      else if (e.left <= 0) end(s, !!kind.survived?.(s, e));
    }

    // The hero picked up an event code (`code.event`): the running event may count it.
    function collectCode(s) {
      if (s.event) kindOf(s, s.event).code?.(s.event);
    }

    return { update, collectCode };
  },
};
