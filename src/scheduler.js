const { installTimestampedConsole } = require('./lib/logging');
const { config } = require('./lib/config');
const cron = require('node-cron');
const { runWatcher } = require('./run-once');
const { HEALTH_FILE, processStart, writeHealth, checkDataDirectory } = require('./lib/scheduler-health');

function startScheduler({ settings = config, cronEngine = cron, run = runWatcher,
  healthFile = HEALTH_FILE, clock = Date.now, logger = console } = {}) {
  checkDataDirectory(settings.stateDir);
  const maxRunMs = Number(process.env.WATCHER_HEALTH_MAX_RUN_SECONDS || 1800) * 1000;
  if (!Number.isFinite(maxRunMs) || maxRunMs < 60000 || maxRunMs > 3600000) {
    throw new Error('WATCHER_HEALTH_MAX_RUN_SECONDS muss zwischen 60 und 3600 liegen.');
  }
  let runningSince = null;
  let active = false;
  let task;
  const ownerStart = processStart(process.pid);
  if (!ownerStart) throw new Error('Der Prozessstart konnte nicht bestimmt werden.');

  function heartbeat() {
    writeHealth({ schema: 1, pid: process.pid, processStart: ownerStart,
      updatedAt: clock(), schedulerStatus: task.getStatus(),
      nextRunAt: task.getNextRun()?.getTime() ?? null,
      runningSince, maxRunMs }, healthFile);
  }

  async function execute() {
    if (active) return;
    active = true;
    runningSince = clock();
    heartbeat();
    try {
      await run();
    } catch (_) {
      logger.error('[scheduler] Lauf fehlgeschlagen. Details in der lokalen Fehlerübersicht.');
    } finally {
      active = false;
      runningSince = null;
      heartbeat();
    }
  }

  logger.log(`[scheduler] Starte mit Zeitplan: ${settings.cronSchedule}`);
  logger.log(`[scheduler] Zeitzone: ${settings.timezone}`);
  task = cronEngine.schedule(settings.cronSchedule, execute, { timezone: settings.timezone });
  heartbeat();
  const timer = setInterval(heartbeat, 15000);
  timer.unref();
  if (settings.runOnStart) void execute();
  return { task, stop() { clearInterval(timer); task.stop(); heartbeat(); } };
}

if (require.main === module) {
  installTimestampedConsole(config.timezone);
  startScheduler();
}

module.exports = { startScheduler };
