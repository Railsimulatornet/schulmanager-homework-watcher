const { checkHealth } = require('./lib/scheduler-health');
try {
  checkHealth();
  console.log('Zeitplanung und lokaler Arbeitszustand sind in Ordnung.');
} catch (_) {
  console.error('Die Betriebsprüfung des Schulmanagers ist fehlgeschlagen.');
  process.exitCode = 1;
}
