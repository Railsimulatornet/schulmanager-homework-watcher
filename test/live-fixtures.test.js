const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const modules = require('../src/modules');
const { normalizeItem } = require('../src/lib/homework');

const fixture = key => JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',`${key}.json`),'utf8'));
const endpoints = { 'get-entry-statistics':'entries','get-history-absences-list':'absences','get-history-by-time':'history','get-exams':'exams','get-actual-lessons':'timetable' };
const context = {
  getTerm:async () => ({id:1,start:'2030-01-01',end:'2030-12-31'}),
  range:() => ({start:'2030-01-01',end:'2030-12-31'}),
  getClassHours:async () => [],
  call:async (_,endpoint) => fixture(endpoints[endpoint])
};

test('Anonymisierte Antworten des eigenen Kontos werden in allen Bereichen verarbeitet', async () => {
  assert.ok(fixture('homework').map(normalizeItem).length > 0);
  for (const module of modules) {
    const capture = await module.collect({}, {studentId:1},context);
    assert.ok(capture.items.length > 0,module.key);
    assert.equal(new Set(capture.items.map(item => item.id)).size,capture.items.length,module.key);
  }
  assert.deepEqual([...new Set(fixture('timetable').map(item => item.type))].sort(),['cancelledLesson','changedLesson','event','regularLesson']);
});
