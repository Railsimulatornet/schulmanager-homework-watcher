const { dateGerman } = require('./date');

function safeIdPart(value) {
  const part = String(value ?? '');
  return /^[A-Za-z0-9_-]+$/.test(part) ? part : '';
}

function similarity(previous, row) {
  const old = previous?.value;
  if (!old) return 0;
  let score = old.title === row.title ? 1 : 0;
  for (const [key, value] of Object.entries(row.details)) {
    if (old.details?.[key] === value) score += 1;
  }
  return score;
}

function identifyRows(slot, rows, previousItems) {
  // The API may return two substitutions for the same original lesson. The
  // original lesson ID alone cannot identify both rows.
  const unique = [...new Map(rows.map(row => [JSON.stringify([row.sourceId, row.legacyId, row.title, row.details]), row])).values()];
  unique.sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.legacyId.localeCompare(b.legacyId) || JSON.stringify(a.details).localeCompare(JSON.stringify(b.details)));
  if (unique.length > 1 && new Set(unique.map(row => row.sourceId)).size !== unique.length) {
    throw new Error('Stundenplan: mehrdeutige Einträge mit gleicher Quellkennung.');
  }
  const previous = Object.entries(previousItems || {})
    .filter(([id]) => id === slot || id.startsWith(`${slot}:`))
    .sort((a, b) => Number(Boolean(b[1]?.active)) - Number(Boolean(a[1]?.active)) || a[0].localeCompare(b[0]));
  const assigned = new Map();
  const usedIds = new Set();
  function match(predicate) {
    for (const [id, record] of previous) {
      if (usedIds.has(id)) continue;
      const candidates = unique.filter(row => !assigned.has(row) && predicate(id, record, row));
      if (!candidates.length) continue;
      candidates.sort((a, b) => similarity(record, b) - similarity(record, a) || a.sourceId.localeCompare(b.sourceId));
      assigned.set(candidates[0], id);
      usedIds.add(id);
    }
  }
  // Source-specific IDs are matched before the old slot ID, so a lesson
  // disappearing from a multi-row slot cannot take another lesson's history.
  match((id, _record, row) => Boolean(row.sourceId) && id.endsWith(`:${row.sourceId}`));
  match((_id, record, row) => record?.value?.title === row.title && JSON.stringify(record.value.details) === JSON.stringify(row.details));
  match((id, _record, row) => Boolean(row.legacyId) && id === `${slot}:${row.legacyId}`);
  match((id, record) => id === slot && record?.active);
  match((_id, record) => Boolean(record?.active));

  for (const row of unique) {
    if (assigned.has(row)) continue;
    if (unique.length === 1 && !previous.length) {
      assigned.set(row, slot);
      continue;
    }
    if (!row.sourceId) throw new Error('Stundenplan: mehrdeutige Einträge ohne stabile Quellkennung.');
    const id = `${slot}:${safeIdPart(row.legacyId) || 'lesson'}:${safeIdPart(row.sourceId)}`;
    if (!safeIdPart(row.sourceId) || usedIds.has(id)) {
      throw new Error('Stundenplan: mehrdeutige Einträge mit gleicher Quellkennung.');
    }
    assigned.set(row, id);
    usedIds.add(id);
  }
  return unique.map(row => ({ id: assigned.get(row), date: row.date, title: row.title, details: row.details }));
}

function teachers(lesson) {
  return (lesson?.teachers || []).map(item => item.abbreviation || [item.firstname, item.lastname].filter(Boolean).join(' ')).join(', ');
}

function room(lesson) {
  return lesson?.room?.name || (lesson?.rooms || []).map(item => item.name).join(', ') || '';
}

module.exports = {
  key: 'timetable',
  title: 'Stundenplanänderungen',
  async collect(config, session, context) {
    const range = context.range();
    const data = await context.call('schedules', 'get-actual-lessons', {
      student: { id: session.studentId }, start: range.start, end: range.end
    });
    if (!Array.isArray(data)) throw new Error('Stundenplan: unerwartete Antwortform.');
    const slots = new Map();
    for (const item of data) {
      if (!item?.date || !item.classHour?.id) throw new Error('Stundenplaneintrag ohne Datum oder Stunde.');
      const original = item.originalLessons?.[0] || null;
      const current = item.actualLesson || item.event || null;
      const subject = current?.subjectLabel || current?.subject?.name || current?.subject?.abbreviation || current?.text || '';
      const slot = `${String(item.date).slice(0,10)}:${item.classHour.id}`;
      const row = {
        date: String(item.date).slice(0,10), title: `${dateGerman(item.date)} · ${item.classHour.number}. Stunde · ${subject || 'Ausfall'}`,
        details: {
          'Stunde': String(item.classHour.number || ''),
          'Art': ({regularLesson:'Regulär',changedLesson:'Geändert',cancelledLesson:'Ausfall',event:'Ereignis'})[item.type] || String(item.type || ''),
          'Fach': String(subject), 'Lehrkraft': teachers(current), 'Raum': room(current),
          'Ursprüngliches Fach': String(original?.subjectLabel || original?.subject?.name || ''),
          'Ursprüngliche Lehrkraft': teachers(original), 'Ursprünglicher Raum': room(original),
          'Hinweis': String(item.comment || current?.comment || ''),
          'Neue Stunde': item.isNew ? 'Ja' : 'Nein'
        },
        legacyId: String(original?.lessonId || current?.lessonId || current?.substitutionId || item.event?.absenceId || ''),
        sourceId: String(current?.substitutionId || current?.lessonId || item.event?.absenceId || original?.lessonId || '')
      };
      if (!slots.has(slot)) slots.set(slot, []);
      slots.get(slot).push(row);
    }
    const previousItems = context.getModuleState?.('timetable')?.items || {};
    const items = [];
    for (const [slot, rows] of slots) {
      items.push(...identifyRows(slot, rows, previousItems));
    }
    return { scope: 'rolling', range, items };
  }
};
