import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 900, height: 360 } });
// Jeton inexistant : c'est justement l'écran de refus qu'on veut voir.
await p.goto('http://localhost:3120/l/jeton-inexistant', { waitUntil: 'networkidle' });
const r = await p.evaluate(() => {
  const m = document.body.firstElementChild;
  const cs = getComputedStyle(m);
  const bourre = document.createElement('div');
  bourre.style.height = '800px';
  m.append(bourre);
  const rep = document.createElement('p'); rep.id = 'r'; rep.textContent = 'BAS'; m.append(rep);
  m.scrollTo(0, 99999);
  const rect = document.getElementById('r').getBoundingClientRect();
  return {
    racine: m.className,
    overflowY: cs.overflowY,
    defile: m.scrollTop > 0,
    basAtteignable: rect.top >= 0 && rect.bottom <= window.innerHeight + 1,
  };
});
console.log('/l/<jeton invalide> :', JSON.stringify(r));
await b.close();
