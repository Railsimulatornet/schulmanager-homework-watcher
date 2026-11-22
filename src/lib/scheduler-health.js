const fs = require('fs');
const path = require('path');

const HEALTH_FILE = '/tmp/schulmanager-scheduler-health.json';
const MAX_HEARTBEAT_AGE_MS = 90000;

function processStart(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19] || null;
  } catch (_) {
    return null;
  }
}

function writeHealth(state, file = HEALTH_FILE) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function validateHealth(state, now = Date.now(), lookupProcessStart = processStart) {
  if (!state || state.schema !== 1 || !Number.isInteger(state.pid) || state.pid < 1 ||
      !state.processStart || lookupProcessStart(state.pid) !== state.processStart) {
    throw new Error('Das Lebenszeichen gehört zu keinem aktiven Scheduler.');
  }
  if (!Number.isFinite(state.updatedAt) || now - state.updatedAt > MAX_HEARTBEAT_AGE_MS ||
      state.updatedAt > now + 5000) {
    throw new Error('Das Lebenszeichen des Schedulers ist veraltet.');
  }
  if (!['idle', 'running'].includes(state.schedulerStatus) ||
      !Number.isFinite(state.nextRunAt) || state.nextRunAt < now - 60000) {
    throw new Error('Der nächste Abruf ist nicht zuverlässig eingeplant.');
  }
  if (!Number.isFinite(state.maxRunMs) || state.maxRunMs < 60000 || state.maxRunMs > 3600000) {
    throw new Error('Die Zeitgrenze für einen Abruf ist ungültig.');
  }
  if (state.runningSince !== null && (!Number.isFinite(state.runningSince) ||
      state.runningSince > now + 5000 || now - state.runningSince > state.maxRunMs)) {
    throw new Error('Ein Abruf läuft länger als die freigegebene Zeit.');
  }
  return true;
}

function checkHealth(file = HEALTH_FILE) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > 8192) throw new Error('Ungültige Zustandsdatei.');
  return validateHealth(JSON.parse(fs.readFileSync(file, 'utf8')));
}

function checkDataDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const probe = path.join(directory, `.scheduler-write-${process.pid}`);
  fs.writeFileSync(probe, '', { flag: 'wx', mode: 0o600 });
  fs.unlinkSync(probe);
}

module.exports = { HEALTH_FILE, MAX_HEARTBEAT_AGE_MS, processStart, writeHealth,
  validateHealth, checkHealth, checkDataDirectory };
