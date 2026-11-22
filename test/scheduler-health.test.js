const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateHealth, writeHealth, checkHealth, processStart } = require('../src/lib/scheduler-health');
const { startScheduler } = require('../src/scheduler');

function healthy(now = Date.now()) {
  return { schema: 1, pid: process.pid, processStart: processStart(process.pid),
    updatedAt: now, schedulerStatus: 'idle', nextRunAt: now + 86400000,
    runningSince: null, maxRunMs: 1800000 };
}

test('nightly idle period is healthy when the next scheduled run is registered', () => {
  assert.equal(validateHealth(healthy()), true);
});

test('stale heartbeat, stopped schedule, overdue task and reused process are rejected', () => {
  const now = Date.now();
  for (const patch of [{ updatedAt: now - 90001 }, { updatedAt: now + 10000 },
    { schedulerStatus: 'stopped' }, { nextRunAt: null }, { nextRunAt: now - 60001 },
    { processStart: 'a different process' }, { maxRunMs: 0 },
    { runningSince: now - 1800001 }, { runningSince: now + 10000 }]) {
    assert.throws(() => validateHealth({ ...healthy(now), ...patch }, now));
  }
});

test('a current bounded asynchronous run is healthy', () => {
  const now = Date.now();
  assert.equal(validateHealth({ ...healthy(now), runningSince: now - 10000 }, now), true);
});

test('state file is read from disk and an absent or malformed state fails closed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-health-'));
  const file = path.join(dir, 'status.json');
  try {
    assert.throws(() => checkHealth(file));
    writeHealth(healthy(), file);
    assert.equal(checkHealth(file), true);
    fs.writeFileSync(file, '{}');
    assert.throws(() => checkHealth(file));
    fs.writeFileSync(file, '{');
    assert.throws(() => checkHealth(file));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('real node-cron registration creates valid state; stopping it fails the check', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-scheduler-'));
  const file = path.join(dir, 'status.json');
  let scheduler;
  try {
    scheduler = startScheduler({ settings: { stateDir: path.join(dir, 'data'),
      timezone: 'Europe/Berlin', cronSchedule: '0 0 1 1 *', runOnStart: false },
    healthFile: file, run: async () => { throw new Error('must not run'); },
    logger: { log() {}, error() {} } });
    assert.equal(checkHealth(file), true);
    scheduler.stop();
    assert.throws(() => checkHealth(file));
  } finally {
    if (scheduler) scheduler.task.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an in-flight run prevents overlapping callbacks and records its start', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-running-'));
  const file = path.join(dir, 'status.json');
  let callback, finish, runs = 0;
  const task = { getStatus: () => 'idle', getNextRun: () => new Date(Date.now() + 600000), stop() {} };
  const scheduler = startScheduler({ settings: { stateDir: dir, cronSchedule: '* * * * *',
    timezone: 'Europe/Berlin', runOnStart: false }, healthFile: file,
  cronEngine: { schedule(_expression, cb) { callback = cb; return task; } },
  run: () => { runs++; return new Promise(resolve => { finish = resolve; }); },
  logger: { log() {}, error() {} } });
  try {
    const first = callback();
    await callback();
    assert.equal(runs, 1);
    assert.equal(typeof JSON.parse(fs.readFileSync(file)).runningSince, 'number');
    finish();
    await first;
    assert.equal(JSON.parse(fs.readFileSync(file)).runningSince, null);
  } finally { scheduler.stop(); fs.rmSync(dir, { recursive: true, force: true }); }
});
