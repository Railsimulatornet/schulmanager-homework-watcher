const crypto = require('crypto');
const { DateTime } = require('luxon');
const { monitorRange } = require('./time');

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeItem(item) {
  return {
    date: String(item.date || '').trim(),
    subject: String(item.subject || '').trim(),
    homework: normalizeText(item.homework)
  };
}

function itemId(item) {
  return crypto.createHash('sha1').update(JSON.stringify(normalizeItem(item))).digest('hex');
}

function fingerprint(items) {
  const stable = items.map((item) => ({ id: itemId(item), ...normalizeItem(item) })).sort((a, b) => {
    const left = `${a.date}|${a.subject}|${a.homework}`;
    const right = `${b.date}|${b.subject}|${b.homework}`;
    return left.localeCompare(right, 'de');
  });

  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const left = `${a.date}|${a.subject}|${a.homework}`;
    const right = `${b.date}|${b.subject}|${b.homework}`;
    return left.localeCompare(right, 'de');
  });
}

function filterByRollingWindow(items, tz, pastDays = 10, futureDays = 7) {
  const range = monitorRange(tz, pastDays, futureDays);

  return sortItems(
    items
      .map(normalizeItem)
      .filter((item) => {
        const dt = DateTime.fromISO(item.date, { zone: tz });
        if (!dt.isValid) return false;
        const day = dt.startOf('day');
        return day >= range.start.startOf('day') && day <= range.end.endOf('day');
      })
  );
}

function filterToCurrentWeek(items, tz) {
  const now = DateTime.now().setZone(tz);
  const start = now.startOf('week');
  const end = now.endOf('week');

  return sortItems(
    items
      .map(normalizeItem)
      .filter((item) => {
        const dt = DateTime.fromISO(item.date, { zone: tz });
        return dt.isValid && dt >= start && dt <= end;
      })
  );
}

function diffItems(previousItems, currentItems) {
  const previousMap = new Map(previousItems.map((item) => [itemId(item), item]));
  const currentMap = new Map(currentItems.map((item) => [itemId(item), item]));

  const added = [];
  const removed = [];

  for (const [id, item] of currentMap.entries()) {
    if (!previousMap.has(id)) added.push(item);
  }

  for (const [id, item] of previousMap.entries()) {
    if (!currentMap.has(id)) removed.push(item);
  }

  return {
    added: sortItems(added),
    removed: sortItems(removed),
    changed: added.length > 0 || removed.length > 0
  };
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

module.exports = {
  normalizeText,
  normalizeItem,
  itemId,
  fingerprint,
  filterToCurrentWeek,
  filterByRollingWindow,
  diffItems,
  sortItems,
  escapeCsv
};
