'use strict';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSupportedNode(version = process.versions.node) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  const parts = match ? match.slice(1).map(Number) : [];
  assert(parts.length === 3 && parts.every(Number.isSafeInteger)
    && parts[0] === 24 && (parts[1] > 22 || (parts[1] === 22 && parts[2] >= 1)),
    `Node.js 24.22.1 or newer within Node 24 is required; found ${version}`);
}

function assertUnusedCodecsAbsent(packageStatus) {
  const unusedCodecs = new Set(['gstreamer1.0-plugins-bad', 'libgstreamer-plugins-bad1.0-0']);
  for (const line of packageStatus.split('\n')) {
    const [qualifiedName, status] = line.split('\t');
    const name = qualifiedName.split(':')[0];
    assert(!unusedCodecs.has(name) || status === 'not-installed' || status === 'config-files',
      `Unused WebKit codec package must be removed: ${qualifiedName} (${status})`);
  }
}

async function main() {
  // Check the actual runtime in each scanned image, independently of Trivy's DB.
  assertSupportedNode();
  const { execFileSync } = require('node:child_process');
  assertUnusedCodecsAbsent(execFileSync('dpkg-query', [
    '-W', '-f=${binary:Package}\t${db:Status-Status}\n'
  ], { encoding: 'utf8' }));

  const dotenv = require('dotenv');
  const nodemailer = require('nodemailer');

  console.log('=== Runtime versions ===');
  console.log('node=' + process.version);
  console.log('dotenv=' + require('dotenv/package.json').version);
  console.log('nodemailer=' + require('nodemailer/package.json').version);
  console.log('Node.js security minimum and unused codec removal: OK');

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

  console.log('\n=== Chromium compatibility ===');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { chromium } = require('playwright');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'schulmanager-chromium-smoke-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      viewport: { width: 1440, height: 1100 },
      args: ['--disable-dev-shm-usage'],
      timeout: 120000
    });
    const page = context.pages()[0] || (await context.newPage());
    await page.setContent('<title>Login smoke test</title><label>Name <input id="name"></label>');
    await page.locator('#name').fill('Schulmanager');
    assert(await page.title() === 'Login smoke test', 'Chromium did not load the local page');
    assert(await page.locator('#name').inputValue() === 'Schulmanager', 'Chromium form input failed');
    assert((await page.screenshot()).length > 0, 'Chromium did not render the local page');
    console.log('chromium launchPersistentContext/form/render API: OK');
  } finally {
    try {
      if (context) await context.close();
    } finally {
      fs.rmSync(profile, { recursive: true, force: true });
    }
  }
}

module.exports = { assertSupportedNode, assertUnusedCodecsAbsent };

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
