const { dateGerman } = require('./date');

module.exports = {
  key: 'history',
  title: 'Historie',
  async collect(config, session, context) {
    const range = context.range();
    const data = await context.call('classbook', 'get-history-by-time', {
      from: range.start, until: range.end, student: { id: session.studentId }
    });
    const classHours = await context.getClassHours();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Historie: unerwartete Antwortform.');
    const hourNames = new Map(classHours.map(hour => [String(hour.id), String(hour.number || hour.id)]));
    const items = [];
    for (const [date, hours] of Object.entries(data)) {
      for (const [hourId, value] of Object.entries(hours || {})) {
        items.push({
          id: `${date}:${hourId}`, date, title: `${dateGerman(date)} · ${hourNames.get(hourId) || hourId}. Stunde`,
          details: {
            'Stunde': hourNames.get(hourId) || hourId,
            'Fehlende Minuten': String(value.absentMinutes ?? ''),
            'Vollständig abwesend': value.fullyAbsent ? 'Ja' : 'Nein',
            'Information': Array.isArray(value.comments) ? value.comments.join('\n') : ''
          }
        });
      }
    }
    return { scope: 'rolling', range, items };
  }
};
