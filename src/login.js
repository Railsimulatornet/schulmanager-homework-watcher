const { chromium } = require('playwright');
const { config } = require('./lib/config');
const { installTimestampedConsole } = require('./lib/logging');
const { ensureDirs } = require('./lib/files');
const { attemptAutoLogin } = require('./lib/login');

installTimestampedConsole(config.timezone);

async function main() {
  ensureDirs([config.dataDir, config.profileDir, config.logsDir, config.stateDir]);
  require('fs').chmodSync(config.profileDir, 0o700);

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
    if (new URL(config.homeworkUrl).origin !== new URL(config.baseUrl).origin) throw new Error('Abweichende Herkunft der Hausaufgabenseite.');
    await page.goto(config.homeworkUrl, { waitUntil: 'domcontentloaded', timeout: config.playwrightTimeoutMs });
    await page.waitForTimeout(2500);
    console.log('[login] Login abgeschlossen. Profil wurde in data/profile gespeichert.');
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error('[login] Anmeldung fehlgeschlagen; Zugang und Erreichbarkeit prüfen.');
  process.exitCode = 1;
});
