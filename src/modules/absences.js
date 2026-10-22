const { dateGerman } = require('./date');

module.exports = {
  key: 'absences',
  title: 'Fehlzeiten',
  async collect(config, session, context) {
    const term = await context.getTerm();
    const data = await context.call('classbook', 'get-history-absences-list', {
      term, student: { id: session.studentId }
    });
    if (!Array.isArray(data)) throw new Error('Fehlzeiten: unerwartete Antwortform.');
    return {
      scope: `term:${term.id}`,
      items: data.map(item => {
        if (!item.id || !item.date) throw new Error('Fehlzeit ohne ID oder Datum.');
        // Dieselbe Statusauswahl wie in der sichtbaren Schulmanager-Historie.
        const statuses = [];
        if (item.sickNote) statuses.push(({ Medical:'Attest', Form:'Entschuldigt', NotRequired:'Nicht erforderlich' })[item.sickNote.certificateType] || 'Unentschuldigt');
        if (item.exemptionRequest) statuses.push('Genehmigt');
        if (item.excused) statuses.push('Entschuldigt');
        if (!statuses.length) statuses.push('Unentschuldigt');
        const status = [...new Set(statuses)].join(', ');
        return {
          id: String(item.id), date: String(item.date).slice(0,10), title: `Fehlzeit am ${dateGerman(item.date)}`,
          details: {
            'Status': status,
            'Art': item.exemptionRequest ? (item.exemptionRequest.isInternal ? 'Intern beurlaubt' : 'Beurlaubt') : item.sickNote ? 'Krankgemeldet' : 'Fehlzeit',
            'Von': String(item.from || ''), 'Bis': String(item.until || ''),
            'Information': String(item.comment || item.exemptionRequest?.comment || '')
          }
        };
      })
    };
  }
};
