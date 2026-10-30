// Grow (Meshulam) payment pages via createPaymentProcess (Light API). Server-side only.
// userId/pageCode are issued by Grow per business. GROW_ENV=production switches to the live host; anything else is the sandbox,
// where no real money moves. A link is created only for a final (VAT-resolved) amount and is never sent automatically.
export const growConfigured = () => !!(process.env.GROW_USER_ID && process.env.GROW_PAGE_CODE);
export const growIsSandbox = () => process.env.GROW_ENV !== 'production';
const base = () => process.env.GROW_API_BASE || (growIsSandbox() ? 'https://sandbox.meshulam.co.il/api/light/server/1.0' : 'https://secure.meshulam.co.il/api/light/server/1.0');
const clean = (s: string) => s.replace(/[^\p{L}\p{N} .,\-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
const site = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://pixel-ai-office-iota.vercel.app').replace(/\/$/, '');
export const toLocalMobile = (p?: string | null) => { const d = (p ?? '').replace(/^\+972/, '0').replace(/\D/g, ''); return /^05\d{8}$/.test(d) ? d : null; };

export async function growCreatePaymentLink(o: { title: string; productName: string; amount: number; fullName: string; phone?: string | null; email?: string | null; ref: string; successUrl?: string; cancelUrl?: string }) {
  const phone = toLocalMobile(o.phone);
  if (!phone) return { ok: false as const, error: 'Grow דורש טלפון נייד ישראלי תקין (05XXXXXXXX) של המשלם' };
  const f = new FormData();
  f.set('userId', process.env.GROW_USER_ID!.trim()); f.set('pageCode', process.env.GROW_PAGE_CODE!.trim());
  f.set('sum', Number(o.amount).toFixed(2)); f.set('chargeType', '1');
  f.set('description', clean(`${o.title} ${o.productName}`));
  const name = clean(o.fullName); f.set('pageField[fullName]', name.includes(' ') ? name : `${name} לקוח`);
  f.set('pageField[phone]', phone);
  if (o.email) f.set('pageField[email]', o.email);
  f.set('successUrl', o.successUrl || `${site()}/pay/thanks`); f.set('cancelUrl', o.cancelUrl || `${site()}/pay/thanks?cancel=1`);
  f.set('cField1', o.ref);
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${base()}/createPaymentProcess`, { method: 'POST', body: f, signal: ctrl.signal });
    const j: any = await r.json().catch(() => ({}));
    const url = j?.data?.url;
    if (r.ok && String(j?.status) === '1' && url) return { ok: true as const, url: String(url), ref: String(j.data.processId ?? ''), sandbox: growIsSandbox() };
    const err = typeof j?.err === 'object' ? (j.err?.message ?? JSON.stringify(j.err)) : j?.err;
    return { ok: false as const, error: err || `HTTP ${r.status} · ${JSON.stringify(j).slice(0, 220)}` };
  } catch (e: any) { return { ok: false as const, error: e?.name === 'AbortError' ? 'Grow לא הגיב בזמן' : String(e?.message ?? e) }; }
  finally { clearTimeout(t); }
}

// Live check: create a 1₪ process in the configured environment (sandbox by default). Nothing is charged unless a payer completes it.
export async function growCheck() {
  const r = await growCreatePaymentLink({ title: 'בדיקת חיבור', productName: 'PIXEL AI OFFICE', amount: 1, fullName: 'בדיקה מערכת', phone: '0500000000', ref: 'connection-check' });
  return r.ok ? { ok: true as const, sandbox: growIsSandbox() } : { ok: false as const, error: r.error };
}
