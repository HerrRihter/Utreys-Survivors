// The run journal as a file for the player: export downloads it, clear empties it.
export function createRunLogFile({ window, document, runLog, ui }) {
  // Saves the run journal as a JSON file; returns the file's text (tests read it).
  function exportRunLog() {
    const text = runLog.json();
    try {
      const blob = new window.Blob([text], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `utreys-runs-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch {}
    return text;
  }
  function clearRunLog() {
    runLog.clear();
    ui.emit();
  }
  return { exportRunLog, clearRunLog };
}
