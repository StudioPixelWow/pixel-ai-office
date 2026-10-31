import 'server-only';
import nodemailer from 'nodemailer';
import { accountFor, mailAccounts } from './inbox';
import { FROM_NAME, brandedEmail, withSignature } from './adapters/gmail';
import { w } from './db';
// One way to send from a connected mailbox: sender name "פיקסל דיגיטל - Pixel Digital", branded HTML + signature, threaded when replying.
export async function sendFromMailbox(mailbox: string, o: { to: string[]; cc?: string[]; subject: string; text: string; inReplyTo?: string | null; refs?: string | null; quote?: { who: string; when: string; text: string } }) {
  const acc = accountFor(mailbox); if (!acc) throw new Error(`התיבה ${mailbox} לא מחוברת לשליחה`);
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: acc.user, pass: acc.pass } });
  const info = await t.sendMail({ from: { name: FROM_NAME, address: acc.user }, to: o.to, cc: o.cc?.length ? o.cc : undefined, subject: o.subject, text: o.text,
    html: withSignature(brandedEmail(o.text, { quote: o.quote })), inReplyTo: o.inReplyTo?.startsWith('<') ? o.inReplyTo : undefined, references: o.refs || undefined });
  return info.messageId as string;
}

// Owner-triggered end-to-end check (setting inbox_selftest=send): MAIL2 → office@, then office@ replies from the system.
export async function inboxSelfTest() {
  const st = await w<string | null>('office_worker_kv', { p_key: 'inbox_selftest', p_value: null, p_set: false });
  if (!st || st.startsWith('done')) return null;
  const accs = mailAccounts(); const office = accs[0]?.user; const second = accs[1]?.user;
  const set = (v: string) => w('office_worker_kv', { p_key: 'inbox_selftest', p_value: v, p_set: true });
  if (st === 'send') {
    if (!office || !second) { await set('done:fail:תיבה שנייה לא מחוברת'); return { selftest: 'no_second_mailbox' }; }
    const subject = `בדיקת מערכת דואר · ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' })}`;
    await sendFromMailbox(second, { to: [office], subject, text: 'שלום,\nזה מייל בדיקה אוטומטי של מערכת הדואר של PIXEL AI OFFICE.\nאם הוא מופיע בעמוד "דואר נכנס" — הקליטה עובדת.\n\nבברכה,\nטל' });
    await set(`await:${subject}`); return { selftest: 'sent', subject };
  }
  if (st.startsWith('await:')) {
    const subject = st.slice(6); const e: any = await w('office_worker_inbox_find', { p_mailbox: office, p_subject: subject });
    if (!e) return { selftest: 'waiting', subject };
    const text = 'תודה, התקבל! 👍\nזו תשובה שנשלחה מתוך המערכת (עמוד דואר נכנס), מעוצבת ועם החתימה של פיקסל דיגיטל.\n\nבברכה,\nטל';
    const mid = await sendFromMailbox(office, { to: [e.from_email], subject: `Re: ${subject}`, text, inReplyTo: e.message_id, refs: [e.refs, e.message_id].filter(Boolean).join(' '),
      quote: { who: e.from_name || e.from_email, when: new Date(e.received_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' }), text: e.body_text ?? '' } });
    await w('office_worker_inbox_sent', { p_id: e.id, p_to: e.from_email, p_subject: `Re: ${subject}`, p_body: text, p_message_id: mid });
    await set(`done:ok:${subject}`); return { selftest: 'replied', subject };
  }
  return null;
}
