const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const timetable = require('../src/modules/timetable');
const { processModule } = require('../src/lib/module-state');

const slot = '2026-10-05:16483';
const original = { lessonId: 24669463, subject: { name: 'Mathematik' }, teachers: [] };
function lesson(substitutionId, teacher) {
  return {
    date: '2026-10-05', classHour: { id: 16483, number: '3' }, type: 'changedLesson',
    originalLessons: [original], actualLesson: {
      substitutionId, subject: { name: 'Mathematik' }, teachers: [{ abbreviation: teacher }],
      room: { name: 'A1' }
    }
  };
}
function regular() {
  return {
    date: '2026-10-05', classHour: { id: 16483, number: '3' }, type: 'regularLesson',
    originalLessons: [original], actualLesson: { lessonId: 24669463, subject: { name: 'Mathematik' }, teachers: [] }
  };
}
function setup(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schulmanager-timetable-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const config = { dataDir, retentionDays: 31 };
  const context = data => ({
    range: () => ({ start: '2026-10-01', end: '2026-10-10' }),
    call: async () => data,
    getModuleState: () => {
      const file = path.join(dataDir, 'modules', 'timetable', 'state.json');
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { items: {} };
    }
  });
  return { config, context };
}

test('two distinct substitutions of one original lesson retain unique IDs and the prior firstSeen', async t => {
  const { config, context } = setup(t);
  const first = await timetable.collect(config, { studentId: 7 }, context([regular()]));
  assert.equal(first.items[0].id, slot);
  processModule(config, timetable, first, '2026-10-02T07:05:00+02:00');

  const changed = await timetable.collect(config, { studentId: 7 }, context([lesson(48887714, 'AA'), lesson(48887712, 'BB')]));
  assert.equal(changed.items.length, 2);
  assert.equal(new Set(changed.items.map(item => item.id)).size, 2);
  assert.ok(changed.items.some(item => item.id === slot));
  let result = processModule(config, timetable, changed, '2026-10-03T17:05:00+02:00');
  assert.deepEqual(result.events.map(event => event.type).sort(), ['Geändert', 'Neu']);
  assert.equal(result.events.find(event => event.id === slot).firstSeenAt, '2026-10-02T07:05:00+02:00');

  const unchanged = await timetable.collect(config, { studentId: 7 }, context([lesson(48887712, 'BB'), lesson(48887714, 'AA')]));
  assert.deepEqual(unchanged.items.map(item => item.id).sort(), changed.items.map(item => item.id).sort());
  result = processModule(config, timetable, unchanged, '2026-10-03T17:10:00+02:00');
  assert.deepEqual(result.events, []);

  const remaining = changed.items.find(item => item.id !== slot);
  result = processModule(config, timetable,
    await timetable.collect(config, { studentId: 7 }, context([lesson(Number(remaining.id.split(':').at(-1)), remaining.details.Lehrkraft)])),
    '2026-10-03T17:15:00+02:00');
  assert.deepEqual(result.events.map(event => event.type), ['Entfernt']);
  assert.equal(result.events[0].id, slot);
});

test('identical duplicate is collapsed; conflicting rows with one source ID fail closed', async t => {
  const { config, context } = setup(t);
  const same = lesson(48887714, 'AA');
  const capture = await timetable.collect(config, { studentId: 7 }, context([same, structuredClone(same)]));
  assert.equal(capture.items.length, 1);
  await assert.rejects(
    timetable.collect(config, { studentId: 7 }, context([lesson(48887714, 'AA'), lesson(48887714, 'BB')])),
    /mehrdeutige Einträge mit gleicher Quellkennung/
  );
});

test('empty and unexpected API responses are handled without inventing removals', async t => {
  const { config, context } = setup(t);
  const baseline = await timetable.collect(config, { studentId: 7 }, context([regular()]));
  processModule(config, timetable, baseline, '2026-10-02T07:05:00+02:00');
  const empty = await timetable.collect(config, { studentId: 7 }, context([]));
  assert.equal(processModule(config, timetable, empty, '2026-10-02T07:10:00+02:00').deferredEmpty, true);
  await assert.rejects(timetable.collect(config, { studentId: 7 }, context({ rows: [] })), /unerwartete Antwortform/);
});
