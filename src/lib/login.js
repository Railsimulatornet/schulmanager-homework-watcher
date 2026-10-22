const { createSession } = require('./collector');

async function attemptAutoLogin(page, config) {
  const session = await createSession(config);
  const origin = new URL(config.baseUrl).origin;
  // Das Token bleibt im Browserprofil und wird niemals protokolliert.
  await page.context().addInitScript(({ token, origin }) => {
    if (location.origin === origin) localStorage.setItem('jwt', token);
  }, { token: session.token, origin });
  await page.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: config.playwrightTimeoutMs });
  const saved = await page.evaluate(() => Boolean(localStorage.getItem('jwt')));
  if (!saved) throw new Error('Die Anmeldung konnte nicht im Browserprofil gespeichert werden.');
}

module.exports = { attemptAutoLogin };
