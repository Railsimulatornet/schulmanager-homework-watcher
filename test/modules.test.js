const test = require('node:test');
const assert = require('node:assert/strict');
const entries = require('../src/modules/entries');
const absences = require('../src/modules/absences');
const history = require('../src/modules/history');
const exams = require('../src/modules/exams');
const timetable = require('../src/modules/timetable');

const session = { studentId: 7 };
const context = responses => ({
  getTerm: async () => ({ id: 1, start: '2026-08-01', end: '2027-07-31' }),
  getClassHours: async () => [{ id: 42, number: '7' }],
  range: () => ({ start: '2026-09-20', end: '2026-10-10' }),
  call: async (module, endpoint) => {
    if (!(endpoint in responses)) throw new Error(`Unerwarteter Abruf ${endpoint}`);
    return responses[endpoint];
  }
});

test('Eintrag behält bei Textänderung dieselbe Kennung', async () => {
  const raw = text => [{ id: 5, name: 'Hausaufgabe vergessen', entries: [{ date:'2026-09-30', text, taughtLesson:{subjectId:9,subject:{name:'Mathematik'}}, teacher:{abbreviation:'AB'} }] }];
  const a = await entries.collect({}, session, context({ 'get-entry-statistics':raw('A') }));
  const b = await entries.collect({}, session, context({ 'get-entry-statistics':raw('B') }));
  assert.equal(a.items[0].id, b.items[0].id);
  assert.equal(b.items[0].details.Text, 'B');
});

test('Fehlzeitenstatus und Historienstunde werden normalisiert', async () => {
  const a = await absences.collect({}, session, context({ 'get-history-absences-list':[{ id:3,date:'2026-09-30',excused:null },{ id:4,date:'2026-09-30',excused:null,exemptionRequest:{id:8,isInternal:false} }] }));
  assert.equal(a.items[0].details.Status, 'Unentschuldigt');
  assert.equal(a.items[1].details.Status, 'Genehmigt');
  const b = await history.collect({}, session, context({ 'get-history-by-time':{ '2026-09-30':{ '42':{ absentMinutes:60, fullyAbsent:true, comments:[] } } } }));
  assert.equal(b.items[0].details.Stunde, '7');
});

test('Klassenarbeit nutzt die serverseitige ID', async () => {
  const result = await exams.collect({}, session, context({ 'get-exams':[{ id:101,date:'2026-10-01',subject:{name:'Deutsch'},type:{name:'Klassenarbeit'},startClassHour:{number:'3'},endClassHour:{number:'4'} }] }));
  assert.equal(result.items[0].id, '101');
  assert.equal(result.items[0].details.Fach, 'Deutsch');
});

test('Stundenplanwechsel im selben Zeitfenster behält die Kennung', async () => {
  const row = room => ({ date:'2026-09-30',classHour:{id:42,number:'7'},type:'changedLesson',actualLesson:{room:{name:room},subject:{name:'Mathematik'},teachers:[]},originalLessons:[{lessonId:13,subject:{name:'Mathematik'}}] });
  const a = await timetable.collect({}, session, context({ 'get-actual-lessons':[row('A101')] }));
  const b = await timetable.collect({}, session, context({ 'get-actual-lessons':[row('B202')] }));
  assert.equal(a.items[0].id, b.items[0].id);
  assert.equal(b.items[0].details.Raum, 'B202');
});
