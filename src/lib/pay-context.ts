import 'server-only';
import { w } from '@/engine/db';
import { supabaseAnon } from '@/lib/supabase/anon';
import { verifyPay } from '@/lib/paytoken';
export type PayCtx = { title: string; client: string; description: string; amount: number | null; name: string; phone: string; email: string; ref: string; closed: boolean; returnUrl?: string };
// Resolve a signed pay token to the amount and payer details. Amount always comes from the server, never from the browser.
export async function payContext(t: string): Promise<PayCtx | null> {
  const p = verifyPay(t); if (!p) return null;
  if (p.k === 'pmt') {
    const c: any = await w('office_worker_payment_context', { p_payment: p.id }).catch(() => null); if (!c) return null;
    const month = c.period_month ? new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(c.period_month)) : '';
    return { title: c.plan_title ?? 'תשלום', client: c.client_name ?? '', description: [c.plan_title, month].filter(Boolean).join(' · '), amount: c.gross == null ? null : Number(c.gross),
      name: c.contact_name ?? '', phone: c.contact_phone ?? '', email: c.contact_email ?? '', ref: `payment:${c.id}`, closed: ['paid', 'waived', 'cancelled'].includes(c.status) };
  }
  const { data: c, error } = await supabaseAnon().rpc('office_public_payment_context', { p_token: p.id }); if (error || !c) return null;
  const x: any = c;
  return { title: x.title ?? 'הצעת מחיר', client: x.company ?? '', description: x.kind === 'retainer' ? 'ריטיינר — חודש ראשון' : 'תשלום פרויקט', amount: x.gross == null ? null : Number(x.gross),
    name: x.contact_name ?? '', phone: x.phone ?? '', email: x.email ?? '', ref: `proposal:${x.id}`, closed: false, returnUrl: `/p/${p.id}` };
}
