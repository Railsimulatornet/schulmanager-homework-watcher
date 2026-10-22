const { installTimestampedConsole } = require('./lib/logging');
const { config } = require('./lib/config');
installTimestampedConsole(config.timezone);

const cron = require('node-cron');
const { runWatcher } = require('./run-once');

console.log(`[scheduler] Starte mit Zeitplan: ${config.cronSchedule}`);
console.log(`[scheduler] Zeitzone: ${config.timezone}`);

cron.schedule(config.cronSchedule, () => {
  runWatcher().catch(() => {
    console.error('[scheduler] Lauf fehlgeschlagen. Details in der lokalen Fehlerübersicht.');
  });
}, {
  timezone: config.timezone
});

if (config.runOnStart) {
  runWatcher().catch(() => {
    console.error('[scheduler] Initialer Lauf fehlgeschlagen. Details in der lokalen Fehlerübersicht.');
  });
}
