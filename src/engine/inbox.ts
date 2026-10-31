import 'server-only';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { w } from './db';
import { claude, anthropicConfigured } from './adapters/anthropic';
import { extractJson } from './schemas';
import { tokenCost } from './pricing';
import { gmailConfigured } from './adapters/gmail';

// איריס — inbox agent. READ-ONLY on the office mailbox (BODY.PEEK: nothing is marked read, moved, answered or deleted).
// Only mail that arrives after the agent was switched on is processed. Each actionable email → a follow-up task for the right client.
const MODEL = process.env.INBOX_MODEL ?? 'claude-haiku-5-5';
const MAX_PER_TICK = 25;
const NOISE_FROM = /(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?@|notify@|bounce|newsletter|news@|marketing@|info@mail\.|updates?@)/i;
const NOISE_DOMAINS = /(facebookmail\.com|google\.com|googlemail\.com|youtube\.com|linkedin\.com|vercel\.com|github\.com|supabase\.(io|com)|stripe\.com|paypal\.com|apple\.com|microsoft\.com|wix\.com|canva\.com|meta\.com|instagram\.com|tiktok\.com|calendly\.com|zoom\.us|greeninvoice\.co\.il|morning\.co|mailchimp|sendgrid|hubspot|monday\.com|wordpress\.com|elementor\.com|openai\.com|anthropic\.com)$/i;

type Cls = { kind: string; actionable: boolean; action: string; summary: string; due: string; priority: 'low' | 'normal' | 'high'; client_guess: string | null; confidence: number; new_lead: boolean };

export type Account = { user: string; pass: string };
// office@ (GMAIL_USER) + an optional second mailbox (MAIL2_USER / MAIL2_APP_PASSWORD, set by the owner in Vercel)
export function mailAccounts(): Account[] {
  const a: Account[] = [];
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) a.push({ user: process.env.GMAIL_USER.toLowerCase(), pass: process.env.GMAIL_APP_PASSWORD });
  if (process.env.MAIL2_USER && process.env.MAIL2_APP_PASSWORD) a.push({ user: process.env.MAIL2_USER.toLowerCase(), pass: process.env.MAIL2_APP_PASSWORD });
  return a;
}
export function accountFor(mailbox: string) { return mailAccounts().find((a) => a.user === String(mailbox).toLowerCase()) ?? null; }

export async function inboxTick() {
  if (!gmailConfigured() || !anthropicConfigured()) return { skipped: 'not_configured' };
  const res: Record<string, any> = {};
  for (const acc of mailAccounts()) { try { res[acc.user] = await tickOne(acc); } catch (e: any) { res[acc.user] = { error: String(e?.message ?? e).slice(0, 200) }; } }
  return res;
}

async function tickOne(acc: Account) {
  const me = acc.user;
  const st: any = await w('office_worker_inbox_state', { p_op: 'get', p_mailbox: me, p_uid: null, p_validity: null });
  const cli = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: acc.user, pass: acc.pass }, logger: false });
  const out = { new: 0, tasks: 0, info: 0, skipped: 0, needs_match: 0, errors: [] as string[] };
  await cli.connect(); const lock = await cli.getMailboxLock('INBOX');
  try {
    const mb: any = cli.mailbox; const validity = Number(mb.uidValidity); const next = Number(mb.uidNext);
    // first run (or mailbox reset): start from NOW — never read backwards
    if (!st?.last_uid || Number(st.uidvalidity) !== validity) {
      await w('office_worker_inbox_state', { p_op: 'set', p_mailbox: me, p_uid: next - 1, p_validity: validity });
      return { initialized: true, from_uid: next };
    }
    const from = Number(st.last_uid) + 1; if (from >= next) return out;
    let last = Number(st.last_uid); let n = 0;
    for await (const msg of cli.fetch(`${from}:*`, { uid: true, envelope: true, threadId: true, internalDate: true, source: { start: 0, maxLength: 400_000 } } as any, { uid: true })) {
      if (Number(msg.uid) <= last) continue; if (n++ >= MAX_PER_TICK) break; last = Number(msg.uid);
      try { const r = await handle(msg, me); (out as any)[r] = ((out as any)[r] ?? 0) + 1; out.new++; }
      catch (e: any) { console.error('[inbox] uid', msg.uid, e?.stack ?? e); out.errors.push(String(e?.message ?? e).slice(0, 160)); }
    }
    await w('office_worker_inbox_state', { p_op: 'set', p_mailbox: me, p_uid: last, p_validity: validity });
  } finally { lock.release(); await cli.logout().catch(() => null); }
  return out;
}

