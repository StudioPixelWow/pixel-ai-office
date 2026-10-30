import { NextResponse, type NextRequest } from 'next/server';
import { w } from '@/engine/db';
import { guestUrl, parseSocials, toE164 } from '@/lib/loud';
// Public LOUD intake form → lead + guest file + booking, and the agents start researching right away.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({} as any));
  if (b.company_site) return NextResponse.json({ ok: true }); // honeypot
  const s = (k: string, n = 1500) => String(b[k] ?? '').trim().slice(0, n);
  const name = s('name', 120), business = s('business', 160), phone = toE164(s('phone', 30)), email = s('email', 160);
  if (!name) return NextResponse.json({ error: 'נשמח לדעת איך קוראים לך' }, { status: 400 });
  if (!phone) return NextResponse.json({ error: 'נא להזין מספר טלפון תקין' }, { status: 400 });
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'כתובת המייל לא תקינה' }, { status: 400 });
  const key_points = (Array.isArray(b.key_points) ? b.key_points : []).map((x: any) => String(x ?? '').trim().slice(0, 400)).filter(Boolean).slice(0, 3);
  if (key_points.length < 1) return NextResponse.json({ error: 'כתבו לפחות נקודת מפתח אחת לראיון' }, { status: 400 });
  let website = s('website', 300); if (website && !/^https?:\/\//.test(website)) website = `https://${website}`;
  const socials_text = s('socials', 1500);
  const payload = { name, business, phone_e164: phone, email, website, socials_text, socials: parseSocials(socials_text), what_matters: s('what_matters'),
    done_before: b.done_before === 'yes' ? 'yes' : 'no', done_before_details: s('done_before_details', 800), key_points, role: s('role', 120), preferred_times: s('preferred_times', 300),
    whatsapp_ok: b.whatsapp_ok !== false, submitted_at: new Date().toISOString(), ua: (req.headers.get('user-agent') ?? '').slice(0, 200) };
  try {
    const r: any = await w('office_worker_studio_intake', { p: payload });
    const url = guestUrl(req.nextUrl.origin, r.id);
    if (!r.duplicate) await w('office_worker_studio_set_url', { p_id: r.id, p_url: url }).catch(() => null);
    return NextResponse.json({ ok: true, url });
  } catch (e: any) { return NextResponse.json({ error: 'משהו השתבש בשליחה — נסו שוב בעוד רגע' }, { status: 500 }); }
}
