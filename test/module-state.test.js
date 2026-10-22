const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { processModule } = require('../src/lib/module-state');

function setup(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schulmanager-test-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  return { dataDir, retentionDays: 31 };
}

const moduleInfo = { key: 'probe', title: 'Probe' };
const item = (id, text, date = '2026-09-30') => ({ id, date, title: `Eintrag ${id}`, details: { Text: text } });
const capture = (items, range) => ({ items, scope: 'term:1', range });

test('Ausgangsstand und unveränderter Abruf lösen keine Änderung aus', t => {
  const config = setup(t);
  const first = processModule(config, moduleInfo, capture([item('1','A')]), '2026-09-30T10:00:00+02:00');
  const second = processModule(config, moduleInfo, capture([item('1','A')]), '2026-09-30T10:05:00+02:00');
  assert.equal(first.baseline, true);
  assert.deepEqual(first.events, []);
  assert.deepEqual(second.events, []);
});

test('Neu, geändert, entfernt und wieder vorhanden behalten die Erstbeobachtung', t => {
  const config = setup(t);
  processModule(config, moduleInfo, capture([item('1','A')]), '2026-09-30T10:00:00+02:00');
  let result = processModule(config, moduleInfo, capture([item('1','B'),item('2','Neu')]), '2026-09-30T10:05:00+02:00');
  assert.deepEqual(result.events.map(e => e.type).sort(), ['Geändert','Neu']);
  assert.equal(result.events.find(e => e.type === 'Geändert').previousValue.details.Text, 'A');
  result = processModule(config, moduleInfo, capture([item('2','Neu')]), '2026-09-30T10:10:00+02:00');
  assert.equal(result.events[0].type, 'Entfernt');
  result = processModule(config, moduleInfo, capture([item('1','B'),item('2','Neu')]), '2026-09-30T10:15:00+02:00');
  assert.equal(result.events[0].type, 'Wieder vorhanden');
  assert.equal(result.events[0].firstSeenAt, '2026-09-30T10:00:00+02:00');
});

test('Leere Antwort wird erst beim dritten erfolgreichen Abruf als Entfernung gewertet', t => {
  const config = setup(t);
  processModule(config, moduleInfo, capture([item('1','A')]), '2026-09-30T10:00:00+02:00');
  assert.equal(processModule(config, moduleInfo, capture([]), '2026-09-30T10:05:00+02:00').deferredEmpty, true);
  assert.equal(processModule(config, moduleInfo, capture([]), '2026-09-30T10:10:00+02:00').deferredEmpty, true);
  const result = processModule(config, moduleInfo, capture([]), '2026-09-30T10:15:00+02:00');
  assert.equal(result.events[0].type, 'Entfernt');
});

test('Fensterwechsel erzeugt keine Scheinlöschung; neuer Zeitraum startet still', t => {
  const config = setup(t);
  processModule(config, moduleInfo, capture([item('1','Alt','2026-09-20')], { start:'2026-09-20', end:'2026-09-30' }), '2026-09-30T10:00:00+02:00');
  const roll = processModule(config, moduleInfo, capture([], { start:'2026-09-21', end:'2026-10-01' }), '2026-09-30T10:05:00+02:00');
  assert.equal(roll.deferredEmpty, true);
  processModule(config, moduleInfo, capture([item('2','Neu')], { start:'2026-09-21', end:'2026-10-01' }), '2026-09-30T10:10:00+02:00');
  const scope = processModule(config, moduleInfo, { items:[item('3','Anderer Zeitraum')], scope:'term:2' }, '2026-09-30T10:15:00+02:00');
  assert.equal(scope.baseline, true);
  assert.deepEqual(scope.events, []);
});
