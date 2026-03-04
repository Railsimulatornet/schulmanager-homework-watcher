const { chromium } = require('playwright');
const { config } = require('./lib/config');
const { ensureDirs } = require('./lib/files');
const { attemptAutoLogin } = require('./lib/login');

async function main() {
  ensureDirs([config.dataDir, config.profileDir]);

  const context = await chromium.launchPersistentContext(config.profileDir, {
    headless: config.headless,
    locale: 'de-DE',
    timezoneId: config.timezone,
    viewport: { width: 1440, height: 1100 },
    args: ['--disable-dev-shm-usage']
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await attemptAutoLogin(page, config);
    await page.goto(config.homeworkUrl, { waitUntil: 'domcontentloaded', timeout: config.playwrightTimeoutMs });
    await page.waitForTimeout(2500);
    console.log('[login] Login abgeschlossen. Profil wurde in data/profile gespeichert.');
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error('[login] Fehler:', error.message);
  process.exitCode = 1;
});
