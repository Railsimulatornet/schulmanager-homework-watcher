const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ensureDir, readJson } = require('./files');

function atomicWrite(filePath, content) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content, { mode: 0o660 });
  fs.renameSync(temporary, filePath);
}

function atomicJson(filePath, value) {
  atomicWrite(filePath, JSON.stringify(value, null, 2) + '\n');
}

function stableJson(value) {
  return JSON.stringify(value);
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function removeOldFiles(dir, retentionDays) {
  if (!fs.existsSync(dir)) return;
  const oldest = Date.now() - retentionDays * 86400000;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const filePath = path.join(dir, entry.name);
    if (fs.statSync(filePath).mtimeMs < oldest) fs.rmSync(filePath);
  }
}

function renderEvidence(module, snapshot, events, baseline) {
  const lines = [`# Schulmanager-Nachweis: ${module.title}`, '', `Abruf: ${snapshot.capturedAt}`, `Bereich: ${module.title}`, `Snapshot: ${snapshot.relativePath}`, `Datensätze: ${snapshot.items.length}`, ''];
  if (baseline) lines.push('Erster erfolgreicher Abruf dieses Bereichs: Ausgangsstand ohne Änderungsmail.', '');
  if (!events.length) lines.push('Keine Änderung seit dem letzten erfolgreichen Abruf.', '');
  for (const event of events) {
    lines.push(`## ${event.type}: ${event.currentValue?.title || event.previousValue?.title || event.id}`, '');
    lines.push(`Erstmals erkannt: ${event.firstSeenAt || 'unbekannt'}`);
    lines.push(`Änderung erkannt: ${event.changedAt}`);
    lines.push(`Vorher: ${event.previousValue ? JSON.stringify(event.previousValue.details, null, 2) : 'nicht vorhanden'}`);
    lines.push(`Nachher: ${event.currentValue ? JSON.stringify(event.currentValue.details, null, 2) : 'nicht vorhanden'}`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

function csv(items, state) {
  const lines = ['Datum,Titel,Erstmals erkannt,Zuletzt gesehen,Zuletzt geändert,ID,Details'];
  for (const item of items) {
    const record = state.items[item.id];
    lines.push([item.date, item.title, record.firstSeenAt, record.lastSeenAt, record.changedAt || '', item.id, JSON.stringify(item.details)].map(csvCell).join(','));
  }
  return lines.join('\n') + '\n';
}

function processModule(config, module, capture, capturedAt, beforeCommit) {
  if (!Array.isArray(capture.items)) throw new Error(`${module.title}: keine Datensatzliste.`);
  const moduleDir = path.join(config.dataDir, 'modules', module.key);
  const snapshotsDir = path.join(moduleDir, 'snapshots');
  const reportsDir = path.join(moduleDir, 'reports');
  const stateFile = path.join(moduleDir, 'state.json');
  const previous = readJson(stateFile, { version: 1, scope: null, lastSnapshot: null, items: {}, pendingEmptyCount: 0 });
  const sameScope = previous.scope === capture.scope;
  const state = sameScope ? previous : { version: 1, scope: capture.scope, lastSnapshot: null, items: {}, pendingEmptyCount: 0 };
  const baseline = !state.lastSnapshot;
  const activeCount = Object.values(state.items).filter(item => item.active).length;
  if (sameScope && !baseline && activeCount > 0 && capture.items.length === 0 && state.pendingEmptyCount < 2) {
    state.pendingEmptyCount += 1;
    atomicJson(stateFile, state);
    return { deferredEmpty: true, attempts: state.pendingEmptyCount };
  }
  state.pendingEmptyCount = 0;
  const byId = new Map();
  for (const item of capture.items) {
    if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9:_-]+$/.test(item.id) || ['__proto__','constructor','prototype'].includes(item.id) || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !item.title || !item.details || byId.has(item.id)) {
      throw new Error(`${module.title}: ungültiger oder doppelter Datensatz.`);
    }
    byId.set(item.id, item);
  }
  const fileName = `${capturedAt.replace(/[:]/g, '-').replace(/[^A-Za-z0-9._+-]/g, '_')}.json`;
  const snapshotPath = path.join(snapshotsDir, fileName);
  const relativePath = path.relative(config.dataDir, snapshotPath).replace(/\\/g, '/');
  const snapshot = {
    version: 1, module: module.key, capturedAt, scope: capture.scope, range: capture.range || null,
    previousSnapshot: state.lastSnapshot, relativePath,
    fingerprint: crypto.createHash('sha256').update(stableJson([...byId.values()].sort((a,b) => a.id.localeCompare(b.id)))).digest('hex'),
    items: [...byId.values()].sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  };
  const events = [];
  for (const item of snapshot.items) {
    const old = state.items[item.id];
    if (!old) {
      state.items[item.id] = { value: item, firstSeenAt: capturedAt, lastSeenAt: capturedAt, changedAt: baseline ? null : capturedAt, active: true, firstSeenSnapshot: relativePath, lastSeenSnapshot: relativePath };
      if (!baseline) events.push({ type: 'Neu', id: item.id, firstSeenAt: capturedAt, changedAt: capturedAt, previousValue: null, currentValue: item });
    } else {
      const changed = stableJson(old.value) !== stableJson(item);
      const reappeared = !old.active;
      if (changed || reappeared) events.push({ type: reappeared ? 'Wieder vorhanden' : 'Geändert', id: item.id, firstSeenAt: old.firstSeenAt, changedAt: capturedAt, previousValue: old.value, currentValue: item });
      old.value = item;
      old.lastSeenAt = capturedAt;
      old.lastSeenSnapshot = relativePath;
      old.active = true;
      if (changed || reappeared) old.changedAt = capturedAt;
    }
  }
  for (const [id, old] of Object.entries(state.items)) {
    if (!old.active || byId.has(id)) continue;
    old.active = false;
    old.changedAt = capturedAt;
    const inRange = !capture.range || (old.value.date >= capture.range.start && old.value.date <= capture.range.end);
    if (!baseline && inRange) events.push({ type: 'Entfernt', id, firstSeenAt: old.firstSeenAt, changedAt: capturedAt, previousValue: old.value, currentValue: null });
  }
  const threshold = Date.now() - config.retentionDays * 86400000;
  for (const [id, record] of Object.entries(state.items)) {
    if (!record.active && Date.parse(record.lastSeenAt) < threshold) delete state.items[id];
  }
  state.lastSnapshot = relativePath;
  snapshot.events = events;
  snapshot.observations = snapshot.items.map(item => ({
    id: item.id,
    firstSeenAt: state.items[item.id].firstSeenAt,
    lastSeenAt: state.items[item.id].lastSeenAt,
    changedAt: state.items[item.id].changedAt,
    firstSeenSnapshot: state.items[item.id].firstSeenSnapshot,
    lastSeenSnapshot: state.items[item.id].lastSeenSnapshot
  }));
  atomicJson(snapshotPath, snapshot);
  atomicWrite(path.join(reportsDir, 'latest-evidence.md'), renderEvidence(module, snapshot, events, baseline));
  atomicJson(path.join(reportsDir, 'latest-summary.json'), snapshot.items.map(item => ({ ...item, firstSeenAt: state.items[item.id].firstSeenAt, lastSeenAt: state.items[item.id].lastSeenAt, changedAt: state.items[item.id].changedAt })));
  atomicWrite(path.join(reportsDir, 'latest-summary.csv'), csv(snapshot.items, state));
  const result = {
    baseline, deferredEmpty: false, events, snapshot,
    files: { evidence: path.join(reportsDir, 'latest-evidence.md'), csv: path.join(reportsDir, 'latest-summary.csv'), snapshot: snapshotPath }
  };
  if (beforeCommit) beforeCommit(result);
  atomicJson(stateFile, state);
  removeOldFiles(snapshotsDir, config.retentionDays);
  return result;
}

module.exports = { processModule, atomicJson, atomicWrite, csvCell };
