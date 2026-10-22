const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { queueMail, flushOutbox } = require('../src/lib/outbox');

test('Fehlgeschlagene Mail bleibt mit unveränderten Anhängen für den nächsten Versuch erhalten', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(),'schulmanager-outbox-'));
  t.after(() => fs.rmSync(dataDir,{recursive:true,force:true}));
  const config = { dataDir, mail:{ enabled:true,categories:{entries:true} } };
  const attachment = path.join(dataDir,'evidence.txt');
  fs.writeFileSync(attachment,'Original');
  const payload = { subject:'Test',text:'Änderung',html:'<p>Änderung</p>',attachments:[{filename:'Nachweis.txt',path:attachment}] };
  const id = queueMail(config,'entries',payload,'v1-v2');
  assert.equal(queueMail(config,'entries',payload,'v1-v2'),id);
  fs.writeFileSync(attachment,'Später überschrieben');
  await assert.rejects(flushOutbox(config,'entries',async () => { throw new Error('SMTP nicht erreichbar'); }));
  let delivered = 0;
  await flushOutbox(config,'entries',async (_,mail) => {
    assert.equal(fs.readFileSync(mail.attachments[0].path,'utf8'),'Original');
    assert.ok(mail.messageId.includes(id));
    delivered++;
    return {sent:true};
  });
  assert.equal(await flushOutbox(config,'entries',async () => { delivered++; return {sent:true}; }),0);
  assert.equal(delivered,1);
});
