// Green Invoice (Morning) — tax invoice/receipt documents. Server-side only; credentials from env (never from chat/repo).
export const greenInvoiceConfigured = () => !!(process.env.GREEN_INVOICE_API_ID && process.env.GREEN_INVOICE_API_SECRET);
const base = () => process.env.GREEN_INVOICE_ENV === 'sandbox' ? 'https://sandbox.d.greeninvoice.co.il/api/v1' : 'https://api.greeninvoice.co.il/api/v1';
let cached: { token: string; exp: number } | null = null;

export async function giToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const r = await fetch(`${base()}/account/token`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ id: (process.env.GREEN_INVOICE_API_ID ?? '').trim(), secret: (process.env.GREEN_INVOICE_API_SECRET ?? '').trim() }) });
  const raw = await r.text(); let j: any = {}; try { j = JSON.parse(raw); } catch { j = { _raw: raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) }; }
  if (!r.ok || !j.token) { const idv = (process.env.GREEN_INVOICE_API_ID ?? '').trim();
    const shape = `מזהה: ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idv) ? 'בפורמט UUID' : `לא בפורמט UUID (${idv.length} תווים)`} · סוד: ${(process.env.GREEN_INVOICE_API_SECRET ?? '').trim().length} תווים`;
    const detail0 = j?._raw ? `תשובה: ${j._raw}` : `תשובה: ${JSON.stringify(j).slice(0, 200)}`; const detail = j?.errorMessage || j?.message || j?.error || (j?.errorCode ? `errorCode ${j.errorCode}` : ''); const e: any = new Error(`HTTP ${r.status}${detail ? ` · ${detail}` : ''}${detail0 ? ` · ${detail0}` : ''} · ${shape}`); e.status = r.status; throw e; }
  cached = { token: j.token, exp: (j.expires ? j.expires * 1000 : Date.now() + 50 * 60_000) }; return j.token;
}
export async function giCheck() { try { await giToken(); return { ok: true as const }; } catch (e: any) {
  // control probe with a dummy key: tells "the key is rejected" apart from "the endpoint isn't reachable from here"
  let probe = '';
  try { const r = await fetch(`${base()}/account/token`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000000', secret: 'x'.repeat(32) }) });
    probe = ` · בדיקת ביקורת (מפתח דמה): HTTP ${r.status} ${(await r.text()).slice(0, 120)}`; } catch (x: any) { probe = ` · בדיקת ביקורת נכשלה: ${x.message}`; }
  return { ok: false as const, status: e.status ?? 0, error: e.message + probe }; } }

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
