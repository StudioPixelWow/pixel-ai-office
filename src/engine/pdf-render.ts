import { PDFDocument } from 'pdf-lib';
// Headless Chromium for server-side PDFs (Vercel: @sparticuz/chromium; local override CHROME_PATH).
export async function launchBrowser() {
  const chromium = (await import('@sparticuz/chromium')).default; const puppeteer = (await import('puppeteer-core')).default;
  return puppeteer.launch({ args: chromium.args, executablePath: process.env.CHROME_PATH || await chromium.executablePath(), headless: true, defaultViewport: { width: 1240, height: 1754 } });
}
// 1:1 export of the branded proposal: screen styles (not print), only the document itself, each A4 sheet as its own PDF page
// at its real on-screen size — no browser header/footer, no app chrome, no extra page breaks inside a sheet.
export async function renderDocPdf(page: any): Promise<Uint8Array> {
  await page.emulateMediaType('screen');
  const n: number = await page.evaluate(async () => {
    await (document as any).fonts.ready;
    const doc = document.querySelector('.pq') as HTMLElement | null; if (!doc) return 0;
    const st = document.createElement('style');
    st.textContent = 'html,body{margin:0!important;padding:0!important;background:#fff!important}body>*:not(.pq-export){display:none!important}.pq-export{display:block!important}.pq-export .pq{display:block!important;gap:0!important}.pq-export .pq-page{box-shadow:none!important;border-radius:0!important;margin:0!important}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}';
    document.head.appendChild(st);
    // the sheet is 210mm (~794px) wide; drop the small-screen rules so the PDF keeps the desktop layout the doc is designed in
    for (const sh of Array.from(document.styleSheets)) { let rules: CSSRuleList; try { rules = sh.cssRules; } catch { continue; }
      for (let k = rules.length - 1; k >= 0; k--) { const r = rules[k] as CSSMediaRule; if (r instanceof CSSMediaRule && /max-width/.test(r.conditionText ?? r.media.mediaText)) sh.deleteRule(k); } }
    const wrap = document.createElement('div'); wrap.className = 'pq-export'; wrap.appendChild(doc); document.body.appendChild(wrap);
    await Promise.all(Array.from(wrap.querySelectorAll('img')).map((im: any) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })));
    return wrap.querySelectorAll('.pq-page').length;
  });
  if (!n) { // older proposals without the branded document: plain A4 of the print view
    await page.emulateMediaType('print');
    return page.pdf({ format: 'A4', printBackground: true, displayHeaderFooter: false, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  }
  const out = await PDFDocument.create();
  for (let i = 0; i < n; i++) {
    const box: { w: number; h: number } = await page.evaluate((k: number) => {
      const pages = Array.from(document.querySelectorAll('.pq-export .pq-page')) as HTMLElement[];
      pages.forEach((p, j) => { p.style.display = j === k ? '' : 'none'; });
      const r = pages[k].getBoundingClientRect(); return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
    }, i);
    const one = await page.pdf({ width: `${box.w}px`, height: `${box.h}px`, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, displayHeaderFooter: false, pageRanges: '1' });
    const src = await PDFDocument.load(one); const [pg] = await out.copyPages(src, [0]); out.addPage(pg);
  }
  return out.save();
}
