import nodemailer from 'nodemailer';
// Gmail / Google Workspace SMTP with an App Password (set by the owner in Vercel; never in chat or repo).
// Sending happens only on an explicit human click with a preview — never automatically.
// Every email that leaves the system: one sender name + the Pixel Digital signature image (Tal, 31.10.2026)
export const FROM_NAME = 'פיקסל דיגיטל - Pixel Digital';
export const SIGNATURE_URL = 'https://ci3.googleusercontent.com/mail-sig/AIorK4wfnUs5nXkL4zKdn_neppNBvNwUemdxqW8yE1LSjdB_x40y0nCNZNhlV1KpYBTRScEZhH4m7_qQd1y8';
export const SIGNATURE_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px"><tr><td><img src="${SIGNATURE_URL}" alt="פיקסל דיגיטל - Pixel Digital" style="display:block;max-width:440px;width:100%;height:auto;border:0" /></td></tr></table>`;
export function withSignature(html: string) {
  if (html.includes('<!--sig-->')) return html.replace('<!--sig-->', SIGNATURE_HTML);
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${SIGNATURE_HTML}</body>`) : `${html}<div dir="rtl" style="padding:0 24px 24px">${SIGNATURE_HTML}</div>`;
}
const escH = (x: string) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
// Pixel Digital branded email (header logo, white card, RTL). Plain text in → designed HTML out; links become clickable.
export function brandedEmail(text: string, opts: { quote?: { who: string; when: string; text: string } } = {}) {
  const body = escH(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0B1320;font-weight:bold">$1</a>').replace(/\n/g, '<br>');
  const q = opts.quote ? `<div style="margin-top:22px;padding:12px 14px;border-inline-start:3px solid #F5B800;background:#F7F8FA;color:#5B6B80;font-size:13px;line-height:1.6"><div style="margin-bottom:6px">${escH(opts.quote.when)} · ${escH(opts.quote.who)} כתב/ה:</div>${escH(opts.quote.text.slice(0, 3000)).replace(/\n/g, '<br>')}</div>` : '';
  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;background:#F7FBFF;padding:24px"><div style="max-width:600px;margin:auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #E6EDF5">`
    + `<div style="background:#0B1320;padding:18px 24px"><img src="https://s-pixel.co.il/wp-content/uploads/2026/07/Asset-1.png" alt="Pixel Digital" height="28" style="height:28px;width:auto;display:block;border:0"></div>`
    + `<div style="padding:24px;color:#100F0D;font-size:15px;line-height:1.75;text-align:right">${body}<!--sig-->${q}</div></div></div>`;
}
export const gmailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
const transport = () => nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! } });
export async function gmailCheck() { try { await transport().verify(); return { ok: true as const }; } catch (e: any) { return { ok: false as const, error: String(e?.message ?? e).slice(0, 200) }; } }
export async function gmailSend(o: { to: string; subject: string; html: string; text: string; replyTo?: string }) {
  try {
    const info = await transport().sendMail({ from: { name: FROM_NAME, address: process.env.GMAIL_USER! },
      to: o.to, subject: o.subject, html: withSignature(o.html), text: o.text, replyTo: o.replyTo });
    return { ok: true as const, id: info.messageId };
  } catch (e: any) { return { ok: false as const, error: String(e?.message ?? e).slice(0, 300) }; }
}
