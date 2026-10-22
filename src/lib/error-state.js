const path = require('path');
const { DateTime } = require('luxon');
const { readJson } = require('./files');
const { atomicJson, atomicWrite } = require('./module-state');
const { escapeHtml } = require('./module-mail');
const { sendMail } = require('./mail');

function filePath(config) { return path.join(config.stateDir, 'error-state.json'); }

function safeCode(error) {
  const status = Number(error?.httpStatus || 0);
  if (status) return `HTTP_${status}`;
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError' || /Timeout/i.test(error?.message || '')) return 'TIMEOUT';
  if (/Login/i.test(error?.message || '')) return 'LOGIN';
  return 'ABRUF_FEHLER';
}

function backoffMinutes(code) {
  if (code === 'HTTP_429') return 30;
  if (code === 'TIMEOUT' || code === 'LOGIN' || code.startsWith('HTTP_5')) return 15;
  return 10;
}

function canAttempt(config, key) {
  const state = readJson(filePath(config), {});
  return !state[key]?.nextAttemptAt || Date.parse(state[key].nextAttemptAt) <= Date.now();
}

function recovered(config, key) {
  const state = readJson(filePath(config), {});
  if (state[key]) {
    delete state[key];
    atomicJson(filePath(config), state);
  }
}

function shouldNotify(current, code, now, cooldownMinutes) {
  const lastMailAt = current.lastMailAt ? DateTime.fromISO(current.lastMailAt) : null;
  return current.code !== code || !lastMailAt?.isValid || now.diff(lastMailAt, 'minutes').minutes >= cooldownMinutes;
}

async function failed(config, key, title, error, sender = sendMail) {
  const state = readJson(filePath(config), {});
  const now = DateTime.now().setZone(config.timezone);
  const code = safeCode(error);
  const current = state[key] || {};
  const nextAttemptAt = now.plus({ minutes: backoffMinutes(code) }).toISO();
  const notify = config.mail.enabled && config.mail.onError &&
    shouldNotify(current, code, now, config.errorCooldownMinutes);
  state[key] = { code, since: current.code === code ? current.since : now.toISO(), nextAttemptAt, lastMailAt: current.lastMailAt || null };
  atomicJson(filePath(config), state);
  console.error(`[watcher] ${title}: ${code}; nächster Versuch nach ${nextAttemptAt}.`);
  if (!notify) return;
  const text = `Schulmanager-Abrufproblem\n\nBereich: ${title}\nZeit: ${now.toFormat('dd.MM.yyyy HH:mm')}\nArt: ${code}\nNächster Versuch: ${nextAttemptAt}\n\nGleiche Fehler werden für ${config.errorCooldownMinutes} Minuten nicht erneut gemeldet.\n`;
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Arial,Helvetica,sans-serif;color:#17212b;padding:16px;"><div style="max-width:640px;margin:auto;"><h1 style="font-size:22px;">Schulmanager-Abrufproblem</h1><p><b>Bereich:</b> ${escapeHtml(title)}<br><b>Zeit:</b> ${escapeHtml(now.toFormat('dd.MM.yyyy HH:mm'))}<br><b>Art:</b> ${escapeHtml(code)}<br><b>Nächster Versuch:</b> ${escapeHtml(nextAttemptAt)}</p><p>Gleiche Fehler werden für ${config.errorCooldownMinutes} Minuten nicht erneut gemeldet.</p></div></body></html>`;
  atomicWrite(path.join(config.mailDir, `latest-error-${key}.txt`), text);
  atomicWrite(path.join(config.mailDir, `latest-error-${key}.html`), html);
  if (key === 'global' || key === 'homework') {
    atomicWrite(path.join(config.mailDir, 'latest-error-mail.txt'), text);
    atomicWrite(path.join(config.mailDir, 'latest-error-mail.html'), html);
  }
  try {
    const sent = await sender(config, { subject: `[Schulmanager] Abrufproblem: ${title}`, text, html });
    if (sent.sent) {
      state[key].lastMailAt = now.toISO();
      atomicJson(filePath(config), state);
    }
  } catch (_) {
    console.error('[watcher] Fehlermail konnte nicht versendet werden.');
  }
}

module.exports = { canAttempt, recovered, failed, safeCode, shouldNotify };
