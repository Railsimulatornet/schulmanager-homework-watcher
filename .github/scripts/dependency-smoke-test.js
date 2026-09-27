'use strict';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const dotenv = require('dotenv');
  const nodemailer = require('nodemailer');

  console.log('=== Runtime versions ===');
  console.log('node=' + process.version);
  console.log('dotenv=' + require('dotenv/package.json').version);
  console.log('nodemailer=' + require('nodemailer/package.json').version);

  console.log('\n=== dotenv compatibility ===');
  const parsed = dotenv.parse(Buffer.from('A=1\nB=two\n'));
  assert(parsed.A === '1', 'dotenv.parse failed for A');
  assert(parsed.B === 'two', 'dotenv.parse failed for B');

  process.env.MAIL_ENABLED = 'false';
  const { config } = require('/app/src/lib/config');
  assert(config && config.mail, 'application config did not load');
  assert(config.mail.enabled === false, 'MAIL_ENABLED=false was not parsed correctly');
  console.log('dotenv config/parse API: OK');

  console.log('\n=== Nodemailer compatibility ===');
  assert(typeof nodemailer.createTransport === 'function', 'nodemailer.createTransport is missing');

  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: 'unix'
  });

  const info = await transport.sendMail({
    subject: 'Dependency smoke test',
    text: 'OK'
  });

  const message = Buffer.isBuffer(info.message)
    ? info.message.toString('utf8')
    : String(info.message);

  assert(message.includes('Subject: Dependency smoke test'), 'generated message is missing the expected subject');
  assert(message.includes('OK'), 'generated message is missing the expected body');

  console.log('nodemailer createTransport/sendMail API: OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
