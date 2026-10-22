const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { config } = require('../src/lib/config');
const collector = require('../src/lib/collector');

let loginCount = 0;
let failLogin = false;
collector.createSession = async () => {
  loginCount++;
  if (failLogin) throw new Error('Login abgelaufen');
  return { studentId:1 };
};
collector.collectHomeworkWithSession = async () => ({items:[],source:{method:'test'}});
collector.callEndpoint = async (_,session,module,endpoint) => {
  if (endpoint === 'get-current-term') return {id:1,start:'2026-08-01',end:'2027-07-31'};
  if (endpoint === 'get-entry-statistics') throw new Error('Unerwartete Wartungsantwort');
  if (endpoint === 'get-history-by-time') return {};
  return [];
};
const { runWatcher } = require('../src/run-once');

test('Ein Login pro Lauf, Modulfehler isoliert und Loginfehler mit Abrufpause', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'schulmanager-run-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  config.dataDir = root;
  for (const [key,dir] of Object.entries({profileDir:'profile',snapshotsDir:'snapshots',reportsDir:'reports',stateDir:'state',mailDir:'mail',logsDir:'logs'})) config[key] = path.join(root,dir);
  config.mail.enabled = false;
  const first = await runWatcher();
  assert.equal(loginCount,1);
  assert.deepEqual(first.errors,['Einträge']);
  assert.ok(fs.existsSync(path.join(root,'modules','exams','state.json')));
  assert.ok(fs.existsSync(path.join(root,'modules','timetable','state.json')));
  assert.ok(!fs.existsSync(path.join(root,'modules','entries','state.json')));
  failLogin = true;
  const failed = await runWatcher();
  assert.deepEqual(failed.errors,['Anmeldung']);
  const attempts = loginCount;
  const paused = await runWatcher();
  assert.equal(paused.skipped,true);
  assert.equal(loginCount,attempts);
});
