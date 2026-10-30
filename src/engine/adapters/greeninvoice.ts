// Green Invoice (Morning) — tax invoice/receipt documents. Server-side only; credentials from env (never from chat/repo).
export const greenInvoiceConfigured = () => !!(process.env.GREEN_INVOICE_API_ID && process.env.GREEN_INVOICE_API_SECRET);
const base = () => process.env.GREEN_INVOICE_ENV === 'sandbox' ? 'https://sandbox.d.greeninvoice.co.il/api/v1' : 'https://api.greeninvoice.co.il/api/v1';
let cached: { token: string; exp: number } | null = null;

// Morning (2026): API keys authenticate via OAuth client-credentials on the new identity host; the documents API stays on api.greeninvoice.co.il.
const idp = () => process.env.GREEN_INVOICE_ENV === 'sandbox' ? 'https://api.sandbox.morning.dev' : 'https://api.morning.co';
const REASON: Record<string, string> = { invalid_client: 'מזהה או סוד שגויים', invalid_grant: 'המפתח פג, בוטל או ממתין לאישור', unauthorized_client: 'המסלול לא כולל גישת API' };
export async function giToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const id = (process.env.GREEN_INVOICE_API_ID ?? '').trim(); const secret = (process.env.GREEN_INVOICE_API_SECRET ?? '').trim();
  const r = await fetch(`${idp()}/idp/v1/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret }), signal: AbortSignal.timeout(15000) });
  const j: any = await r.json().catch(() => ({}));
  if (r.ok && j.accessToken) { cached = { token: j.accessToken, exp: Math.min((j.expiresAt ?? 0) * 1000 || Date.now() + 50 * 60_000, Date.now() + 50 * 60_000) }; return j.accessToken; }
  // legacy keys (pre-2026) still use /account/token
  const l = await fetch(`${base()}/account/token`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ id, secret }) });
  const lj: any = await l.json().catch(() => ({}));
  if (l.ok && lj.token) { cached = { token: lj.token, exp: lj.expires ? lj.expires * 1000 : Date.now() + 50 * 60_000 }; return lj.token; }
  const e: any = new Error(`Morning: HTTP ${r.status}${j?.error ? ` · ${REASON[j.error] ?? j.error}` : ''}${j?.error_description ? ` · ${String(j.error_description).slice(0, 120)}` : ''}`); e.status = r.status; throw e;
}
export async function giCheck() { try { await giToken(); return { ok: true as const }; } catch (e: any) { return { ok: false as const, status: e.status ?? 0, error: e.message }; } }

// Payment type codes per Green Invoice: 1 cash, 2 check, 3 credit card, 4 bank transfer, 10 payment app, 11 other
const PAY: Record<string, number> = { cash: 1, check: 2, credit: 3, transfer: 4, bit: 10, other: 11 };
// Income VAT type: 0 = price before VAT (VAT added per business settings), 1 = price includes VAT, 2 = exempt
const VAT: Record<string, number> = { plus_vat: 0, included: 1, exempt: 2 };

export async function giCreateInvoiceReceipt(o: { clientName: string; email?: string | null; phone?: string | null; description: string; netOrGrossAmount: number; vatMode: string; paidAmount: number; paidAt: string; method: string; remarks?: string }) {
  const token = await giToken();
  const body = {
    type: 320, lang: 'he', currency: 'ILS', signed: true, rounding: false, description: o.description, remarks: o.remarks,
    client: { name: o.clientName, emails: o.email ? [o.email] : undefined, phone: o.phone ?? undefined, add: true },
    income: [{ description: o.description, quantity: 1, price: o.netOrGrossAmount, currency: 'ILS', vatType: VAT[o.vatMode] ?? 0 }],
    payment: [{ type: PAY[o.method] ?? 11, price: o.paidAmount, currency: 'ILS', date: o.paidAt }],
  };
  const r = await fetch(`${base()}/documents`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) return { ok: false as const, error: j?.errorMessage || `HTTP ${r.status}` };
  return { ok: true as const, id: String(j.id), number: j.number != null ? String(j.number) : null, url: j.url?.he ?? j.url?.origin ?? null };
}

// Document types (Green Invoice / Morning): 305 tax invoice, 320 tax invoice-receipt, 400 receipt, 330 credit invoice
export const DOC_HE: Record<number, string> = { 305: 'חשבונית מס', 320: 'חשבונית מס קבלה', 400: 'קבלה', 330: 'חשבונית זיכוי' };
export async function giCreateDocument(o: { type: 305 | 320 | 400; clientName: string; email?: string | null; phone?: string | null; description: string;
  amount: number; vatMode: string; paid?: { amount: number; date: string; method: string; reference?: string | null } | null; linkedDocIds?: string[]; remarks?: string }) {
  const token = await giToken();
  const payType = o.paid ? (PAY[o.paid.method] ?? 11) : 11;
  const payment = o.paid ? [{ type: payType, price: o.paid.amount, currency: 'ILS', date: o.paid.date }] : undefined;
  const remarks = [o.remarks, o.paid?.reference ? `אסמכתא: ${o.paid.reference}` : ''].filter(Boolean).join(' · ') || undefined;
  const body: any = { type: o.type, lang: 'he', currency: 'ILS', signed: true, rounding: false, description: o.description, remarks,
    client: { name: o.clientName, emails: o.email ? [o.email] : undefined, phone: o.phone ?? undefined, add: true } };
  if (o.type !== 400) body.income = [{ description: o.description, quantity: 1, price: o.amount, currency: 'ILS', vatType: VAT[o.vatMode] ?? 0 }];
  if (o.type !== 305) body.payment = payment;
  if (o.linkedDocIds?.length) body.linkedDocumentIds = o.linkedDocIds;
  const r = await fetch(`${base()}/documents`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) return { ok: false as const, error: j?.errorMessage || `HTTP ${r.status}` };
  return { ok: true as const, id: String(j.id), number: j.number != null ? String(j.number) : null, url: j.url?.he ?? j.url?.origin ?? null };
}
export const giEnv = () => process.env.GREEN_INVOICE_ENV === 'sandbox' ? 'sandbox' : 'production';
