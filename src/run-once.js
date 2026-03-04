const path = require('path');
const { DateTime } = require('luxon');
const { config } = require('./lib/config');
const { ensureDirs } = require('./lib/files');
const { collectHomework } = require('./lib/collector');
const { filterByRollingWindow, filterToCurrentWeek } = require('./lib/homework');
const { prepareArtifacts, buildMailText } = require('./lib/reporting');
const { sendMail, persistMailPreview } = require('./lib/mail');
const { buildWatcherMailHtml, buildErrorMailHtml } = require('./lib/mail-html');
const { formatDateRangeGerman } = require('./lib/time');

let running = false;

function safeAsciiGerman(value) {
  return String(value)
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildAttachmentNames(config, snapshot) {
  const rangeHuman = formatDateRangeGerman(snapshot.range.start, snapshot.range.end, config.timezone);
  const capturedAt = DateTime.fromISO(snapshot.capturedAt, { zone: config.timezone });
  const capturedDate = capturedAt.isValid ? capturedAt.toFormat('dd.MM.yyyy_HH-mm-ss') : 'unbekannt';

  return {
    evidence: safeAsciiGerman(`Nachweis_Hausaufgaben_${rangeHuman}.md`),
    summaryCsv: safeAsciiGerman(`Uebersicht_Hausaufgaben_${rangeHuman}.csv`),
    snapshot: safeAsciiGerman(`Abruf_Hausaufgaben_${capturedDate}.json`)
  };
}

async function runWatcher() {
  if (running) {
    console.log('[watcher] Ein Lauf ist bereits aktiv.');
    return { skipped: true };
  }

  running = true;

  try {
    ensureDirs([config.dataDir, config.profileDir, config.snapshotsDir, config.reportsDir, config.stateDir, config.mailDir, config.logsDir]);

    console.log('[watcher] Abruf startet...');
    const capture = await collectHomework(config);
    const storedItems = config.onlyCurrentWeek
      ? filterToCurrentWeek(capture.items, config.timezone)
      : filterByRollingWindow(capture.items, config.timezone, config.lookbackDays, config.lookaheadDays);

    const artifacts = prepareArtifacts(
      config,
      {
        capturedAt: DateTime.now().setZone(config.timezone).toISO(),
        source: capture.source,
        rawItemsCount: capture.items.length
      },
      storedItems
    );

    console.log(
      `[watcher] Fertig. Änderungen: neu ${artifacts.diff.added.length}, entfernt ${artifacts.diff.removed.length}`
    );
    console.log(`[watcher] Nachweis: ${artifacts.files.evidenceRelativePath}`);
    console.log(`[watcher] CSV: ${artifacts.files.summaryCsvRelativePath}`);

    const shouldMail =
      config.mail.enabled &&
      (config.mail.mode === 'always' || (config.mail.mode === 'changes' && artifacts.diff.changed));

    const mailText = buildMailText({
      config,
      snapshot: artifacts.snapshot,
      diff: artifacts.diff,
      summaryRows: artifacts.summaryRows,
      evidenceRelativePath: artifacts.files.evidenceRelativePath
    });

    const mailHtml = buildWatcherMailHtml({
      config,
      snapshot: artifacts.snapshot,
      diff: artifacts.diff,
      summaryRows: artifacts.summaryRows,
      evidenceRelativePath: artifacts.files.evidenceRelativePath
    });

    const attachmentNames = buildAttachmentNames(config, artifacts.snapshot);

    const previewTextPath = persistMailPreview(
      config,
      'latest-mail.txt',
      `${mailText}\n\nAnhänge:\n- ${attachmentNames.evidence}\n- ${attachmentNames.summaryCsv}\n- ${attachmentNames.snapshot}\n`
    );
    persistMailPreview(config, 'latest-mail.html', mailHtml);

    if (shouldMail) {
      const rangeHuman = formatDateRangeGerman(
        artifacts.snapshot.range.start,
        artifacts.snapshot.range.end,
        config.timezone
      );

      const result = await sendMail(config, {
        subject: `[Schulmanager] Hausaufgaben geändert ${rangeHuman}`,
        text: mailText,
        html: mailHtml,
        attachments: [
          { filename: attachmentNames.evidence, path: artifacts.files.evidencePath },
          { filename: attachmentNames.summaryCsv, path: artifacts.files.summaryCsvPath },
          { filename: attachmentNames.snapshot, path: artifacts.files.snapshotPath }
        ]
      });
      console.log(`[watcher] Mail versendet (${result.messageId}).`);
    } else {
      console.log(`[watcher] Keine Mail versendet. Vorschau: ${path.relative(config.dataDir, previewTextPath)}`);
    }

    return { skipped: false, artifacts };
  } catch (error) {
    console.error('[watcher] Fehler:', error.message);
    if (config.mail.enabled && config.mail.onError) {
      const now = DateTime.now().setZone(config.timezone);
      const text = [
        'Schulmanager-Watcher Fehler',
        '',
        `Zeit: ${now.toISO()}`,
        `Fehler: ${error.message}`,
        '',
        error.stack || ''
      ].join('\n');
      const html = buildErrorMailHtml({
        config,
        now,
        message: error.message,
        stack: error.stack || ''
      });

      persistMailPreview(config, 'latest-error-mail.txt', text);
      persistMailPreview(config, 'latest-error-mail.html', html);

      try {
        await sendMail(config, {
          subject: '[Schulmanager] Watcher-Fehler',
          text,
          html
        });
      } catch (mailError) {
        console.error('[watcher] Fehler beim Mailversand:', mailError.message);
      }
    }
    throw error;
  } finally {
    running = false;
  }
}

if (require.main === module) {
  runWatcher().catch(() => {
    process.exitCode = 1;
  });
}

module.exports = { runWatcher };
