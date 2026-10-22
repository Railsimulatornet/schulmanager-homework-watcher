const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { renderModuleMail } = require('../src/lib/module-mail');
const { acquireRunLock } = require('../src/lib/run-lock');
const { failed, canAttempt, recovered } = require('../src/lib/error-state');

test('Schulmanager-Inhalte werden in HTML-Mails als Text escaped', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const message = renderModuleMail({ timezone:'Europe/Berlin' }, { title:'Einträge' }, {
    snapshot:{ capturedAt:'2026-09-30T10:00:00+02:00' },
    events:[{ type:'Neu', firstSeenAt:'2026-09-30T10:00:00+02:00', changedAt:'2026-09-30T10:00:00+02:00', currentValue:{ title:evil, details:{ Text:evil } } }]
  });
  assert.ok(message.html.includes('&lt;img'));
  assert.ok(!message.html.includes(evil));
  assert.ok(message.text.includes(evil));
});

test('Laufübergreifende Sperre verhindert parallele Ausführung', t => {
  if (process.platform !== 'linux') return t.skip('Die Produktionssperre verwendet /proc und wird im Linux-CI geprüft.');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schulmanager-lock-'));
  t.after(() => fs.rmSync(dir, { recursive:true, force:true }));
  const config = { stateDir:dir };
  const release = acquireRunLock(config);
  assert.equal(typeof release, 'function');
  assert.equal(acquireRunLock(config), null);
  release();
  const next = acquireRunLock(config);
  assert.equal(typeof next, 'function');
  next();
});

test('Wiederholter identischer Fehler erzeugt keine zweite Mail; Statuswechsel schon', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schulmanager-error-'));
  t.after(() => fs.rmSync(dir, { recursive:true, force:true }));
  const config = { stateDir:dir, mailDir:dir, timezone:'Europe/Berlin', errorCooldownMinutes:360,
    mail:{ enabled:true, onError:true } };
  let sent = 0;
  const sender = async () => { sent++; return { sent:true }; };
  await failed(config, 'entries', 'Einträge', Object.assign(new Error('429'), { httpStatus:429 }), sender);
  assert.equal(canAttempt(config, 'entries'), false);
  await failed(config, 'entries', 'Einträge', Object.assign(new Error('429'), { httpStatus:429 }), sender);
  assert.equal(sent, 1);
  await failed(config, 'entries', 'Einträge', Object.assign(new Error('500'), { httpStatus:500 }), sender);
  assert.equal(sent, 2);
  recovered(config, 'entries');
  assert.equal(canAttempt(config, 'entries'), true);
});
