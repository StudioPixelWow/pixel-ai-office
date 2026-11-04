import { w } from './db';
// Headless Chromium for server-side PDFs (Vercel: @sparticuz/chromium; local override CHROME_PATH).
export async function launchBrowser() {
  const chromium = (await import('@sparticuz/chromium')).default; const puppeteer = (await import('puppeteer-core')).default;
  return puppeteer.launch({ args: chromium.args, executablePath: process.env.CHROME_PATH || await chromium.executablePath(), headless: true, defaultViewport: { width: 1240, height: 1754 } });
}
// Owner-triggered check that Chromium boots in production (kv pdf_selftest=run → done:ok:<bytes> / done:fail:<msg>).
export async function pdfSelfTest() {
  const st = await w<string | null>('office_worker_kv', { p_key: 'pdf_selftest', p_value: null, p_set: false });
  if (st !== 'run') return null;
  const set = (v: string) => w('office_worker_kv', { p_key: 'pdf_selftest', p_value: v, p_set: true });
  const t0 = Date.now(); let b: any = null;
  try {
    b = await launchBrowser(); const pg = await b.newPage();
    await pg.setContent('<html dir="rtl" lang="he"><body style="font-family:sans-serif;font-size:28px;padding:40px"><h1>הצעת מחיר — בדיקת PDF</h1><p>פיקסל דיגיטל · 1,600 ₪ לחודש</p></body></html>');
    const pdf = await pg.pdf({ format: 'A4', printBackground: true });
    await set(`done:ok:${pdf.length}:${Date.now() - t0}ms`); return { pdf: 'ok', bytes: pdf.length, ms: Date.now() - t0 };
  } catch (e: any) { await set(`done:fail:${String(e?.message ?? e).slice(0, 300)}`); return { pdf: 'fail', error: String(e?.message ?? e).slice(0, 300) }; }
  finally { if (b) await b.close().catch(() => {}); }
}
