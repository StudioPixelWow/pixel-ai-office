import { NextResponse, type NextRequest } from 'next/server';
import { get, list } from '@/lib/api';
import { launchBrowser, renderDocPdf } from '@/engine/pdf';
export const runtime = 'nodejs';
export const maxDuration = 60;
// Real PDF download of the approved proposal: headless Chromium renders the protected print view with the caller's own session (scope checks stay in the DB).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await get<any>('proposals', id).catch(() => null);
  if (!p) return NextResponse.json({ error: 'ההצעה לא נמצאה' }, { status: 404 });
  const v = (await list('proposal_versions', { proposal_id: id }).catch(() => [])).find((x: any) => x.version_no === p.current_version);
  if (v?.review_status !== 'approved') return NextResponse.json({ error: 'אפשר להוריד PDF רק אחרי שההצעה אושרה' }, { status: 400 });
  const browser = await launchBrowser();
  try {
    const origin = req.nextUrl.origin; const host = new URL(origin).hostname;
    await browser.setCookie(...req.cookies.getAll().map((c) => ({ name: c.name, value: c.value, domain: host, path: '/', secure: origin.startsWith('https'), httpOnly: true })));
    const page = await browser.newPage();
    await page.goto(`${origin}/proposals/${id}/print`, { waitUntil: 'networkidle0', timeout: 40000 });
    if (new URL(page.url()).pathname !== `/proposals/${id}/print`) throw new Error('auth');
    const pdf = await renderDocPdf(page);
    const name = `הצעת מחיר ${p.number ?? ''} ${String(p.title ?? '').replace(/^הצעת מחיר\s*[—-]\s*/, '')}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    return new NextResponse(Buffer.from(pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="proposal.pdf"; filename*=UTF-8''${encodeURIComponent(name)}.pdf`, 'cache-control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message === 'auth' ? 'נדרשת התחברות' : 'יצירת ה-PDF נכשלה, נסה שוב' }, { status: 502 });
  } finally { await browser.close().catch(() => {}); }
}
