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
<div style="background:#0B1320;padding:18px 24px;display:flex;align-items:center;gap:12px"><img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-white-500.webp" alt="Pixel Digital" style="height:28px"><span style="color:#fff;font-weight:bold">AI OFFICE · סיכום בוקר</span></div>
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
