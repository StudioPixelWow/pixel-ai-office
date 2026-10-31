import 'server-only';
import { w } from './db';
import { gmailConfigured, gmailSend } from './adapters/gmail';
// Morning summary for the owner (07:30 Israel time), from the office mailbox to the owner only.
const TZ = 'Asia/Jerusalem'; const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pixel-ai-office-iota.vercel.app';
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
const tm = (d: string) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(d));
const money = (n: number) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n);
export async function morningDigest() {
  const now = new Date(); const hm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  if (hm < '07:30' || hm > '11:00' || !gmailConfigured()) return { skipped: true };
  const d: any = await w('office_worker_digest', {}); if (!d) return { skipped: 'sent' };
  const sec = (title: string, rows: string[]) => rows.length ? `<h3 style="margin:18px 0 6px;color:#0B1320;font-size:16px">${title}</h3><ul style="margin:0;padding-inline-start:18px;color:#2A3445;line-height:1.7">${rows.map((r) => `<li>${r}</li>`).join('')}</ul>` : '';
  const counts = [d.drafts_waiting && `${d.drafts_waiting} הודעות ממתינות לאישורך`, d.loud_waiting && `${d.loud_waiting} קבצי שאלות LOUD לאישור`, d.new_leads && `${d.new_leads} לידים חדשים מאתמול`].filter(Boolean) as string[];
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;background:#F7FBFF;padding:24px"><div style="max-width:600px;margin:auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #E6EEF4">
<div style="background:#0B1320;padding:18px 24px;display:flex;align-items:center;gap:12px"><img src="https://s-pixel.co.il/wp-content/uploads/2026/07/Asset-1.png" alt="Pixel Digital" height="28" style="height:28px;width:auto;display:block;border:0"><span style="color:#fff;font-weight:bold">AI OFFICE · סיכום בוקר</span></div>
<div style="padding:22px 24px"><h2 style="margin:0;color:#0B1320">בוקר טוב טל ☀️</h2><p style="color:#5C6776;margin:6px 0 0">${esc(new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(now))}</p>
${counts.length ? `<div style="margin-top:14px;background:linear-gradient(135deg,#4BE7FF,#00CFFF 45%,#0094BD);border-radius:14px;padding:12px 16px;color:#0B1320;font-weight:bold">${counts.map(esc).join(' · ')}</div>` : ''}
${sec('📅 פגישות היום', (d.meetings ?? []).map((m: any) => `<b>${tm(m.at)}</b> · ${esc(m.title)}${m.client ? ` <span style="color:#5C6776">(${esc(m.client)})</span>` : ''}`))}
${sec('◆ אבני דרך להיום ובאיחור', (d.milestones ?? []).slice(0, 12).map((m: any) => `${m.late ? '<b style="color:#C53030">באיחור</b> · ' : ''}${esc(m.title)} · ${esc(m.client)}`))}
${sec('☐ משימות', (d.todos ?? []).map((t: any) => esc(t.title)))}
${sec('₪ תשלומים באיחור', (d.overdue_payments ?? []).map((p: any) => `${esc(p.client)} · ${money(Number(p.amount))}`))}
<p style="margin:22px 0 0"><a href="${SITE}/approvals" style="background:#E8F401;color:#0B1320;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">לכל מה שמחכה לי היום ←</a></p></div></div></div>`;
  const text = `בוקר טוב טל\n${counts.join(' · ')}\nפגישות: ${(d.meetings ?? []).map((m: any) => `${tm(m.at)} ${m.title}`).join(', ') || 'אין'}\n${SITE}/approvals`;
  const r = await gmailSend({ to: 'tal.pixeld@gmail.com', subject: `☀️ סיכום בוקר · ${(d.meetings ?? []).length} פגישות · ${(d.milestones ?? []).length} אבני דרך`, html, text });
  if (r.ok) await w('office_worker_digest_sent', { p_day: d.day });
  return { sent: r.ok };
}

// Sunday 08:00+: the week plan by email (once per week).
export async function weeklyPlan() {
  const now = new Date(); const hm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  if (hm < '08:00' || hm > '12:00' || !gmailConfigured()) return { skipped: true };
  const d: any = await w('office_worker_week', {}); if (!d) return { skipped: 'not_sunday_or_sent' };
  const li = (rows: string[]) => rows.length ? `<ul style="margin:0;padding-inline-start:18px;color:#2A3445;line-height:1.7">${rows.map((r) => `<li>${r}</li>`).join('')}</ul>` : '<p style="color:#5C6776;margin:0">—</p>';
  const h3 = (t: string) => `<h3 style="margin:18px 0 6px;color:#0B1320;font-size:16px">${t}</h3>`;
  const dd = (x: string) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric' }).format(new Date(x.length === 10 ? `${x}T12:00:00Z` : x));
  const late = [...(d.milestones ?? []).filter((m: any) => m.late), ...(d.todos ?? []).filter((t: any) => t.late)];
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;background:#F7FBFF;padding:24px"><div style="max-width:600px;margin:auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #E6EEF4">
<div style="background:#0B1320;padding:18px 24px"><img src="https://s-pixel.co.il/wp-content/uploads/2026/07/Asset-1.png" alt="Pixel Digital" height="28" style="height:28px;width:auto;display:block;border:0"></div>
<div style="padding:22px 24px"><h2 style="margin:0;color:#0B1320">שבוע טוב טל 🗓️</h2><p style="color:#5C6776;margin:6px 0 0">התוכנית לשבוע ${esc(dd(d.start))} – ${esc(dd(d.end))}</p>
<div style="margin-top:14px;background:linear-gradient(135deg,#4BE7FF,#00CFFF 45%,#0094BD);border-radius:14px;padding:12px 16px;color:#0B1320;font-weight:bold">${(d.meetings ?? []).length} פגישות · ${(d.milestones ?? []).length} אבני דרך · ${late.length} באיחור · ${(d.blockers ?? []).length} חסמים</div>
${(d.blockers ?? []).length ? h3('🔓 לשחרר השבוע') + li(d.blockers.slice(0, 10).map((b: any) => `${esc(b.title)} <span style="color:#5C6776">— ${esc(b.blocker ?? 'ממתין')}</span>`)) : ''}
${h3('🤝 פגישות')}${li((d.meetings ?? []).map((m: any) => `<b>${esc(dd(m.at))} ${tm(m.at)}</b> · ${esc(m.title)}${m.client ? ` (${esc(m.client)})` : ''}`))}
${h3('◆ אבני דרך')}${li((d.milestones ?? []).slice(0, 15).map((m: any) => `${m.late ? '<b style="color:#C53030">באיחור</b> · ' : ''}${esc(m.title)} · ${esc(m.client)}`))}
${(d.posts ?? []).length ? h3('▦ תוכן השבוע') + li(d.posts.map((p: any) => `${esc(p.client)} · ${p.total} פוסטים${p.pending ? ` · ${p.pending} ממתינים לאישורך` : ''}${p.not_ready ? ` · ${p.not_ready} לא מוכנים` : ''}`)) : ''}
${(d.payments ?? []).length ? h3('₪ תשלומים') + li(d.payments.map((p: any) => `${esc(p.client)} · ${money(Number(p.amount))} · ${esc(dd(p.due))}${p.late ? ' · באיחור' : ''}`)) : ''}
<p style="margin:22px 0 0"><a href="${SITE}/week" style="background:#E8F401;color:#0B1320;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">לתוכנית השבוע המלאה ←</a></p></div></div></div>`;
  const r = await gmailSend({ to: 'tal.pixeld@gmail.com', subject: `🗓️ תוכנית השבוע · ${(d.meetings ?? []).length} פגישות · ${late.length} באיחור`, html, text: `תוכנית השבוע: ${SITE}/week` });
  if (r.ok) await w('office_worker_week_sent', { p_week: d.week });
  return { sent: r.ok };
}
