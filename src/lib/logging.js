const { DateTime } = require('luxon');

const CONSOLE_ORIGINALS_KEY = Symbol.for('schulmanager-homework-watcher.consoleOriginals');

function resolveTimezone(timezone) {
  return timezone || process.env.TZ || 'Europe/Berlin';
}

function buildLogTimestamp(timezone) {
  const configuredZone = resolveTimezone(timezone);
  const zonedNow = DateTime.now().setZone(configuredZone).setLocale('de');
  const timestampSource = zonedNow.isValid ? zonedNow : DateTime.now().setLocale('de');

  return timestampSource.toFormat('dd.MM.yyyy HH:mm:ss');
}

function installTimestampedConsole(timezone) {
  if (global[CONSOLE_ORIGINALS_KEY]) {
    return;
  }

  const originals = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console)
  };

  global[CONSOLE_ORIGINALS_KEY] = originals;

  for (const method of Object.keys(originals)) {
    console[method] = (...args) => {
      originals[method](`[${buildLogTimestamp(timezone)}]`, ...args);
    };
  }
}

module.exports = {
  buildLogTimestamp,
  installTimestampedConsole
};
