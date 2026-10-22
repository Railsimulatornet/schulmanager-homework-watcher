const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicJson } = require('./module-state');
const { sendMail } = require('./mail');

function queueMail(config, category, payload, seed) {
  if (!/^[a-z]+$/.test(category)) throw new Error('Ungültiger Mailbereich.');
  const id = crypto.createHash('sha256').update(`${category}:${seed}`).digest('hex');
  const dir = path.join(config.dataDir, 'outbox', category, id);
  const metadata = path.join(dir, 'mail.json');
  if (fs.existsSync(metadata)) return id;
  fs.mkdirSync(dir, { recursive:true, mode:0o770 });
  const attachments = (payload.attachments || []).map((attachment,index) => {
    const target = path.join(dir, `attachment-${index}`);
    fs.copyFileSync(attachment.path, target);
    fs.chmodSync(target, 0o660);
    return { filename:attachment.filename, file:`attachment-${index}` };
  });
  atomicJson(metadata, { createdAt:new Date().toISOString(), subject:payload.subject, text:payload.text,
    html:payload.html, messageId:`<${id}@schulmanager-watcher.local>`, attachments });
  return id;
}

async function flushOutbox(config, category, sender = sendMail) {
  if (!config.mail.enabled || !config.mail.categories[category]) return 0;
  const root = path.join(config.dataDir, 'outbox', category);
  if (!fs.existsSync(root)) return 0;
  const pending = fs.readdirSync(root, { withFileTypes:true }).filter(entry => entry.isDirectory() && /^[a-f0-9]{64}$/.test(entry.name))
    .map(entry => ({ dir:path.join(root,entry.name), file:path.join(root,entry.name,'mail.json') }))
    .filter(entry => fs.existsSync(entry.file))
    .map(entry => ({ ...entry, mail:JSON.parse(fs.readFileSync(entry.file,'utf8')) }))
    .sort((a,b) => a.mail.createdAt.localeCompare(b.mail.createdAt));
  if (!pending.length) return 0;
  const next = pending[0];
  const payload = { ...next.mail, attachments:next.mail.attachments.map(item => {
    if (!/^attachment-\d+$/.test(item.file)) throw new Error('Ungültiger Anhang im Postausgang.');
    return { filename:item.filename, path:path.join(next.dir,item.file) };
  }) };
  const result = await sender(config,payload);
  if (!result.sent) throw new Error('Mailversand ist nicht vollständig konfiguriert.');
  fs.rmSync(next.dir, { recursive:true });
  return 1;
}

module.exports = { queueMail, flushOutbox };