async function handle(msg: any, me: string): Promise<string> {
  const env = msg.envelope ?? {}; const fromA = env.from?.[0] ?? {}; const fromEmail = String(fromA.address ?? '').toLowerCase(); const fromName = fromA.name ?? '';
  const messageId = env.messageId ?? `uid-${msg.uid}`; const thread = msg.threadId ? String(msg.threadId) : null; const subject = env.subject ?? '';
  const base = { message_id: messageId, thread_id: thread, uid: msg.uid, from_email: fromEmail, from_name: fromName, subject, received_at: (msg.internalDate ?? env.date ?? new Date()).toISOString?.() ?? null, mailbox: me };
  const parsed = await simpleParser(msg.source).catch(() => null as any);
  const h = parsed?.headers; const text = String(parsed?.text ?? '').replace(/\n{3,}/g, '\n\n').trim();
  const snippet = stripQuoted(text).slice(0, 1500);
  const addr = (x: any) => (x?.value ?? []).map((a: any) => a.name ? `${a.name} <${a.address}>` : a.address).join(', ');
  const full = { to_list: addr(parsed?.to), cc_list: addr(parsed?.cc), body_text: text.slice(0, 80000), in_reply_to: parsed?.inReplyTo ?? null,
    refs: Array.isArray(parsed?.references) ? parsed.references.join(' ') : parsed?.references ?? null,
    attachments: (parsed?.attachments ?? []).filter((a: any) => a.contentDisposition !== 'inline').map((a: any) => ({ name: a.filename, type: a.contentType, size: a.size })).slice(0, 20) };
  // free filters — no AI spend on noise
  const dom = fromEmail.split('@')[1] ?? '';
  const own = mailAccounts().map((a) => a.user);
  const noise = !fromEmail || own.includes(fromEmail) || NOISE_FROM.test(fromEmail) || NOISE_DOMAINS.test(dom) || h?.has('list-unsubscribe') || h?.has('list-id')
    || /bulk|list|junk/i.test(String(h?.get('precedence') ?? '')) || (h?.has('auto-submitted') && String(h.get('auto-submitted')) !== 'no')
    || /^(invitation|updated invitation|הזמנה|הזמנה מעודכנת|accepted|declined)[:：]/i.test(subject) || (parsed?.attachments ?? []).some((a: any) => /calendar/.test(a.contentType ?? ''));
  if (noise) { await w('office_worker_inbox_save', { p_mail: { ...base, ...full, snippet: snippet.slice(0, 300), status: 'skipped', classification: { kind: 'noise' } } }); return 'skipped'; }

  const match: any = await w('office_worker_inbox_match', { p_email: fromEmail });
  const list: { id: string; name: string; site?: string }[] = match.clients ?? [];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const system = `את/ה איריס, סוכנת הדואר הנכנס של משרד הפרסום Pixel Digital. קוראת מייל אחד ומחליטה אם הוא דורש פעולה מהמשרד.
החזר/י JSON בלבד:
{"kind":"request|approval|feedback|complaint|payment|meeting|lead|info","actionable":true/false,"action":"משימת מעקב קצרה בציווי בעברית (עד 10 מילים), למשל 'לשלוח לפסגות את ההצעה המעודכנת'","summary":"1–2 משפטים מה ביקשו/מה קרה","due":"YYYY-MM-DD אם צוין או משתמע (היום ${today}), אחרת ריק","priority":"low|normal|high","client_guess":"id של לקוח מהרשימה אם ברור מהתוכן שהמייל קשור אליו, אחרת null","confidence":0-1,"new_lead":true/false}
כללים: actionable=false למייל שהוא רק "תודה"/אישור קבלה/מידע ללא בקשה. priority=high לתלונה, דחיפות מפורשת, דדליין היום/מחר, או בעיה בקמפיין/אתר שלא עובד.
new_lead=true רק כשזו פנייה של עסק/אדם חדש שמתעניין בשירותים. אל תמציא לקוח — client_guess רק מתוך הרשימה.`;
  const user = `מאת: ${fromName} <${fromEmail}>\nנושא: ${subject}\n${match.client_id ? `(שויך כבר ללקוח לפי ${match.by})` : `לקוחות המשרד: ${list.map((c) => `${c.id}=${c.name}${c.site ? ` (${c.site})` : ''}`).join(' | ')}`}\n\nתוכן:\n${snippet || '(ריק)'}`;
  const r = await claude({ model: MODEL, system, user, maxTokens: 500 });
  await w('office_worker_log_usage', { p_client: match.client_id ?? null, p_agent: 'inbox_triage', p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output), p_note: 'סיווג מייל נכנס' }).catch(() => null);
  const c: Cls = extractJson(r.text) as any;
  const guess = !match.client_id && c?.client_guess && list.some((x) => x.id === c.client_guess) && Number(c.confidence) >= 0.6 ? c.client_guess : null;
  const actionable = !!c?.actionable || c?.kind === 'complaint';
  const status = !actionable ? 'info' : match.client_id ? 'task' : c?.new_lead ? 'lead' : 'needs_match';
  await w('office_worker_inbox_save', { p_mail: { ...base, ...full, snippet, status, client_id: match.client_id ?? null, lead_id: match.lead_id ?? null, match_by: match.by ?? null, suggested_client: guess, classification: c ?? {} } });
  return status === 'task' || status === 'lead' ? 'tasks' : status;
}

// drop quoted replies / signatures so the summary is about the new message only
function stripQuoted(t: string) {
  const cut = t.search(/\n(On .{5,80} wrote:|ב-.{5,80} כתב(?:ה)?:|-----Original Message-----|From: .+\nSent: |בתאריך .{5,80}, מאת )/);
  return (cut > 0 ? t.slice(0, cut) : t).trim();
}
