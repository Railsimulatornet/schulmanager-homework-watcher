const { dateGerman } = require('./date');

module.exports = {
  key: 'exams',
  title: 'Klassenarbeiten',
  async collect(config, session, context) {
    const term = await context.getTerm();
    const data = await context.call('exams', 'get-exams', {
      student: { id: session.studentId }, start: term.start, end: term.end
    });
    if (!Array.isArray(data)) throw new Error('Klassenarbeiten: unerwartete Antwortform.');
    return {
      scope: `term:${term.id}`,
      items: data.map(item => {
        if (!item.id || !item.date) throw new Error('Klassenarbeit ohne ID oder Datum.');
        const subject = item.subjectText || item.subject?.name || item.subject?.abbreviation || '';
        return {
          id: String(item.id), date: String(item.date).slice(0,10), title: `${subject || 'Klassenarbeit'} · ${dateGerman(item.date)}`,
          details: {
            'Fach': String(subject), 'Art': String(item.type?.name || ''),
            'Beginn': String(item.startClassHour?.number || ''), 'Ende': String(item.endClassHour?.number || ''),
            'Hinweis': String(item.comment || '')
          }
        };
      })
    };
  }
};
