import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { gmailConfigured, gmailSend } from '@/engine/adapters/gmail';
// Owner: send the proposal signing link by email from office@ after previewing it. One explicit click = one email.
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') && new URL(req.headers.get('origin')!).host !== req.nextUrl.host) return NextResponse.json({ error: 'csrf' }, { status: 403 });
  if (!gmailConfigured()) return NextResponse.json({ error: 'Gmail לא מחובר' }, { status: 400 });
  const sb = await supabaseServer(); const { data: m } = await sb.rpc('office_me');
  if ((m as any)?.role !== 'owner') return NextResponse.json({ error: 'רק ה-Owner שולח הצעות ללקוחות' }, { status: 403 });
  const { proposal_id, url, to } = await req.json();
  let u: URL; try { u = new URL(url); } catch { return NextResponse.json({ error: 'קישור לא תקין' }, { status: 400 }); }
  if (u.host !== req.nextUrl.host || !u.pathname.startsWith('/p/')) return NextResponse.json({ error: 'קישור לא תקין' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(to ?? ''))) return NextResponse.json({ error: 'כתובת דוא״ל לא תקינה' }, { status: 400 });
  const { data: p } = await sb.rpc('office_get', { p_entity: 'proposals', p_id: proposal_id });
  if (!p) return NextResponse.json({ error: 'ההצעה לא נמצאה' }, { status: 404 });
  const { data: vs } = await sb.rpc('office_list', { p_entity: 'proposal_versions', p_filters: { proposal_id }, p_limit: 20, p_offset: 0 });
  const v = (vs as any[] ?? []).find((x) => x.version_no === (p as any).current_version); const cl = v?.content?.client ?? {};
  const company = cl.company ?? (p as any).title; const first = String(cl.contact_name ?? '').split(' ')[0];
  const html = `<div dir="rtl" style="font-family:Assistant,Arial,sans-serif;background:#F4F8FB;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:20px;overflow:hidden">
<div style="background:#0B1320;padding:24px 28px"><img src="https://s-pixel.co.il/wp-content/uploads/2026/07/Asset-1.png" alt="Pixel Digital" style="height:34px"></div>
<div style="padding:28px;color:#0B1320;font-size:16px;line-height:1.7"><p>היי ${esc(first)},</p><p>מצורפת הצעת המחיר של Studio Pixel עבור <b>${esc(company)}</b>.</p>
<p>אפשר לעיין בהצעה, לחתום עליה דיגיטלית ולשלם — הכל בקישור אחד:</p>
<p style="text-align:center;margin:26px 0"><a href="${u.toString()}" style="background:#E8F401;color:#0B1320;font-weight:800;text-decoration:none;border-radius:999px;padding:14px 30px;display:inline-block">לצפייה וחתימה על ההצעה</a></p>
<p>לכל שאלה אני כאן,<br>טל · Studio Pixel · 052-448-8187</p></div>
<div style="background:linear-gradient(135deg,#4BE7FF,#00CFFF 45%,#0094BD);height:6px"></div></div></div>`;
  const text = `היי ${first},\nמצורפת הצעת המחיר של Studio Pixel עבור ${company}.\nלצפייה וחתימה: ${u.toString()}\n\nטל · Studio Pixel · 052-448-8187`;
  const r = await gmailSend({ to, subject: `הצעת מחיר — ${company} · Studio Pixel`, html, text });
  if (!r.ok) return NextResponse.json({ error: `שליחה נכשלה: ${r.error}` }, { status: 502 });
  await sb.rpc('office_action', { p_action: 'mark_proposal_sent', p_payload: { proposal_id } });
  return NextResponse.json({ ok: true });
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
