const { DateTime } = require('luxon');

function now(tz) {
  return DateTime.now().setZone(tz);
}

function currentWeekRange(tz) {
  const current = now(tz);
  const start = current.startOf('week');
  const end = current.endOf('week');
  return { current, start, end };
}

function monitorRange(tz, pastDays = 10, futureDays = 7) {
  const current = now(tz);
  const start = current.startOf('day').minus({ days: Math.max(0, Number(pastDays) || 0) });
  const end = current.endOf('day').plus({ days: Math.max(0, Number(futureDays) || 0) });
  return {
    current,
    start,
    end,
    pastDays: Math.max(0, Number(pastDays) || 0),
    futureDays: Math.max(0, Number(futureDays) || 0)
  };
}

function toDateTime(value, tz) {
  if (!value) return null;

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const dt = DateTime.fromISO(value, { zone: tz });
    return dt.isValid ? dt : null;
  }

  const dt = DateTime.fromISO(String(value), { zone: tz });
  return dt.isValid ? dt : null;
}

function formatHuman(dt) {
  return dt.setLocale('de').toFormat('dd.MM.yyyy HH:mm:ss ZZZZ');
}

function formatHumanWithWeekday(dt) {
  return dt.setLocale('de').toFormat('EEEE, dd.MM.yyyy HH:mm:ss ZZZZ');
}

function formatDateGerman(value, tz) {
  const dt = toDateTime(value, tz);
  return dt ? dt.setLocale('de').toFormat('dd.MM.yyyy') : String(value || '');
}

function formatDateGermanWithWeekday(value, tz) {
  const dt = toDateTime(value, tz);
  return dt ? dt.setLocale('de').toFormat('EEEE, dd.MM.yyyy') : String(value || '');
}

function formatDateRangeGerman(start, end, tz) {
  return `${formatDateGerman(start, tz)} bis ${formatDateGerman(end, tz)}`;
}

module.exports = {
  now,
  currentWeekRange,
  monitorRange,
  formatHuman,
  formatHumanWithWeekday,
  formatDateGerman,
  formatDateGermanWithWeekday,
  formatDateRangeGerman,
  toDateTime
};
