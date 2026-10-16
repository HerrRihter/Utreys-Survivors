import { getWaveSchedule, selectWaveUnit } from './wave-schedule.js';

const TAU = Math.PI * 2;

// Mid-run events. `state.eventPlan` (from the seed) says when each starts; `state.event` is the
// running one: { type, left, progress, need, x, y, radius }.
//   friday   — a ring of enemies arrives from every side; survive it for an update bundle
//   incident — hold a marked point for `hold` seconds; success gives an update bundle
//   rush     — collect `need` of the scattered event codes in time; success pays codes
export const RunEvents = {
  create({ run, world, spawning, progression, toast, audio, math }) {
    const reward = (s) => s.pickups.push({ x: s.p.x, y: s.p.y, type: 'bundle' });

    function begin(s, type) {
      const spec = getWaveSchedule(s.map).events[type];
      const event = { type, left: spec.duration, progress: 0, need: 0 };
      if (type === 'friday') {
        for (let i = 0; i < spec.count; i++) {
          const a = (i / spec.count) * TAU,
            x = math.clamp(s.p.x + Math.cos(a) * 430, 40, world.arena.size - 40),
            y = math.clamp(s.p.y + Math.sin(a) * 430, 60, world.arena.size - 40);
          spawning.spawn(selectWaveUnit(getWaveSchedule(s.map), s.t, math.random()), false, {
            x,
            y,
          });
        }
      } else if (type === 'incident') {
        event.need = spec.hold;
        event.radius = spec.radius;
        for (let attempt = 0; attempt < 30; attempt++) {
          const a = math.rand(0, TAU);
          event.x = math.clamp(s.p.x + Math.cos(a) * spec.distance, 120, world.arena.size - 120);
          event.y = math.clamp(s.p.y + Math.sin(a) * spec.distance, 140, world.arena.size - 120);
          if (!world.arena.blocked(event.x, event.y, spec.radius * 0.5)) break;
        }
      } else if (type === 'rush') {
        event.need = spec.need;
        for (let i = 0; i < spec.tokens; i++) {
          let x = s.p.x,
            y = s.p.y;
          for (let attempt = 0; attempt < 20; attempt++) {
            const a = math.rand(0, TAU),
              d = math.rand(150, 520);
            x = math.clamp(s.p.x + Math.cos(a) * d, 60, world.arena.size - 60);
            y = math.clamp(s.p.y + Math.sin(a) * d, 80, world.arena.size - 60);
            if (!world.arena.blocked(x, y, 10)) break;
          }
          s.codes.push({ x, y, value: 1, event: true });
        }
      }
      s.event = event;
      toast(spec.message);
      audio.effect('boss');
    }

    function end(s, success) {
      const e = s.event;
      s.event = null;
      s.eventIndex++;
      s.eventsDone = (s.eventsDone || 0) + (success ? 1 : 0);
      if (!success) {
        toast('Событие провалено');
        return;
      }
      if (e.type === 'rush') {
        s.earned += progression.earn(25);
        toast('Тираж сдан: +25 кодов');
      } else {
        reward(s);
        toast(e.type === 'friday' ? 'Релиз пережит!' : 'Инцидент закрыт!');
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
      if (e.type === 'incident' && Math.hypot(s.p.x - e.x, s.p.y - e.y) <= e.radius)
        e.progress = Math.min(e.need, e.progress + dt);
      if (e.need && e.progress >= e.need) end(s, true);
      else if (e.left <= 0) end(s, e.type === 'friday' && s.p.hp > 0);
    }

    return { update };
  },
};

// HUD line for the running event; '' when none.
export function eventLabel(s) {
  const e = s?.event;
  if (!e) return '';
  const left = Math.ceil(Math.max(0, e.left)) + ' с';
  if (e.type === 'friday') return `Релиз в пятницу: продержитесь ${left}`;
  if (e.type === 'incident')
    return `Инцидент: удержите точку ${Math.floor(e.progress)}/${e.need} с · ${left}`;
  return `Срочный тираж: ${e.progress}/${e.need} кодов · ${left}`;
}

// The incident's point and its hold progress, drawn on the ground.
export function drawEvent(g, s) {
  const e = s?.event;
  if (e?.type !== 'incident') return;
  g.save();
  g.strokeStyle = '#ff5252';
  g.fillStyle = '#ff525218';
  g.lineWidth = 3;
  g.setLineDash?.([10, 8]);
  g.beginPath();
  g.arc(e.x, e.y, e.radius, 0, TAU);
  g.fill();
  g.stroke();
  g.setLineDash?.([]);
  g.strokeStyle = '#ffd54f';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(e.x, e.y, e.radius + 8, -Math.PI / 2, -Math.PI / 2 + (TAU * e.progress) / e.need);
  g.stroke();
  g.restore();
}
