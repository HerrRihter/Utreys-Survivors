import { actionTiming } from '../../data/animations/action-timing.js';

// Read simulation time only: pauses freeze the indicator and haste follows actual timers.
export function traceabilityCharge(state, blocked = false) {
  if (!state) return { charge: 0, flash: 0 };
  const age = state.t - (state.p.chainImpactAt ?? -Infinity);
  const flash = Math.max(0, Math.min(1, 1 - age / 0.18));
  if (blocked) return { charge: 0, flash };
  const action = state.p.action;
  if (action && !action.hit) {
    const progress = Math.min(1, action.elapsed / (action.duration * actionTiming.impactProgress));
    return { charge: 0.7 + progress * 0.3, flash };
  }
  const cycle = state.attackCycle || 0.2;
  const charge = 0.7 * Math.max(0, Math.min(1, 1 - state.attack / cycle));
  return { charge: flash > 0 ? 0 : charge, flash };
}
