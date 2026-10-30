import { headers } from 'next/headers';
import { w } from '@/engine/db';
import { payUrl } from '@/lib/paytoken';
import { resolvePortal } from '@/lib/portal';
import { Portal } from './portal';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'הפורטל שלך · Pixel Digital', robots: { index: false, follow: false } };

export default async function PortalPage({ params }: { params: Promise<{ t: string }> }) {
  const { t } = await params; const p = await resolvePortal(t);
  const [data, extra]: any[] = p ? await Promise.all([w('office_worker_portal', { p_client: p.client, p_rev: p.rev }).catch(() => null), w('office_worker_portal_extra', { p_client: p.client, p_rev: p.rev }).catch(() => ({}))]) : [null, null];
  if (!data) return <main className="pt pt-off"><div className="pt-card"><img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-white-500.webp" alt="Pixel Digital" className="pt-logo" />
    <h1>הקישור אינו בתוקף</h1><p>ייתכן שהוחלף בקישור חדש. אפשר לבקש מאיתנו קישור עדכני.</p></div></main>;
  const h = await headers(); const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  const pays = (data.payments ?? []).map((x: any) => ({ ...x, url: ['scheduled', 'link_created', 'partial'].includes(x.status) ? payUrl(origin, { k: 'pmt', id: x.id }) : null }));
  return <Portal t={t} d={{ ...data, ...(extra ?? {}), payments: pays }} />;
}
