import nodemailer from 'nodemailer';
// Gmail / Google Workspace SMTP with an App Password (set by the owner in Vercel; never in chat or repo).
// Sending happens only on an explicit human click with a preview — never automatically.
export const gmailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
const transport = () => nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! } });
export async function gmailCheck() { try { await transport().verify(); return { ok: true as const }; } catch (e: any) { return { ok: false as const, error: String(e?.message ?? e).slice(0, 200) }; } }
export async function gmailSend(o: { to: string; subject: string; html: string; text: string; replyTo?: string }) {
  try {
    const info = await transport().sendMail({ from: { name: process.env.GMAIL_FROM_NAME || 'Pixel Digital · Studio Pixel', address: process.env.GMAIL_USER! },
      to: o.to, subject: o.subject, html: o.html, text: o.text, replyTo: o.replyTo });
    return { ok: true as const, id: info.messageId };
  } catch (e: any) { return { ok: false as const, error: String(e?.message ?? e).slice(0, 300) }; }
}
