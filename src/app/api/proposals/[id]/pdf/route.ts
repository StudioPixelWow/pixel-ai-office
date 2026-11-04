import { NextResponse, type NextRequest } from 'next/server';
import { get, list } from '@/lib/api';
import { launchBrowser, renderDocPdf } from '@/engine/pdf';
import { proposalHtml } from '@/engine/proposal-html';
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
    const items = await list('proposal_items', { proposal_version_id: v.id }).catch(() => []);
    const html = await proposalHtml({ title: p.title, number: p.number, created_at: v.created_at, content: v.content ?? {}, price: v.price_snapshot ?? {}, totals: v.totals ?? {},
      items: (items as any[]).filter((i) => i.unit_price !== null).map((i) => ({ title: i.title, description: i.description, price: Number(i.unit_price) })) });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    const pdf = await renderDocPdf(page);
    const name = `הצעת מחיר ${p.number ?? ''} ${String(p.title ?? '').replace(/^הצעת מחיר\s*[—-]\s*/, '')}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    return new NextResponse(Buffer.from(pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="proposal.pdf"; filename*=UTF-8''${encodeURIComponent(name)}.pdf`, 'cache-control': 'no-store' } });
  } catch (e: any) {
    console.error('[proposal-pdf]', id, String(e?.message ?? e).slice(0, 300));
    return NextResponse.json({ error: 'יצירת ה-PDF נכשלה, נסה שוב' }, { status: 502 });
  } finally { await browser.close().catch(() => {}); }
}
