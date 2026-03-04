async function findFirstVisible(page, selectors, timeout = 1500) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout })) {
        return locator;
      }
    } catch (_) {
      // ignore and continue
    }
  }
  return null;
}

async function attemptAutoLogin(page, config) {
  if (!config.username || !config.password) {
    throw new Error('Keine Zugangsdaten konfiguriert. Bitte SCHULMANAGER_USERNAME und SCHULMANAGER_PASSWORD setzen.');
  }

  await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: config.playwrightTimeoutMs });
  await page.waitForTimeout(1200);

  const usernameField = await findFirstVisible(page, [
    'input[name="email"]',
    'input[name="username"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
    'input[type="text"]'
  ]);

  const passwordField = await findFirstVisible(page, [
    'input[name="password"]',
    'input[type="password"]',
    'input[autocomplete="current-password"]'
  ]);

  if (!usernameField || !passwordField) {
    throw new Error('Login-Formular wurde nicht gefunden. Bitte Selektoren in src/lib/login.js prüfen.');
  }

  await usernameField.fill(config.username);
  await passwordField.fill(config.password);

  const submitButton = await findFirstVisible(page, [
    'button[type="submit"]',
    'button:has-text("Anmelden")',
    'button:has-text("Login")',
    'input[type="submit"]'
  ]);

  if (!submitButton) {
    throw new Error('Absende-Button wurde nicht gefunden.');
  }

  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: config.playwrightTimeoutMs }).catch(() => null),
    submitButton.click()
  ]);

  await page.waitForTimeout(1500);
}

module.exports = { attemptAutoLogin };
