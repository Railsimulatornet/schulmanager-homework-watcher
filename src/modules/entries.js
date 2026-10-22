const { createHash } = require('crypto');

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
}

module.exports = {
  key: 'entries',
  title: 'Einträge',
  async collect(config, session, context) {
    const term = await context.getTerm();
    const groups = await context.call('classbook', 'get-entry-statistics', {
      student: { id: session.studentId }, termId: term.id
    });
    if (!Array.isArray(groups)) throw new Error('Einträge: unerwartete Antwortform.');
    const rows = [];
    for (const group of groups) {
      for (const entry of group.entries || []) {
        const subjectId = entry.taughtLesson?.subjectId || entry.taughtLesson?.subject?.id || null;
        const subject = entry.taughtLesson?.subject?.name || entry.taughtLesson?.subject?.abbreviation || '';
        const teacher = entry.teacher?.abbreviation || [entry.teacher?.firstname, entry.teacher?.lastname].filter(Boolean).join(' ');
        const date = String(entry.date || '').slice(0, 10);
        if (!date) throw new Error('Eintrag ohne Datum.');
        rows.push({ date, title: `${group.name || 'Eintrag'} · ${subject || 'ohne Fach'}`, details: {
          'Typ': String(group.name || ''), 'Fach': String(subject), 'Lehrkraft': String(teacher || ''), 'Text': String(entry.text || '')
        }, base: [date, group.id, subjectId, teacher || ''] });
      }
    }
    const seen = new Map();
    rows.sort((a,b) => JSON.stringify(a.base).localeCompare(JSON.stringify(b.base)) || a.details.Text.localeCompare(b.details.Text));
    return {
      scope: `term:${term.id}`,
      items: rows.map(row => {
        const base = stableHash(row.base);
        const n = seen.get(base) || 0;
        seen.set(base, n + 1);
        return { id: `${base}:${n}`, date: row.date, title: row.title, details: row.details };
      })
    };
  }
};
