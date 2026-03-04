const cron = require('node-cron');
const { config } = require('./lib/config');
const { runWatcher } = require('./run-once');

console.log(`[scheduler] Starte mit Zeitplan: ${config.cronSchedule}`);
console.log(`[scheduler] Zeitzone: ${config.timezone}`);

cron.schedule(config.cronSchedule, () => {
  runWatcher().catch((error) => {
    console.error('[scheduler] Lauf fehlgeschlagen:', error.message);
  });
}, {
  timezone: config.timezone
});

if (config.runOnStart) {
  runWatcher().catch((error) => {
    console.error('[scheduler] Initialer Lauf fehlgeschlagen:', error.message);
  });
}
