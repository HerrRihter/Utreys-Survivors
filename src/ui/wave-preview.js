import {waveRoster} from '../systems/wave-schedule.js';

const clock = seconds => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');

export function waveTiming(schedule, unit) {
  const entry = waveRoster(schedule).find(entry => entry.unit === unit);
  if (!entry) throw new Error('Unit absent from schedule: ' + unit);
  if (schedule.residents.includes(unit)) return 'На карте изначально';
  if (schedule.population?.unit === unit) {
    return 'С начала боя · население ' + schedule.population.initial + '–' + schedule.population.maximum;
  }
  const parts = [entry.time === 0 ? 'С начала боя' : 'С ' + clock(entry.time)];
  const recurring = schedule.recurring.find(spec => spec.unit === unit);
  if (recurring) for (const stage of recurring.stages) {
    parts.push((stage.time ? 'с ' + clock(stage.time) + ' — ' : '') +
      'каждые ' + stage.every + ' с, максимум ' + stage.cap);
  }
  return parts.join(' · ');
}
