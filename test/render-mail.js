const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { renderModuleMail } = require('../src/lib/module-mail');

const result = renderModuleMail({ timezone:'Europe/Berlin' }, { title:'Stundenplanänderungen' }, {
  snapshot:{ capturedAt:'2026-09-30T10:00:00+02:00' },
  events:[
    { type:'Neu', firstSeenAt:'2026-09-30T10:00:00+02:00', changedAt:'2026-09-30T10:00:00+02:00',
      currentValue:{ title:'01.10.2026 · 7. Stunde · Mathematik', details:{ Fach:'Mathematik', Lehrkraft:'Muster', Raum:'B 204', Hinweis:'Zusätzliche Stunde ab 13:15 Uhr' } } },
    { type:'Geändert', firstSeenAt:'2026-09-29T09:00:00+02:00', changedAt:'2026-09-30T10:00:00+02:00',
      previousValue:{ title:'02.10.2026 · 3. Stunde · Deutsch', details:{ Fach:'Deutsch', Lehrkraft:'Muster', Raum:'A 101' } },
      currentValue:{ title:'02.10.2026 · 3. Stunde · Deutsch', details:{ Fach:'Deutsch', Lehrkraft:'Vertretung', Raum:'C 302' } } }
  ]
});

(async () => {
  fs.mkdirSync('/out', { recursive:true });
  fs.writeFileSync('/out/mail-beispiel.html', result.html);
  const browser = await chromium.launch({ headless:true, args:['--no-sandbox'] });
  for (const [name,width,height] of [['desktop',1200,850],['mobil',360,780]]) {
    const page = await browser.newPage({ viewport:{ width,height }, deviceScaleFactor:1 });
    await page.setContent(result.html);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    await page.screenshot({ path:path.join('/out',`mail-${name}.png`), fullPage:true });
    console.log(`${name}: horizontaler_ueberlauf=${overflow}`);
    await page.close();
  }
  await browser.close();
})().catch(error => { console.error(error.message); process.exitCode=1; });
