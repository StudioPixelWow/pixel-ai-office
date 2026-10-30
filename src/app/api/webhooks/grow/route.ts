import { NextResponse, type NextRequest } from 'next/server';
import { w } from '@/engine/db';
import { verifyPay } from '@/lib/paytoken';
import { growApprove } from '@/engine/adapters/grow';
// Grow server-to-server notification. Trust comes from our own signed ref in the notify URL (set when the session was opened),
// so a forged POST cannot mark anything paid. Idempotent per transaction id.
function flatten(input: Record<string, any>) {
  const out: Record<string, string> = {}; const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === 'data' && v && typeof v === 'object') { for (const [a, b] of Object.entries(v)) if (typeof b !== 'object') data[a] = String(b); else if (a === 'customFields') for (const [c, d] of Object.entries(b as any)) data[c] = String(d); }
    else { const m = k.match(/^data\[([^\]]+)\](?:\[([^\]]+)\])?$/); if (m) data[m[2] ?? m[1]] = String(v); else out[k] = String(v); }
  }
  return { top: out, data };
}
export async function POST(req: NextRequest) {
  const signed = verifyPay(req.nextUrl.searchParams.get('r') ?? '');
  if (!signed) return NextResponse.json({ ok: false }, { status: 403 });
  const ct = req.headers.get('content-type') ?? ''; let raw: Record<string, any> = {};
  if (ct.includes('json')) raw = await req.json().catch(() => ({}));
  else { const fd = await req.formData().catch(() => null); if (fd) for (const [k, v] of fd.entries()) raw[k] = String(v); }
  const { top, data } = flatten(raw);
  const ok = String(top.status ?? raw.status ?? '1') === '1';
  const txn = data.transactionId ?? data.asmachta ?? data.processId;
  if (!ok || !txn) return NextResponse.json({ ok: true, ignored: true });
  const ref = signed.id; // e.g. payment:<uuid> or proposal:<uuid>
  if (data.cField1 && data.cField1 !== ref) return NextResponse.json({ ok: false }, { status: 409 });
  const amount = Number(data.sum ?? data.paymentSum ?? 0) || null;
  const method = /bit/i.test(data.paymentType ?? data.transactionTypeId ?? '') ? 'bit' : 'credit';
  const safe = Object.fromEntries(Object.entries(data).filter(([k]) => !/card(Num|Exp)|token/i.test(k)));
  const r = await w('office_worker_payment_paid', { p_ref: ref, p_amount: amount, p_provider_ref: String(txn), p_method: method, p_raw: { ...safe, status: top.status } }).catch((e) => ({ ok: false, error: e.message }));
  const ap = await growApprove(data).catch((e) => ({ ok: false, body: String(e) }));
  return NextResponse.json({ ok: true, recorded: r, approved: ap.ok });
}
