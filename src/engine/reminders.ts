import 'server-only';
import { w } from './db';
import { gmailConfigured, gmailSend } from './adapters/gmail';
// Standing instruction from the owner: the day before every client/lead meeting, a reminder email goes out from the office mailbox (09:00–21:00 Israel time).
const TZ = 'Asia/Jerusalem';
const f = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('he-IL', { timeZone: TZ, ...o }).format(new Date(d));
const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
const OFFICE = 'כיכר בן גוריון 2, קרית טבעון';
export async function meetingReminders() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date()));
  if (hour < 9 || hour >= 21 || !gmailConfigured()) return { skipped: true };
  const own = [process.env.GMAIL_USER ?? '', 'tal.pixeld@gmail.com'].filter(Boolean);
  const due: any[] = await w('office_worker_meeting_reminders_due', { p_own: own });
  let sent = 0;
  for (const m of due) {
    const to: string[] = (m.to ?? []).slice(0, 10); if (!to.length) continue;
    const when = `${f(m.starts_at, { weekday: 'long', day: 'numeric', month: 'long' })} · ${f(m.starts_at, { hour: '2-digit', minute: '2-digit' })}${m.ends_at ? `–${f(m.ends_at, { hour: '2-digit', minute: '2-digit' })}` : ''}`;
    const where = m.location || OFFICE; const isLink = /^https?:\/\//.test(where);
    const subject = `תזכורת: ${m.title} · מחר ${f(m.starts_at, { hour: '2-digit', minute: '2-digit' })}`;
    const text = `שלום,\n\nתזכורת לפגישה שלנו מחר:\n${m.title}\n${when}\n${isLink ? 'קישור' : 'מיקום'}: ${where}\n\nאם משהו השתנה — אפשר להשיב למייל הזה.\n\nבברכה,\nטל זטלמן · Pixel Digital`;
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;background:#F7FBFF;padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #E6EEF4">
<div style="background:#0B1320;padding:20px 24px"><img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-white-500.webp" alt="Pixel Digital" style="height:30px"></div>
<div style="padding:24px"><p style="margin:0 0 6px;color:#5C6776">שלום,</p><h2 style="margin:0 0 14px;color:#0B1320">תזכורת לפגישה שלנו מחר</h2>
<div style="background:linear-gradient(135deg,#4BE7FF,#00CFFF 45%,#0094BD);border-radius:16px;padding:16px 18px;color:#0B1320"><b style="font-size:18px">${esc(m.title)}</b><br>${esc(when)}<br>${isLink ? `<a href="${esc(where)}" style="color:#0B1320;font-weight:bold">לקישור לפגישה</a>` : `📍 ${esc(where)}`}</div>
<p style="color:#2A3445;margin:16px 0 0">אם משהו השתנה — אפשר פשוט להשיב למייל הזה.</p><p style="color:#2A3445;margin:16px 0 0">בברכה,<br><b>טל זטלמן</b> · Pixel Digital</p></div></div></div>`;
    const r = await gmailSend({ to: to.join(','), subject, html, text });
    if (r.ok) { await w('office_worker_meeting_reminded', { p_id: m.id, p_to: to }); sent++; }
  }
  return { due: due.length, sent };
}
