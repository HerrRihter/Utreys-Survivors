import { mapDefinitions } from '../../data/maps/maps.js';
import { logEntry } from '../systems/run-log.js';

// What an ending of a run writes to the save: statistics, records, evolutions, the run journal.
export function createRunRecording({ run, progression, upgrades, runLog }) {
  const { records, loads } = progression;
  // Run statistics (src/systems/run-records.js): every ending adds what is new since the
  // previous ending of the same run. Win, death, quitting to the menu and restarting all end
  // a run; a run continued in production ends again later. `victory` only from finish().
  // Learning, incident shift and Penza runs (their balance is not the game's) stay out of
  // records and ratings.
  const practice = (s) => !!(s.learning || s.incident);
  const rated = (s) => !practice(s) && !s.penza;
  function countRun(victory = false) {
    const s = run.state;
    if (!s?.runId || !rated(s)) return null;
    const counted = s.statsCounted ?? { kills: 0, codes: 0 };
    const improved = records.recordRunResult({
      runId: s.runId,
      map: s.map,
      hero: run.selected,
      load: s.load,
      newGame: !s.statsCounted,
      addKills: s.kills - counted.kills,
      addCodes: s.earned - counted.codes,
      time: s.t,
      kills: s.kills,
      codes: s.earned,
      victory,
      production: s.endless ? s.t - s.endlessStart : 0,
    });
    if (improved) s.statsCounted = { kills: s.kills, codes: s.earned };
    return improved;
  }
  // Time, level and the production record; once per ending (a continued run records again).
  // Mastery stats are recorded once per run, at its first ending.
  function recordRun(win = false) {
    const s = run.state;
    if (!s || s.resultRecorded) return null;
    if (rated(s)) records.recordTime(s.t, s.recordedTime);
    if (rated(s)) records.recordLevel(s.level);
    if (rated(s)) records.recordKills(s.kills);
    s.resultRecorded = true;
    s.recordedTime = s.t;
    // Evolutions assembled in this run open their encyclopedia entries.
    for (const w of s.weapons) if (w.evolved) records.recordEvolution(w.id);
    if (s.stats.heroEvo) records.recordEvolution('hero_' + run.selected);
    // The run journal: one entry per ending, with the offers made since the previous one.
    const offers = s.offers;
    runLog?.record(
      logEntry({
        s: { ...s, offers: offers.slice(s.offersLogged) },
        hero: run.selected,
        win,
        build: upgrades.build(run.selected, s),
      }),
    );
    s.offersLogged = offers.length;
    if (!s.statsRecorded && !practice(s)) {
      s.statsRecorded = true;
      const nodesMap = !mapDefinitions[s.map]?.objective;
      records.recordRunStats({
        win,
        hero: run.selected,
        map: s.map,
        time: s.t,
        untouched: (s.firstHurtAt ?? s.t) >= 180,
        // Sweeps are about the five component nodes; desks are always destroyed.
        cleanSweep: nodesMap && s.nodes.every((n) => n.status === 'destroyed'),
        allWorkaround: nodesMap && s.nodes.every((n) => n.status === 'workaround'),
        noFood: !s.foodTaken,
        evolutions: s.evolutions + (s.stats.heroEvo ? 1 : 0),
      });
    }
    if (!s.endless || !rated(s)) return null;
    return loads.recordProduction(
      run.selected,
      s.load,
      s.t - s.endlessStart,
      s.kills - s.endlessKills,
    );
  }
  return { countRun, recordRun };
}
