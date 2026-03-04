const path = require('path');
const { DateTime } = require('luxon');
const { config } = require('./lib/config');
const { ensureDirs, writeText } = require('./lib/files');
const { sendMail, persistMailPreview, isMailConfigured } = require('./lib/mail');
const { buildTestMailHtml } = require('./lib/mail-html');
const { currentWeekRange, formatHuman, formatDateGerman, formatDateGermanWithWeekday } = require('./lib/time');

async function main() {
  ensureDirs([
    config.dataDir,
    config.mailDir,
    config.logsDir,
    config.reportsDir,
    config.snapshotsDir,
    config.stateDir,
    config.profileDir
  ]);

  const now = DateTime.now().setZone(config.timezone);
  const todayIso = now.toISODate();
  const todayGerman = formatDateGerman(now.toISODate(), config.timezone);
  const human = formatHuman(now);
  const week = currentWeekRange(config.timezone);

  const pseudoItems = [
    {
      date: todayIso,
      subject: 'Deutsch',
      homework: 'TESTMAIL: Pseudohausaufgabe von heute. Bitte ignorieren. Arbeitsblatt lesen und 3 Sätze schreiben.'
    },
    {
      date: todayIso,
      subject: 'Mathematik',
      homework: 'TESTMAIL: Pseudohausaufgabe von heute. Bitte ignorieren. AH S. 40 Nr. 2.'
    }
  ];

  const attachmentPath = path.join(config.mailDir, 'testmail-pseudohausaufgaben.txt');
  const attachmentText = [
    'Schulmanager Watcher Testmail',
    '',
    `Erstellt: ${human} (${config.timezone})`,
    'Hinweis: Diese Datei ist nur ein Test und verändert keine echten Snapshots oder First-Seen-Daten.',
    '',
    'Pseudohausaufgaben:',
    ...pseudoItems.flatMap((item) => [
      `- ${formatDateGermanWithWeekday(item.date, config.timezone)} | ${item.subject}`,
      item.homework,
      `Erstmals erkannt: ${human}`,
      ''
    ])
  ].join('\n');
  writeText(attachmentPath, attachmentText);

  const text = [
    'Schulmanager Hausaufgaben-Änderung',
    '',
    'Dies ist eine manuell ausgelöste TESTMAIL.',
    `Abgerufen: ${human}`,
    `Woche: ${week.start.toFormat('dd.MM.yyyy')} bis ${week.end.toFormat('dd.MM.yyyy')}`,
    'Änderungen: neu 2, entfernt 0',
    'Nachweis: mail/testmail-pseudohausaufgaben.txt',
    '',
    'Hausaufgaben im Überwachungsfenster:',
    ...pseudoItems.flatMap((item) => [
      `- ${formatDateGermanWithWeekday(item.date, config.timezone)} | ${item.subject}`,
      item.homework,
      `Erstmals erkannt: ${human}`,
      ''
    ]),
    'Hinweis: Diese Testmail verändert absichtlich keine echten Watcher-Daten.'
  ].join('\n');

  const html = buildTestMailHtml({
    config,
    pseudoItems,
    now,
    attachmentRelativePath: 'mail/testmail-pseudohausaufgaben.txt'
  });

  const previewPath = persistMailPreview(config, 'latest-test-mail.txt', text);
  persistMailPreview(config, 'latest-test-mail.html', html);

  if (!isMailConfigured(config)) {
    console.log(`[test-mail] Mail ist nicht vollständig konfiguriert. Vorschau gespeichert: ${previewPath}`);
    process.exitCode = 1;
    return;
  }

  const result = await sendMail(config, {
    subject: `[Schulmanager] TESTMAIL ${todayGerman}`,
    text,
    html,
    attachments: [
      {
        filename: path.basename(attachmentPath),
        path: attachmentPath
      }
    ]
  });

  console.log(`[test-mail] Testmail versendet (${result.messageId}). Vorschau: ${previewPath}`);
}

main().catch((error) => {
  console.error('[test-mail] Fehler:', error.message || error);
  process.exitCode = 1;
});
