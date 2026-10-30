import { NextResponse, type NextRequest } from 'next/server';
import { payContext } from '@/lib/pay-context';
import { signPay } from '@/lib/paytoken';
import { growConfigured, growCreatePaymentLink, growIsSandbox, toLocalMobile } from '@/engine/adapters/grow';
// Payer clicked "pay": open a fresh Grow session (wallet authCode or hosted URL). Amount is taken from the server only.
export async function POST(req: NextRequest) {
  const { t, name, phone, email } = await req.json().catch(() => ({}));
  const c = await payContext(String(t ?? '')); if (!c) return NextResponse.json({ error: 'הקישור אינו בתוקף' }, { status: 400 });
  if (c.closed) return NextResponse.json({ error: 'התשלום הזה כבר הוסדר' }, { status: 400 });
  if (c.amount == null) return NextResponse.json({ error: 'סכום התשלום טרם הוגדר — ניצור איתך קשר' }, { status: 400 });
  if (!growConfigured()) return NextResponse.json({ error: 'התשלום המקוון אינו זמין כרגע' }, { status: 400 });
  const full = String(name ?? '').trim(); if (full.split(/\s+/).length < 2) return NextResponse.json({ error: 'נא להזין שם פרטי ושם משפחה' }, { status: 400 });
  if (!toLocalMobile(phone)) return NextResponse.json({ error: 'נא להזין טלפון נייד תקין (05XXXXXXXX)' }, { status: 400 });
  const origin = req.nextUrl.origin;
  const r = await growCreatePaymentLink({ title: c.client, productName: c.description, amount: c.amount, fullName: full, phone, email: email || c.email, ref: c.ref,
    successUrl: `${origin}/pay/thanks`, cancelUrl: `${origin}/pay/thanks?cancel=1`,
    notifyUrl: `${origin}/api/webhooks/grow?r=${encodeURIComponent(signPay({ k: 'pmt', id: c.ref }))}` });
  if (!r.ok) return NextResponse.json({ error: `לא ניתן לפתוח תשלום כרגע (${r.error})` }, { status: 502 });
  return NextResponse.json({ authCode: r.authCode, url: r.url, env: growIsSandbox() ? 'DEV' : 'PRODUCTION' });
}
