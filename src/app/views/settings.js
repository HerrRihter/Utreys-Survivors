import { defaultBindings, bindingLabels, uiScales } from '../run-state.js';
import { keyLabel } from './format.js';

export function settingsView({ run, settings, audio, runLog = null, devTools = false }) {
  return {
    // The run journal's export and clearing are a balance tool (?dev).
    devTools,
    // Key bindings and keyboard hints only make sense with a keyboard.
    keyboard: !run.touchOnly,
    runLogCount: runLog ? runLog.count() : 0,
    shake: settings.shake,
    hints: settings.hints,
    damageNumbers: settings.damageNumbers,
    penza: settings.penza,
    uiScale: settings.uiScale,
    scales: uiScales,
    capture: run.capture || null,
    bindings: Object.keys(defaultBindings).map((action) => ({
      action,
      label: bindingLabels[action],
      key: keyLabel(settings.bindings[action]),
    })),
    ...audio.settings,
  };
}
