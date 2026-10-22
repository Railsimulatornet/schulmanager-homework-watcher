const { DateTime } = require('luxon');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
}

function formatTimestamp(value, timezone) {
  const date = DateTime.fromISO(String(value || ''), { zone: timezone });
  return date.isValid ? date.toFormat('dd.MM.yyyy HH:mm') : 'unbekannt';
}

function eventText(event, timezone) {
  const item = event.currentValue || event.previousValue;
  const lines = [`${event.type}: ${item.title}`, `Erstmals erkannt: ${formatTimestamp(event.firstSeenAt, timezone)}`, `Änderung erkannt: ${formatTimestamp(event.changedAt, timezone)}`];
  if (event.previousValue) lines.push(`Vorher: ${JSON.stringify(event.previousValue.details)}`);
  if (event.currentValue) lines.push(`Nachher: ${JSON.stringify(event.currentValue.details)}`);
  return lines.join('\n');
}

function renderModuleMail(config, module, result) {
  const time = DateTime.fromISO(result.snapshot.capturedAt, { zone: config.timezone }).toFormat('dd.MM.yyyy HH:mm');
  const text = [`Schulmanager: ${module.title}`, `Abgerufen: ${time}`, `Änderungen: ${result.events.length}`, '', ...result.events.map(event => eventText(event, config.timezone))].join('\n\n');
  const cards = result.events.map(event => {
    const item = event.currentValue || event.previousValue;
    const before = event.previousValue ? Object.entries(event.previousValue.details).map(([k,v]) => `<div style="margin:3px 0;word-wrap:break-word;"><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</div>`).join('') : '<div>Nicht vorhanden</div>';
    const after = event.currentValue ? Object.entries(event.currentValue.details).map(([k,v]) => `<div style="margin:3px 0;word-wrap:break-word;"><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</div>`).join('') : '<div>Nicht vorhanden</div>';
    return `<div style="margin:0 0 14px;padding:16px;border:1px solid #d7e1ea;background:#ffffff;">
      <div style="font-size:12px;font-weight:bold;color:#23527c;">${escapeHtml(event.type)}</div>
      <div style="font-size:19px;line-height:1.35;font-weight:bold;margin:6px 0 12px;">${escapeHtml(item.title)}</div>
      <div style="font-size:13px;color:#546273;margin-bottom:10px;">Erstmals erkannt: ${escapeHtml(formatTimestamp(event.firstSeenAt, config.timezone))}<br>Änderung erkannt: ${escapeHtml(formatTimestamp(event.changedAt, config.timezone))}</div>
      ${event.previousValue ? `<div style="font-size:13px;line-height:1.5;margin-bottom:10px;"><b>Vorher</b>${before}</div>` : ''}
      ${event.currentValue ? `<div style="font-size:13px;line-height:1.5;"><b>Nachher</b>${after}</div>` : ''}
    </div>`;
  }).join('');
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(module.title)}</title></head>
  <body style="margin:0;padding:0;background:#edf2f6;color:#17212b;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#edf2f6;"><tr><td align="center" style="padding:14px 8px;">
  <!--[if mso]><table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;background:#edf2f6;"><tr><td style="padding:18px;background:#23527c;color:#ffffff;">
  <div style="font-size:12px;font-weight:bold;letter-spacing:.04em;">SCHULMANAGER</div><div style="font-size:25px;line-height:1.2;font-weight:bold;margin-top:6px;">${escapeHtml(module.title)}</div>
  <div style="font-size:14px;margin-top:8px;">${result.events.length} Änderung${result.events.length === 1 ? '' : 'en'} · ${escapeHtml(time)}</div></td></tr>
  <tr><td style="padding:16px 0;">${cards}</td></tr><tr><td style="padding:8px 4px 16px;color:#566573;font-size:12px;line-height:1.5;">Der Zeitpunkt bezeichnet die Erkennung durch diesen Watcher. Der Nachweis liegt im Anhang.</td></tr></table>
  <!--[if mso]></td></tr></table><![endif]-->
  </td></tr></table></body></html>`;
  return { text, html };
}

module.exports = { renderModuleMail, escapeHtml };
