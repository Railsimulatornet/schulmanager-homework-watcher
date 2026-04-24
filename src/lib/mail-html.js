const { DateTime } = require('luxon');
const {
  formatHumanWithWeekday,
  formatDateGermanWithWeekday,
  formatDateRangeGerman,
  currentWeekRange,
  toDateTime
} = require('./time');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function paragraphize(text) {
  return escapeHtml(String(text ?? ''))
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br>');
}

function itemKey(item) {
  return [item.date || '', item.subject || '', item.homework || ''].join('|||');
}

function countBadge(label, value, tone = 'default') {
  const tones = {
    default: { bg: '#e9eef5', color: '#334155' },
    added: { bg: '#e8f7ee', color: '#166534' },
    removed: { bg: '#fdecec', color: '#991b1b' },
    info: { bg: '#eaf3ff', color: '#1d4ed8' }
  };
  const style = tones[tone] || tones.default;
  return `
    <span style="display:inline-block;margin:0 8px 8px 0;padding:8px 12px;border-radius:999px;background:${style.bg};color:${style.color};font-size:13px;font-weight:600;">
      ${escapeHtml(label)}: ${escapeHtml(value)}
    </span>`;
}

function infoRow(label, value) {
  return `
    <tr>
      <td style="padding:8px 0;color:#475569;font-size:14px;width:190px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
    </tr>`;
}

function itemStatusBadge(text, tone = 'added') {
  const map = {
    added: { bg: '#e8f7ee', color: '#166534' },
    removed: { bg: '#fdecec', color: '#991b1b' },
    neutral: { bg: '#eef3f7', color: '#334155' }
  };
  const style = map[tone] || map.neutral;
  return `<span style="display:inline-block;margin:0 0 10px 0;padding:6px 10px;border-radius:999px;background:${style.bg};color:${style.color};font-size:12px;font-weight:700;">${escapeHtml(text)}</span>`;
}

function sortRowsDescending(rows, timezone) {
  return [...rows].sort((a, b) => {
    const ad = toDateTime(a.date, timezone);
    const bd = toDateTime(b.date, timezone);
    const adMs = ad ? ad.toMillis() : -Infinity;
    const bdMs = bd ? bd.toMillis() : -Infinity;
    if (bdMs !== adMs) return bdMs - adMs;

    const s = String(a.subject || '').localeCompare(String(b.subject || ''), 'de');
    if (s !== 0) return s;

    return String(a.homework || '').localeCompare(String(b.homework || ''), 'de');
  });
}

function groupRowsByDate(rows, timezone) {
  const groups = new Map();
  for (const row of sortRowsDescending(rows, timezone)) {
    const key = row.date || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    dateHumanWithWeekday: formatDateGermanWithWeekday(date, timezone),
    items
  }));
}

function renderHomeworkGroups(rows, timezone, { addedKeys = new Set(), removed = false } = {}) {
  if (!rows.length) {
    return `<div style="font-size:14px;line-height:1.7;color:#475569;">Es liegen derzeit keine Hausaufgaben in diesem Bereich vor.</div>`;
  }

  return groupRowsByDate(rows, timezone)
    .map((group) => `
      <div style="margin:0 0 16px 0;border:1px solid ${removed ? '#f3d4d4' : '#d6e4f0'};border-radius:12px;overflow:hidden;background:#ffffff;">
        <div style="background:${removed ? '#c24141' : '#3f88c5'};color:#ffffff;padding:10px 14px;font-size:14px;font-weight:700;">
          ${escapeHtml(group.dateHumanWithWeekday)}
        </div>
        <div style="padding:0 14px;">
          ${group.items
            .map((row, index) => `
              <div style="padding:14px 0;${index < group.items.length - 1 ? 'border-bottom:1px solid #e5e7eb;' : ''}">
                ${addedKeys.has(itemKey(row)) ? itemStatusBadge('Neu seit dem letzten Abruf', 'added') : ''}
                <div style="font-size:18px;line-height:1.3;font-weight:700;color:#0f172a;margin:0 0 8px 0;">${escapeHtml(row.subject)}</div>
                <div style="font-size:14px;line-height:1.7;color:#1f2937;">${paragraphize(row.homework)}</div>
                ${row.firstSeenAtHumanWithWeekday ? `<div style="margin-top:10px;font-size:13px;line-height:1.5;color:#475569;"><strong>Erstmals erkannt:</strong> ${escapeHtml(row.firstSeenAtHumanWithWeekday)}</div>` : ''}
                ${removed && row.lastSeenAtHumanWithWeekday ? `<div style="margin-top:6px;font-size:13px;line-height:1.5;color:#7f1d1d;"><strong>Zuletzt vorhanden:</strong> ${escapeHtml(row.lastSeenAtHumanWithWeekday)}</div>` : ''}
              </div>
            `)
            .join('')}
        </div>
      </div>
    `)
    .join('');
}

