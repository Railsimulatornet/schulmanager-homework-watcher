const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DateTime } = require('luxon');
const { prepareArtifacts } = require('../src/lib/reporting');
const { itemId, escapeCsv } = require('../src/lib/homework');
const { csvCell } = require('../src/lib/module-state');

test('Bestehende Hausaufgaben behalten Erstbeobachtung, Berichte und Änderungsnachweis', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'schulmanager-homework-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  const config = { dataDir:root,timezone:'Europe/Berlin',lookbackDays:10,lookaheadDays:7,retentionDays:31,onlyCurrentWeek:false };
  for (const [key,name] of Object.entries({stateDir:'state',snapshotsDir:'snapshots',reportsDir:'reports',mailDir:'mail',logsDir:'logs'})) config[key]=path.join(root,name);
  const date = DateTime.now().setZone(config.timezone).toISODate();
  const a = {date,subject:'Mathematik',homework:'Aufgabe 1'};
  const b = {date,subject:'Deutsch',homework:'Seite 2'};
  const firstTime = DateTime.now().minus({minutes:5}).toISO();
  prepareArtifacts(config,{capturedAt:firstTime,source:{method:'test'},rawItemsCount:1},[a]);
  const second = prepareArtifacts(config,{capturedAt:DateTime.now().toISO(),source:{method:'test'},rawItemsCount:2},[a,b]);
  assert.equal(second.summaryRows.find(row => row.id === itemId(a)).firstSeenAt,firstTime);
  assert.equal(second.diff.added.length,1);
  const third = prepareArtifacts(config,{capturedAt:DateTime.now().plus({seconds:1}).toISO(),source:{method:'test'},rawItemsCount:1},[a]);
  assert.equal(third.diff.removed.length,1);
  for (const file of [third.files.evidencePath,third.files.summaryCsvPath,third.files.summaryJsonPath,third.files.snapshotPath]) assert.ok(fs.existsSync(file));
});

test('CSV-Inhalte können keine Tabellenformeln einschleusen', () => {
  assert.ok(escapeCsv('=SUM(1,2)').includes("'=SUM"));
  assert.ok(csvCell('@FORMEL').includes("'@FORMEL"));
});
