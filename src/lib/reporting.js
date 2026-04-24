const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
const { readJson, writeJson, writeText, listFilesRecursive, removeIfExists } = require('./files');
const {
  currentWeekRange,
  monitorRange,
  formatHuman,
  formatHumanWithWeekday,
  formatDateGerman,
  formatDateGermanWithWeekday,
  formatDateRangeGerman,
  toDateTime
} = require('./time');
const { itemId, fingerprint, diffItems, escapeCsv, sortItems } = require('./homework');

function statePath(config) {
  return path.join(config.stateDir, 'state.json');
}

function loadState(config) {
  return (
    readJson(statePath(config), {
      version: 1,
      lastSnapshotRelativePath: null,
      items: {}
    }) || { version: 1, lastSnapshotRelativePath: null, items: {} }
  );
}

function saveState(config, state) {
  writeJson(statePath(config), state);
}

function rel(config, absPath) {
  return path.relative(config.dataDir, absPath).replace(/\\/g, '/');
}

function abs(config, relativePath) {
  return relativePath ? path.join(config.dataDir, relativePath) : null;
}

function snapshotFilePath(config, capturedAt) {
  const safe = capturedAt.replace(/[:]/g, '-');
  return path.join(config.snapshotsDir, `${safe}.json`);
}

function markdownTextBlock(value, indent = '  ') {
  return String(value)
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');
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

function buildEvidenceReport({ config, capturedAt, range, diff, summaryRows, snapshotRelativePath, previousRelativePath }) {
  const lines = [];
  lines.push('# Schulmanager Hausaufgaben-Nachweis');
  lines.push('');
  lines.push(`Abgerufen: ${formatHuman(DateTime.fromISO(capturedAt, { zone: config.timezone }))}`);
  lines.push(`Überwachungszeitraum: ${formatDateRangeGerman(range.start, range.end, config.timezone)}`);
  lines.push(`Fenster: ${range.lookbackDays} Tage zurück, ${range.lookaheadDays} Tage voraus`);
  lines.push(`Aktueller Snapshot: ${snapshotRelativePath}`);
  lines.push(`Vorheriger Snapshot: ${previousRelativePath || 'keiner'}`);
  lines.push('');

  if (!diff.changed) {
    lines.push('Keine Änderung seit dem letzten Abruf.');
    lines.push('');
  } else {
    if (diff.added.length > 0) {
      lines.push('## Seit dem letzten Abruf neu erkannt');
      lines.push('');
      for (const item of sortRowsDescending(diff.added, config.timezone)) {
        lines.push(`- ${formatDateGermanWithWeekday(item.date, config.timezone)} | ${item.subject}`);
        lines.push(markdownTextBlock(item.homework));
      }
      lines.push('');
    }

    if (diff.removed.length > 0) {
      lines.push('## Seit dem letzten Abruf nicht mehr vorhanden');
      lines.push('');
      for (const item of sortRowsDescending(diff.removed, config.timezone)) {
        lines.push(`- ${formatDateGermanWithWeekday(item.date, config.timezone)} | ${item.subject}`);
        lines.push(markdownTextBlock(item.homework));
      }
      lines.push('');
    }
  }

  lines.push('## Hausaufgaben im Überwachungsfenster');
  lines.push('');
  for (const row of sortRowsDescending(summaryRows, config.timezone)) {
    lines.push(`- ${row.dateHumanWithWeekday} | ${row.subject}`);
    lines.push(markdownTextBlock(row.homework));
    lines.push(`  Erstmals erkannt: ${row.firstSeenAtHumanWithWeekday}`);
    lines.push('');
  }

  return lines.join('\n');
}

function buildSummaryRows(config, items, state) {
  return sortRowsDescending(
    sortItems(items).map((item) => {
      const record = state.items[itemId(item)] || {};
      const firstSeen = record.firstSeenAt || null;
      const lastSeen = record.lastSeenAt || null;
      return {
        date: item.date,
        dateHuman: formatDateGerman(item.date, config.timezone),
        dateHumanWithWeekday: formatDateGermanWithWeekday(item.date, config.timezone),
        subject: item.subject,
        homework: item.homework,
        firstSeenAt: firstSeen,
        lastSeenAt: lastSeen,
        firstSeenAtHuman: firstSeen
          ? formatHuman(DateTime.fromISO(firstSeen, { zone: config.timezone }))
          : 'unbekannt',
        firstSeenAtHumanWithWeekday: firstSeen
          ? formatHumanWithWeekday(DateTime.fromISO(firstSeen, { zone: config.timezone }))
          : 'unbekannt',
        lastSeenAtHuman: lastSeen
          ? formatHuman(DateTime.fromISO(lastSeen, { zone: config.timezone }))
          : 'unbekannt',
        lastSeenAtHumanWithWeekday: lastSeen
          ? formatHumanWithWeekday(DateTime.fromISO(lastSeen, { zone: config.timezone }))
          : 'unbekannt',
        firstSeenSnapshot: record.firstSeenSnapshot || '',
        lastSeenSnapshot: record.lastSeenSnapshot || '',
        id: itemId(item)
      };
    }),
    config.timezone
  );
}

function buildCsv(summaryRows) {
  const lines = [
    'date,date_de,date_de_weekday,subject,first_seen_at,first_seen_at_de,first_seen_snapshot,last_seen_at,last_seen_at_de,last_seen_snapshot,id,homework'
  ];

  for (const row of summaryRows) {
    lines.push(
      [
        row.date,
        row.dateHuman,
        row.dateHumanWithWeekday,
        row.subject,
        row.firstSeenAt || '',
        row.firstSeenAtHumanWithWeekday || row.firstSeenAtHuman || '',
        row.firstSeenSnapshot || '',
        row.lastSeenAt || '',
        row.lastSeenAtHumanWithWeekday || row.lastSeenAtHuman || '',
        row.lastSeenSnapshot || '',
        row.id,
        row.homework
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  return lines.join('\n') + '\n';
}

function buildMailText({ config, snapshot, diff, summaryRows, evidenceRelativePath }) {
  const lines = [];
  lines.push('Schulmanager Hausaufgaben-Änderung');
  lines.push('');
  lines.push(`Abgerufen: ${formatHuman(DateTime.fromISO(snapshot.capturedAt, { zone: config.timezone }))}`);
  lines.push(`Überwachungszeitraum: ${formatDateRangeGerman(snapshot.range.start, snapshot.range.end, config.timezone)}`);
  lines.push(`Fenster: ${snapshot.range.lookbackDays} Tage zurück, ${snapshot.range.lookaheadDays} Tage voraus`);
  lines.push(`Änderungen: neu ${diff.added.length}, entfernt ${diff.removed.length}`);
  lines.push(`Nachweis: ${evidenceRelativePath}`);
  lines.push('');

  if (diff.removed.length > 0) {
    lines.push('Seit dem letzten Abruf nicht mehr vorhanden:');
    for (const item of sortRowsDescending(diff.removed, config.timezone)) {
      lines.push(`- ${formatDateGermanWithWeekday(item.date, config.timezone)} | ${item.subject}`);
      lines.push(item.homework);
      lines.push('');
    }
  }

  lines.push('Hausaufgaben im Überwachungsfenster:');
  for (const row of sortRowsDescending(summaryRows, config.timezone)) {
    lines.push(`- ${row.dateHumanWithWeekday} | ${row.subject}`);
    lines.push(row.homework);
    lines.push(`Erstmals erkannt: ${row.firstSeenAtHumanWithWeekday}`);
    lines.push('');
  }

  return lines.join('\n');
}

function pruneState(config, state, nowIso) {
  const threshold = DateTime.fromISO(nowIso, { zone: config.timezone }).minus({ days: config.retentionDays });
  const nextItems = {};

  for (const [id, record] of Object.entries(state.items || {})) {
    const lastSeen = record.lastSeenAt ? DateTime.fromISO(record.lastSeenAt, { zone: config.timezone }) : null;
    if (lastSeen && lastSeen >= threshold) {
      nextItems[id] = record;
    }
  }

  state.items = nextItems;
}

function rotateFiles(config, nowIso) {
  const threshold = DateTime.fromISO(nowIso, { zone: config.timezone }).minus({ days: config.retentionDays });
  const roots = [config.snapshotsDir, config.reportsDir, config.mailDir, config.logsDir];

  for (const root of roots) {
    for (const filePath of listFilesRecursive(root)) {
      const stat = fs.statSync(filePath);
      const modified = DateTime.fromJSDate(stat.mtime, { zone: config.timezone });
      if (modified < threshold) {
        removeIfExists(filePath);
      }
    }
  }
}

function prepareArtifacts(config, capture, items) {
  const state = loadState(config);
  const previousSnapshotPath = abs(config, state.lastSnapshotRelativePath);
  const previousSnapshot = previousSnapshotPath ? readJson(previousSnapshotPath, null) : null;

  const currentWeek = currentWeekRange(config.timezone);
  const monitored = monitorRange(config.timezone, config.lookbackDays, config.lookaheadDays);
  const capturedAt = capture.capturedAt;
  const snapshotFingerprint = fingerprint(items);
  const snapshotPath = snapshotFilePath(config, capturedAt);
  const snapshotRelativePath = rel(config, snapshotPath);
  const previousRelativePath = state.lastSnapshotRelativePath || null;

  const snapshot = {
    capturedAt,
    timezone: config.timezone,
    week: {
      isoWeekYear: currentWeek.current.weekYear,
      isoWeekNumber: currentWeek.current.weekNumber,
      start: currentWeek.start.toISODate(),
      end: currentWeek.end.toISODate()
    },
    range: {
      start: monitored.start.toISODate(),
      end: monitored.end.toISODate(),
      lookbackDays: config.lookbackDays,
      lookaheadDays: config.lookaheadDays
    },
    source: capture.source,
    counts: {
      totalItemsInResponse: capture.rawItemsCount,
      storedItems: items.length
    },
    fingerprint: snapshotFingerprint,
    items
  };

  writeJson(snapshotPath, snapshot);

  const previousItems = previousSnapshot?.items || [];
  const diff = diffItems(previousItems, items);

  const nextState = state;
  nextState.version = 1;
  nextState.lastSnapshotRelativePath = snapshotRelativePath;

  for (const item of items) {
    const id = itemId(item);
    const existing = nextState.items[id] || {};
    nextState.items[id] = {
      id,
      date: item.date,
      subject: item.subject,
      homework: item.homework,
      firstSeenAt: existing.firstSeenAt || capturedAt,
      firstSeenSnapshot: existing.firstSeenSnapshot || snapshotRelativePath,
      lastSeenAt: capturedAt,
      lastSeenSnapshot: snapshotRelativePath
    };
  }

  pruneState(config, nextState, capturedAt);
  saveState(config, nextState);
  rotateFiles(config, capturedAt);

  const summaryRows = buildSummaryRows(config, items, nextState);
  const evidencePath = path.join(config.reportsDir, 'latest-evidence.md');
  const summaryCsvPath = path.join(config.reportsDir, config.onlyCurrentWeek ? 'current-week-first-seen.csv' : 'watch-window-first-seen.csv');
  const summaryJsonPath = path.join(config.reportsDir, config.onlyCurrentWeek ? 'current-week-first-seen.json' : 'watch-window-first-seen.json');

  const evidence = buildEvidenceReport({
    config,
    capturedAt,
    range: snapshot.range,
    diff,
    summaryRows,
    snapshotRelativePath,
    previousRelativePath
  });

  writeText(evidencePath, evidence);
  writeText(summaryCsvPath, buildCsv(summaryRows));
  writeJson(summaryJsonPath, summaryRows);

  return {
    snapshot,
    diff,
    summaryRows,
    files: {
      snapshotPath,
      snapshotRelativePath,
      evidencePath,
      evidenceRelativePath: rel(config, evidencePath),
      summaryCsvPath,
      summaryCsvRelativePath: rel(config, summaryCsvPath),
      summaryJsonPath,
      summaryJsonRelativePath: rel(config, summaryJsonPath)
    }
  };
}

module.exports = {
  prepareArtifacts,
  buildMailText,
  buildEvidenceReport,
  buildSummaryRows
};
