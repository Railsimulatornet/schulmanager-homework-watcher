const path = require('path');
const { DateTime } = require('luxon');
const { config } = require('./lib/config');
const { installTimestampedConsole } = require('./lib/logging');
const { ensureDirs, readJson } = require('./lib/files');
const { createSession, callEndpoint, collectHomeworkWithSession } = require('./lib/collector');
const { filterByRollingWindow, filterToCurrentWeek } = require('./lib/homework');
const { prepareArtifacts, buildMailText } = require('./lib/reporting');
const { persistMailPreview } = require('./lib/mail');
const { queueMail, flushOutbox } = require('./lib/outbox');
const { buildWatcherMailHtml } = require('./lib/mail-html');
const { formatDateRangeGerman, monitorRange } = require('./lib/time');
const { processModule, atomicWrite, atomicJson } = require('./lib/module-state');
const { renderModuleMail } = require('./lib/module-mail');
const { acquireRunLock } = require('./lib/run-lock');
const { canAttempt, recovered, failed } = require('./lib/error-state');
const modules = require('./modules');

installTimestampedConsole(config.timezone);

function safeAsciiGerman(value) {
  return String(value).replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

function buildAttachmentNames(snapshot) {
  const rangeHuman = formatDateRangeGerman(snapshot.range.start, snapshot.range.end, config.timezone);
  const capturedAt = DateTime.fromISO(snapshot.capturedAt, { zone: config.timezone });
  const capturedDate = capturedAt.isValid ? capturedAt.toFormat('dd.MM.yyyy_HH-mm-ss') : 'unbekannt';
  return {
    evidence: safeAsciiGerman(`Nachweis_Hausaufgaben_${rangeHuman}.md`),
    summaryCsv: safeAsciiGerman(`Uebersicht_Hausaufgaben_${rangeHuman}.csv`),
    snapshot: safeAsciiGerman(`Abruf_Hausaufgaben_${capturedDate}.json`)
  };
}

function contextFor(session) {
  let termPromise;
  let classHoursPromise;
  return {
    call: (moduleName, endpointName, parameters) => callEndpoint(config, session, moduleName, endpointName, parameters),
    getModuleState: key => readJson(path.join(config.dataDir, 'modules', key, 'state.json'), { items: {} }),
    getTerm: () => (termPromise ||= callEndpoint(config, session, null, 'get-current-term', {})),
    getClassHours: () => (classHoursPromise ||= callEndpoint(config, session, 'classbook', 'get-class-hours', {})),
    range: () => {
      const range = monitorRange(config.timezone, config.lookbackDays, config.lookaheadDays);
      return { start: range.start.toISODate(), end: range.end.toISODate() };
    }
  };
}

async function runHomework(session) {
  const capture = await collectHomeworkWithSession(config, session);
  const storedItems = config.onlyCurrentWeek
    ? filterToCurrentWeek(capture.items, config.timezone)
    : filterByRollingWindow(capture.items, config.timezone, config.lookbackDays, config.lookaheadDays);
  const emptyFile = path.join(config.stateDir, 'homework-empty-confirmation.json');
  const oldState = readJson(path.join(config.stateDir, 'state.json'), {});
  let previousItems = [];
  if (oldState.lastSnapshotRelativePath) {
    const previousPath = path.resolve(config.dataDir, oldState.lastSnapshotRelativePath);
    if (!previousPath.startsWith(path.resolve(config.dataDir) + path.sep)) throw new Error('Ungültiger Snapshot-Pfad.');
    previousItems = readJson(previousPath, {})?.items || [];
  }
  const relevantPrevious = config.onlyCurrentWeek ? filterToCurrentWeek(previousItems,config.timezone)
    : filterByRollingWindow(previousItems,config.timezone,config.lookbackDays,config.lookaheadDays);
  if (!storedItems.length && relevantPrevious.length) {
    const count = Number(readJson(emptyFile,{count:0}).count || 0) + 1;
    atomicJson(emptyFile,{count});
    if (count < 3) {
      console.log(`[watcher] Hausaufgaben: leerer Abruf ${count}/3, Löschungen zurückgestellt.`);
      await flushOutbox(config,'homework');
      return { deferredEmpty:true };
    }
  }
  atomicJson(emptyFile,{count:0});
  const artifacts = prepareArtifacts(config, {
    capturedAt: DateTime.now().setZone(config.timezone).toISO(),
    source: capture.source,
    rawItemsCount: capture.items.length
  }, storedItems, prepareHomeworkNotification);
  const sent = await flushOutbox(config, 'homework');
  if (sent) console.log('[watcher] Hausaufgaben: Mail versendet.');
  console.log(`[watcher] Hausaufgaben: neu ${artifacts.diff.added.length}, entfernt ${artifacts.diff.removed.length}.`);
  return artifacts;
}

function prepareHomeworkNotification(artifacts) {
  const mailText = buildMailText({ config, snapshot: artifacts.snapshot, diff: artifacts.diff,
    summaryRows: artifacts.summaryRows, evidenceRelativePath: artifacts.files.evidenceRelativePath });
  const mailHtml = buildWatcherMailHtml({ config, snapshot: artifacts.snapshot, diff: artifacts.diff,
    summaryRows: artifacts.summaryRows, evidenceRelativePath: artifacts.files.evidenceRelativePath });
  const names = buildAttachmentNames(artifacts.snapshot);
  persistMailPreview(config, 'latest-mail.txt', `${mailText}\n\nAnhänge:\n- ${names.evidence}\n- ${names.summaryCsv}\n- ${names.snapshot}\n`);
  persistMailPreview(config, 'latest-mail.html', mailHtml);
  const shouldMail = config.mail.enabled && config.mail.categories.homework &&
    (config.mail.mode === 'always' || (config.mail.mode === 'changes' && artifacts.diff.changed));
  if (shouldMail) {
    const rangeHuman = formatDateRangeGerman(artifacts.snapshot.range.start, artifacts.snapshot.range.end, config.timezone);
    queueMail(config, 'homework', {
      subject: `[Schulmanager] Hausaufgaben geändert ${rangeHuman}`,
      text: mailText, html: mailHtml,
      attachments: [
        { filename: names.evidence, path: artifacts.files.evidencePath },
        { filename: names.summaryCsv, path: artifacts.files.summaryCsvPath },
        { filename: names.snapshot, path: artifacts.files.snapshotPath }
      ]
    }, `${artifacts.snapshot.previousSnapshot || 'initial'}:${artifacts.snapshot.fingerprint}`);
  }
}

async function runModule(module, session, context) {
  const capture = await module.collect(config, session, context);
  const result = processModule(config, module, capture, DateTime.now().setZone(config.timezone).toISO(), result => prepareModuleNotification(module,result));
  const sent = await flushOutbox(config, module.key);
  if (sent) console.log(`[watcher] ${module.title}: Mail versendet.`);
  if (result.deferredEmpty) {
    console.log(`[watcher] ${module.title}: leerer Abruf ${result.attempts}/3, Löschungen zurückgestellt.`);
    return result;
  }
  console.log(`[watcher] ${module.title}: ${result.baseline ? 'Ausgangsstand' : `${result.events.length} Änderungen`}, ${result.snapshot.items.length} Datensätze.`);
  return result;
}

function prepareModuleNotification(module, result) {
  const preview = renderModuleMail(config, module, result);
  atomicWrite(path.join(config.mailDir, `latest-${module.key}.txt`), preview.text);
  atomicWrite(path.join(config.mailDir, `latest-${module.key}.html`), preview.html);
  if (config.mail.enabled && config.mail.categories[module.key] && result.events.length > 0) {
    queueMail(config, module.key, {
      subject: `[Schulmanager] ${module.title}: ${result.events.length} Änderung${result.events.length === 1 ? '' : 'en'}`,
      text: preview.text, html: preview.html,
      attachments: [
        { filename: `Nachweis_${module.key}.md`, path: result.files.evidence },
        { filename: `Uebersicht_${module.key}.csv`, path: result.files.csv },
        { filename: `Abruf_${module.key}.json`, path: result.files.snapshot }
      ]
    }, `${result.snapshot.previousSnapshot || 'initial'}:${result.snapshot.fingerprint}`);
  }
}

async function runWatcher() {
  ensureDirs([config.dataDir, config.profileDir, config.snapshotsDir, config.reportsDir, config.stateDir, config.mailDir, config.logsDir]);
  const release = acquireRunLock(config);
  if (!release) {
    console.log('[watcher] Ein Lauf ist bereits aktiv.');
    return { skipped: true, errors: [] };
  }
  const errors = [];
  try {
    if (!canAttempt(config, 'global')) {
      console.log('[watcher] Allgemeine Abrufpause ist noch aktiv.');
      return { skipped: true, errors };
    }
    let session;
    try {
      session = await createSession(config);
      recovered(config, 'global');
    } catch (error) {
      await failed(config, 'global', 'Anmeldung', error);
      errors.push('Anmeldung');
      return { skipped: false, errors };
    }
    const context = contextFor(session);
    const jobs = [
      { key: 'homework', title: 'Hausaufgaben', run: () => runHomework(session) },
      ...modules.map(module => ({ key: module.key, title: module.title, run: () => runModule(module, session, context) }))
    ];
    for (const job of jobs) {
      if (!config.watch[job.key] || !canAttempt(config, job.key)) continue;
      try {
        await job.run();
        recovered(config, job.key);
      } catch (error) {
        if ([401, 429, 503].includes(Number(error.httpStatus))) {
          await failed(config, 'global', 'Schulmanager-Dienst', error);
          errors.push('Schulmanager-Dienst');
          break;
        }
        await failed(config, job.key, job.title, error);
        errors.push(job.title);
      }
    }
    return { skipped: false, errors };
  } finally {
    release();
  }
}

if (require.main === module) {
  runWatcher().then(result => { if (result.errors?.length) process.exitCode = 1; }).catch(() => { process.exitCode = 1; });
}

module.exports = { runWatcher };
