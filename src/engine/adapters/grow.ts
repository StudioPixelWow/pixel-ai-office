// Grow (Meshulam) payment links. Server-side only. userId/pageCode are issued by Grow per business; nothing is assumed.
// A link is created only for a final (VAT-resolved) amount and is recorded on the payment row; it is never sent automatically.
export const growConfigured = () => !!(process.env.GROW_USER_ID && process.env.GROW_PAGE_CODE);
const base = () => process.env.GROW_API_BASE || (process.env.GROW_ENV === 'production' ? 'https://api.grow.link/api/light/server/1.1' : 'https://sandboxapi.grow.link/api/light/server/1.1');
const clean = (s: string) => s.replace(/[^\p{L}\p{N} .,\-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

export async function growCreatePaymentLink(o: { title: string; productName: string; amount: number; fullName: string; phone?: string | null; email?: string | null; ref: string; successUrl?: string }) {
  const f = new FormData();
  f.set('userId', process.env.GROW_USER_ID!); f.set('pageCode', process.env.GROW_PAGE_CODE!);
  f.set('paymentLinkType', '1'); f.set('isActive', '1'); f.set('title', clean(o.title));
  f.set('paymentTypes[0][type]', 'payments'); f.set('paymentTypes[0][payments][paymentsPaymentNum]', '1');
  // Grow requires at least two names
  const name = clean(o.fullName); f.set('pageFieldSettings[fullName][value]', name.includes(' ') ? name : `${name} לקוח`);
  if (o.phone) f.set('pageFieldSettings[phone][value]', o.phone.replace(/^\+972/, '0').replace(/\D/g, ''));
  if (o.email) f.set('pageFieldSettings[email][value]', o.email);
  f.set('products[data][0][name]', clean(o.productName)); f.set('products[data][0][price]', String(o.amount)); f.set('products[data][0][quantity]', '1');
  f.set('products[data][0][vatType]', process.env.GROW_VAT_TYPE || '1');
  f.set('cField1', o.ref);
  if (o.successUrl) f.set('successUrl', o.successUrl);
  f.set('buttonColor', '#00CFFF');
  const headers: Record<string, string> = {}; if (process.env.GROW_API_KEY) headers['x-api-key'] = process.env.GROW_API_KEY;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${base()}/CreatePaymentLink`, { method: 'POST', body: f, headers, signal: ctrl.signal });
    const j: any = await r.json().catch(() => ({}));
    const url = j?.data?.url; if (r.ok && String(j?.status) === '1' && url) return { ok: true as const, url: String(url), ref: String(j.data.paymentLinkProcessId ?? '') };
    return { ok: false as const, error: typeof j?.err === 'object' ? j.err?.message : j?.err || `HTTP ${r.status}` };
  } catch (e: any) { return { ok: false as const, error: e?.name === 'AbortError' ? 'Grow לא הגיב בזמן' : String(e?.message ?? e) }; }
  finally { clearTimeout(t); }
}
