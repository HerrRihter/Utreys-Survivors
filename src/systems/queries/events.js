import { waveSchedules } from '../../../data/enemies/waves.js';

// The data of the running event's type (the map's schedule `events`), or null.
export const eventSpec = (s) => (s?.event && waveSchedules[s.map]?.events?.[s.event.type]) || null;