function section(title, content, subtitle = '') {
  return `
    <div style="margin:0 0 20px 0;border:1px solid #dde6ef;border-radius:14px;background:#ffffff;overflow:hidden;">
      <div style="background:#3f88c5;color:#ffffff;padding:12px 16px;">
        <div style="font-size:16px;font-weight:700;line-height:1.3;">${escapeHtml(title)}</div>
        ${subtitle ? `<div style="font-size:12px;opacity:0.92;margin-top:4px;">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      <div style="padding:16px;">${content}</div>
    </div>`;
}

function baseHtml({ preheader, title, intro, body }) {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef3f7;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader || title)}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef3f7;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:760px;background:#eef3f7;">
            <tr>
              <td style="padding:0 0 16px 0;">
                <div style="border-radius:18px;overflow:hidden;background:#3f88c5;box-shadow:0 10px 24px rgba(15,23,42,0.12);">
                  <div style="padding:22px 24px 18px 24px;color:#ffffff;">
                    <div style="font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.95;">Schulmanager</div>
                    <div style="font-size:30px;line-height:1.2;font-weight:800;margin-top:8px;">${escapeHtml(title)}</div>
                    ${intro ? `<div style="font-size:15px;line-height:1.6;margin-top:10px;opacity:.98;">${intro}</div>` : ''}
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td>${body}</td>
            </tr>
            <tr>
              <td style="padding:8px 6px 0 6px;color:#64748b;font-size:12px;line-height:1.6;">
                Diese E-Mail wurde automatisch vom Schulmanager-Homework-Watcher erzeugt.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildWatcherMailHtml({ config, snapshot, diff, summaryRows, evidenceRelativePath }) {
  const capturedAt = DateTime.fromISO(snapshot.capturedAt, { zone: config.timezone });
  const rangeHuman = formatDateRangeGerman(snapshot.range.start, snapshot.range.end, config.timezone);
  const addedKeys = new Set((diff.added || []).map(itemKey));

  const summaryTable = `
    <div style="margin:0 0 12px 0;">
      ${countBadge('Neu', diff.added.length, 'added')}
      ${countBadge('Entfernt', diff.removed.length, diff.removed.length > 0 ? 'removed' : 'default')}
      ${countBadge('Fenster', `${snapshot.range.lookbackDays} Tage zurück / ${snapshot.range.lookaheadDays} Tage voraus`, 'info')}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${infoRow('Abgerufen', formatHumanWithWeekday(capturedAt))}
      ${infoRow('Überwachungszeitraum', rangeHuman)}
      ${infoRow('Nachweis', evidenceRelativePath)}
    </table>`;

  const removedRows = sortRowsDescending(
    (diff.removed || []).map((item) => ({
      ...item,
      firstSeenAtHumanWithWeekday: '',
      lastSeenAtHumanWithWeekday: formatHumanWithWeekday(capturedAt)
    })),
    config.timezone
  );

  const body = [
    section('Überblick', summaryTable),
    section('Hausaufgaben im Überwachungsfenster', renderHomeworkGroups(summaryRows, config.timezone, { addedKeys })),
    diff.removed.length > 0
      ? section('Seit dem letzten Abruf nicht mehr vorhanden', renderHomeworkGroups(removedRows, config.timezone, { removed: true }))
      : ''
  ].join('');

  return baseHtml({
    preheader: `Schulmanager Hausaufgaben geändert – ${rangeHuman}`,
    title: 'Hausaufgaben-Änderung',
    intro: `Überwachungszeitraum: ${escapeHtml(rangeHuman)}`,
    body
  });
}

function buildTestMailHtml({ config, pseudoItems, now, attachmentRelativePath }) {
  const week = currentWeekRange(config.timezone);
  const pseudoRows = pseudoItems.map((item) => ({
    ...item,
    firstSeenAtHumanWithWeekday: formatHumanWithWeekday(now)
  }));

  const body = [
    section(
      'Testlauf',
      `<div style="font-size:14px;line-height:1.7;color:#334155;">Dies ist eine manuell ausgelöste Testmail. Sie verändert bewusst keine echten Watcher-Daten.</div>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
         ${infoRow('Abgerufen', formatHumanWithWeekday(now))}
         ${infoRow('Woche', formatDateRangeGerman(week.start.toISODate(), week.end.toISODate(), config.timezone))}
         ${infoRow('Nachweis', attachmentRelativePath)}
       </table>`
    ),
    section('Pseudohausaufgaben', renderHomeworkGroups(pseudoRows, config.timezone, { addedKeys: new Set(pseudoRows.map(itemKey)) }))
  ].join('');

  return baseHtml({
    preheader: `Schulmanager Testmail vom ${formatHumanWithWeekday(now)}`,
    title: 'TESTMAIL',
    intro: 'Manuell ausgelöster Versand zum Prüfen von SMTP, Darstellung und Anhängen.',
    body
  });
}

function buildErrorMailHtml({ config, now, message, stack }) {
  const body = section(
    'Fehlerdetails',
    `<div style="font-size:14px;line-height:1.7;color:#334155;margin-bottom:12px;">Beim letzten Abruf ist ein Fehler aufgetreten.</div>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
       ${infoRow('Zeit', formatHumanWithWeekday(now))}
       ${infoRow('Fehler', message)}
     </table>
     ${stack ? `<div style="margin-top:14px;padding:12px 14px;background:#0f172a;border-radius:10px;color:#e2e8f0;font-family:Consolas,Monaco,monospace;font-size:12px;white-space:pre-wrap;line-height:1.5;">${escapeHtml(stack)}</div>` : ''}`,
    'Bitte Logs und Vorschau prüfen.'
  );

  return baseHtml({
    preheader: 'Schulmanager-Homework-Watcher Fehler',
    title: 'Watcher-Fehler',
    intro: 'Der automatische Abruf konnte nicht erfolgreich abgeschlossen werden.',
    body
  });
}

module.exports = {
  buildWatcherMailHtml,
  buildTestMailHtml,
  buildErrorMailHtml
};
