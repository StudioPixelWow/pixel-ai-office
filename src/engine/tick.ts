import { gcalSync } from './adapters/gcal';
import { meetingReminders } from './reminders';
import { morningDigest, weeklyPlan } from './digest';
import { siteChecks, meetingPrep, retentionReview } from './smart-agents';
import { adsSync } from './ads-sync';
import 'server-only';
import { w } from './db';
import { execute } from './executor';
import { anthropicConfigured, listModels } from './adapters/anthropic';
import { openaiConfigured, checkImageModel, imageModel } from './adapters/openai';
import { klingConfigured, checkAuth } from './adapters/kling';
import { waConfigured, waCheck, waSendText } from './adapters/whatsapp';
import { growCheck, growIsSandbox, growConfigured } from './adapters/grow';
import { greenInvoiceConfigured, giCheck } from './adapters/greeninvoice';
import { gmailConfigured, gmailCheck, gmailSend } from './adapters/gmail';
import { metaConfigured, metaCheck } from './adapters/meta';
import { marketingToken, adsConfigured } from './adapters/gmarketing';

export async function selfChecks() {
  const out: any = {};
  // Claude: key present + models listed + required model IDs actually exist on the account
  if (!anthropicConfigured()) out.anthropic = await w('office_worker_connection_report', { p_provider: 'anthropic', p_label: 'Claude (Anthropic API)', p_secret_ref: 'ANTHROPIC_API_KEY',
    p_caps: [{ capability: 'generate_text', implemented: true, status: 'not_connected', check_method: 'env', details: 'ANTHROPIC_API_KEY לא הוגדר בשרת' }] });
  else {
    try { const models = await listModels(); const need = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']; const missing = need.filter((m) => !models.includes(m));
      out.anthropic = await w('office_worker_connection_report', { p_provider: 'anthropic', p_label: 'Claude (Anthropic API)', p_secret_ref: 'ANTHROPIC_API_KEY',
        p_caps: [{ capability: 'generate_text', implemented: true, status: missing.includes('claude-opus-5-5') ? 'missing_permissions' : 'access_verified', check_method: 'GET /v1/models', account: models.slice(0, 6).join(','),
          details: missing.length ? `מודלים חסרים בחשבון: ${missing.join(', ')}` : 'Opus 5.5 / Sonnet 5.5 / Haiku 5.5 זמינים' }] }); }
    catch (e: any) { out.anthropic = await w('office_worker_connection_report', { p_provider: 'anthropic', p_label: 'Claude (Anthropic API)', p_secret_ref: 'ANTHROPIC_API_KEY',
      p_caps: [{ capability: 'generate_text', implemented: true, status: e.status === 401 ? 'expired' : 'requires_user', check_method: 'GET /v1/models', details: String(e.message) }] }); }
  }
  const img = openaiConfigured() ? await checkImageModel().catch(() => ({ ok: false, status: 0 })) : null;
  out.openai = await w('office_worker_connection_report', { p_provider: 'openai_api', p_label: 'OpenAI Images API (חיוב API נפרד מ-ChatGPT)', p_secret_ref: 'OPENAI_API_KEY',
    p_caps: [{ capability: 'generate_image', implemented: true, status: !img ? 'not_connected' : img.ok ? 'access_verified' : img.status === 401 ? 'expired' : 'missing_permissions', check_method: `GET /v1/models/${imageModel()}`,
      details: !img ? 'OPENAI_API_KEY לא הוגדר' : img.ok ? `המודל ${imageModel()} זמין` : `HTTP ${img.status}` }, { capability: 'edit_image', implemented: false, status: 'not_implemented', check_method: '—', details: 'טרם מומש' }] });
  const k = klingConfigured() ? await checkAuth().catch(() => ({ ok: false, status: 0 })) : null;
  out.kling = await w('office_worker_connection_report', { p_provider: 'kling_api', p_label: 'Kling API (יצירת וידאו)', p_secret_ref: 'KLING_ACCESS_KEY',
    p_caps: [{ capability: 'generate_video', implemented: true, status: !k ? 'not_connected' : k.ok ? 'access_verified' : k.status === 401 ? 'expired' : 'requires_user', check_method: 'GET /v1/videos/text2video', details: !k ? 'מפתחות Kling לא הוגדרו' : `HTTP ${k.status}` }] });
  const wa = waConfigured() ? await waCheck().catch((e) => ({ ok: false, error: String(e) })) : null;
  out.whatsapp = await w('office_worker_connection_report', { p_provider: 'whatsapp_cloud', p_label: 'WhatsApp Cloud API (רשמי)', p_secret_ref: 'WHATSAPP_CLOUD_TOKEN',
    p_caps: [{ capability: 'send_message', implemented: true, status: !wa ? 'not_connected' : wa.ok ? 'access_verified' : 'expired', check_method: 'GET phone number', account: (wa as any)?.account ?? null,
      details: !wa ? 'טוקן ומזהה מספר לא הוגדרו' : wa.ok ? 'החשבון אומת (שליחה נבדקת רק בהודעת בדיקה מאושרת)' : (wa as any).error }] });
  const gi = greenInvoiceConfigured() ? await giCheck() : null;
  out.green_invoice = await w('office_worker_connection_report', { p_provider: 'green_invoice', p_label: 'חשבונית ירוקה (Morning)', p_secret_ref: 'GREEN_INVOICE_API_ID',
    p_caps: [{ capability: 'issue_invoice', implemented: true, status: !gi ? 'not_connected' : gi.ok ? 'access_verified' : gi.status === 401 || gi.status === 403 ? 'expired' : 'requires_user', check_method: 'POST /account/token',
      details: !gi ? 'מפתחות API לא הוגדרו' : gi.ok ? `אומת (${process.env.GREEN_INVOICE_ENV === 'sandbox' ? 'סביבת בדיקה' : 'ייצור'}) — הפקה רק בלחיצה מאושרת` : (gi as any).error }] });
  const gr = growConfigured() ? await growCheck().catch((e: any) => ({ ok: false as const, error: String(e?.message ?? e) })) : null;
  out.grow = await w('office_worker_connection_report', { p_provider: 'grow', p_label: 'Grow — קישורי תשלום', p_secret_ref: 'GROW_USER_ID',
    p_caps: [{ capability: 'payment_link', implemented: true, status: !gr ? 'not_connected' : gr.ok ? (growIsSandbox() ? 'action_tested' : 'access_verified') : 'requires_user', check_method: 'createPaymentProcess 1₪',
      details: !gr ? 'GROW_USER_ID / GROW_PAGE_CODE לא הוגדרו' : gr.ok ? (growIsSandbox() ? 'סביבת טסט של Grow — נוצר דף תשלום, אין חיוב אמיתי' : 'סביבה חיה — נוצר דף תשלום') : (gr as any).error }] });
  const gm = gmailConfigured() ? await gmailCheck() : null;
  out.gmail = await w('office_worker_connection_report', { p_provider: 'gmail', p_label: `Gmail — ${process.env.GMAIL_USER ?? 'office@'}`, p_secret_ref: 'GMAIL_APP_PASSWORD',
    p_caps: [{ capability: 'send_email', implemented: true, status: !gm ? 'not_connected' : gm.ok ? 'access_verified' : 'expired', check_method: 'SMTP verify',
      details: !gm ? 'GMAIL_APP_PASSWORD לא הוגדר' : gm.ok ? 'החיבור אומת — שליחה רק בלחיצה עם תצוגה מקדימה' : (gm as any).error }] });
  // built-in server capability: outbound HTTP (site checker) — real request, not an assumption
  const hc = await fetch('https://s-pixel.co.il/', { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) }).then((r) => ({ ok: r.status < 500, status: r.status })).catch((e) => ({ ok: false, status: 0, error: String(e?.message ?? e) }));
  out.http = await w('office_worker_connection_report', { p_provider: 'server_http', p_label: 'בדיקות HTTP מהשרת (בודק אתרים)', p_secret_ref: null,
    p_caps: [{ capability: 'http_check', implemented: true, status: hc.ok ? 'access_verified' : 'requires_user', check_method: 'HEAD https://s-pixel.co.il', details: hc.ok ? `השרת מבצע בקשות HTTP (HTTP ${hc.status})` : `בקשת בדיקה נכשלה: ${(hc as any).error ?? hc.status}` }] });
  // web research = Claude's server-side web search tool; probed with one real minimal search
  let ws: { ok: boolean; status?: number; error?: string; n?: number } | null = null;
  if (anthropicConfigured()) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(45000),
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 400, tool_choice: { type: 'any' }, tools: [{ type: process.env.ANTHROPIC_WEB_SEARCH_TOOL || 'web_search_20250305', name: 'web_search', max_uses: 1 }],
          messages: [{ role: 'user', content: 'Use web search once to look up "Pixel Digital Israel", then reply with one word: ok' }] }) });
      const j: any = await r.json().catch(() => ({}));
      ws = r.ok ? { ok: (j.usage?.server_tool_use?.web_search_requests ?? 0) > 0, n: j.usage?.server_tool_use?.web_search_requests ?? 0, status: r.status } : { ok: false, status: r.status, error: j?.error?.message };
    } catch (e: any) { ws = { ok: false, error: String(e?.message ?? e) }; }
  }
  out.web = await w('office_worker_connection_report', { p_provider: 'anthropic_web_search', p_label: 'חיפוש ברשת (Claude web search)', p_secret_ref: 'ANTHROPIC_API_KEY',
    p_caps: [{ capability: 'web_research', implemented: true, status: !ws ? 'not_connected' : ws.ok ? 'access_verified' : ws.status === 401 ? 'expired' : 'missing_permissions', check_method: 'POST /v1/messages + web_search (1 חיפוש)',
      details: !ws ? 'ANTHROPIC_API_KEY לא הוגדר' : ws.ok ? 'בוצע חיפוש בדיקה אמיתי ברשת' : `חיפוש הבדיקה לא בוצע: ${ws.error ?? ws.status ?? 'לא הופעל חיפוש'}` }] });
  // ad accounts: Meta system user token and/or Google Ads (OAuth + developer token)
  const mc = metaConfigured() ? await metaCheck() : null;
  const gt = await marketingToken().catch(() => null);
  const ads = !!(mc?.ok) || !!(gt && adsConfigured());
  const missing = [!metaConfigured() && 'META_SYSTEM_TOKEN', mc && !mc.ok && `Meta: ${mc.error}`, !gt && 'חיבור Google בעמוד החיבורים', !adsConfigured() && 'GOOGLE_ADS_DEVELOPER_TOKEN / GOOGLE_ADS_MCC_ID'].filter(Boolean).join(' · ');
  out.ads = await w('office_worker_connection_report', { p_provider: 'ads_read', p_label: 'קריאת נתוני קמפיינים (Meta / Google Ads)', p_secret_ref: 'META_SYSTEM_TOKEN',
    p_caps: [{ capability: 'read_ads', implemented: true, status: ads ? 'access_verified' : 'not_connected', check_method: 'GET /me (Meta) · OAuth token (Google)', account: mc?.ok ? (mc as any).name : null,
      details: ads ? [mc?.ok && 'Meta מאומת', gt && adsConfigured() && 'Google Ads מוגדר'].filter(Boolean).join(' · ') + (missing ? ` · עדיין חסר: ${missing}` : '') : `חסר: ${missing}` }] });
  out.sandbox = await w('office_worker_connection_report', { p_provider: 'whatsapp_sandbox', p_label: 'WhatsApp — סביבת בדיקה (לא שולח לאף טלפון)', p_secret_ref: null,
    p_caps: [{ capability: 'send_message', implemented: true, status: 'action_tested', check_method: 'office.sandbox_outbox', details: 'רושם הודעות לטבלת בדיקה בלבד; מותר רק למספרי בדיקה שאישרת' }] });
  return out;
}

// approved messages also go by email when the contact has one (WhatsApp Cloud may not be connected yet)
async function alsoEmail(dispatchId: string) {
  if (!gmailConfigured()) return null;
  const e: any = await w('office_worker_dispatch_email', { p_dispatch: dispatchId }).catch(() => null); if (!e?.email) return null;
  const loud = e.ref_type === 'studio_booking'; const esc = (x: string) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
  const body = esc(e.body).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:inherit;font-weight:bold">$1</a>').replace(/\n/g, '<br>');
  const head = loud ? `<div style="background:#100F0D;padding:18px 24px"><img src="${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/brand/loud-on-dark.png" alt="LOUD Podcast Studio" style="height:46px"></div>`
    : `<div style="background:#0B1320;padding:18px 24px"><img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-white-500.webp" alt="Pixel Digital" style="height:28px"></div>`;
  const subject = loud ? ({ loud_kit: 'קובץ השאלות לראיון שלך מוכן 🎙️', loud_reminder: 'תזכורת: מחר מקליטים באולפן LOUD', loud_thanks: 'איזה כיף היה באולפן 🎧', loud_materials: 'החומרים מהפרק שלך מוכנים 🎙️', loud_pay: 'עוד צעד אחד לפרק שלך', loud_slot: 'בוחרים מועד להקלטה' } as any)[e.kind] ?? 'הודעה מאולפן LOUD' : (({ care_lead_ack: 'קיבלנו את הפנייה שלך 🙌', care_proposal_fu: 'לגבי ההצעה שלנו', care_payment: 'תזכורת תשלום — Pixel Digital', care_welcome: 'ברוכים הבאים ל-Pixel Digital 🎉', care_milestone: 'עדכון התקדמות בפרויקט ✅', care_content: 'תוכן מחכה לאישורך 📅', care_monthly: 'הסיכום החודשי שלך 📊', care_holiday: 'חג שמח מ-Pixel Digital 🌟', care_anniversary: 'שנה שאנחנו עובדים יחד 🎂', care_nps: 'שאלה קצרה אחת 🙏', care_meeting_fu: 'תודה על הפגישה' } as any)[e.kind] ?? 'הודעה מ-Pixel Digital');
  return gmailSend({ to: e.email, subject, text: e.body, html: `<div dir="rtl" style="font-family:Arial,sans-serif;background:${loud ? '#1C1A17' : '#F7FBFF'};padding:24px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:20px;overflow:hidden">${head}<div style="padding:22px 24px;color:#100F0D;font-size:15px;line-height:1.7">${body}</div></div></div>` });
}
async function dispatchOutbox() {
  const items: any[] = await w('office_worker_outbox_claim', { p_max: 5 });
  for (const it of items) {
    await alsoEmail(it.dispatch_id).catch(() => null);
    if (it.provider === 'whatsapp_sandbox') {
      const r = await w('office_worker_sandbox_send', { p_dispatch: it.dispatch_id });
      await w('office_worker_outbox_result', { p_dispatch: it.dispatch_id, p_outcome: 'accepted', p_provider_id: r.provider_message_id, p_error: null });
    } else if (it.provider === 'whatsapp_cloud') {
      const r = await waSendText(it.to, it.body, it.template_name ? { name: it.template_name, params: it.template_params?.params } : null);
      await w('office_worker_outbox_result', { p_dispatch: it.dispatch_id, p_outcome: r.outcome, p_provider_id: (r as any).id ?? null, p_error: (r as any).error ?? null });
    } else {
      await w('office_worker_outbox_result', { p_dispatch: it.dispatch_id, p_outcome: 'failed', p_provider_id: null, p_error: 'ספק שולח לא נתמך' });
    }
  }
  return items.length;
}

export async function tick(opts: { budgetMs?: number; checks?: boolean } = {}) {
  const started = Date.now(); const budget = opts.budgetMs ?? 240_000; const workerId = `vercel-${process.env.VERCEL_REGION ?? 'local'}`;
  const report: any = { automations: null, executed: 0, outbox: 0, checks: null, errors: [] as string[] };
  try { report.automations = await w('office_worker_tick_automations', {}); } catch (e: any) { report.errors.push(e.message); }
  try { report.billing = await w('office_worker_billing_tick', {}); } catch (e: any) { report.errors.push(e.message); }
  try { report.milestones = await w('office_worker_roll_milestones', {}); } catch (e: any) { report.errors.push(e.message); }
  try { report.calendar = await gcalSync(); } catch (e: any) { report.errors.push(e.message); }
  try { report.reminders = await meetingReminders(); } catch (e: any) { report.errors.push(e.message); }
  if (new Date().getUTCMinutes() % 5 === 1) { try { report.care = await w('office_worker_care_tick', {}); } catch (e: any) { report.errors.push(e.message); } }
  const mi = new Date().getUTCMinutes();
  if (mi % 20 === 13) { try { report.sites = await siteChecks(); } catch (e: any) { report.errors.push(e.message); } }
  // autopilot (owner switches in settings): research new clients, monthly gantts, RTM — once an hour
  if (mi === 17) { try { report.autopilot = await w('office_worker_autopilot', {}); } catch (e: any) { report.errors.push(e.message); } }
  if (mi % 15 === 7) { try { report.prep = await meetingPrep(); } catch (e: any) { report.errors.push(e.message); } }
  if (mi % 10 === 3) { try { report.ads = await adsSync(); } catch (e: any) { report.errors.push(e.message); } }
  if (mi === 29) { try { report.retention = await retentionReview(); } catch (e: any) { report.errors.push(e.message); } }
  try { report.week = await weeklyPlan(); } catch (e: any) { report.errors.push(e.message); }
  try { report.digest = await morningDigest(); } catch (e: any) { report.errors.push(e.message); }
  if (opts.checks) { try { report.checks = await selfChecks(); } catch (e: any) { report.errors.push(e.message); } }
  try { report.outbox += await dispatchOutbox(); } catch (e: any) { report.errors.push(e.message); }
  // A single AI step can take up to ~230s. Only claim new work while at least that much of the 300s function window remains;
  // the next cron tick (every minute) picks up whatever is left.
  const claimCutoff = Math.min(budget, Number(process.env.WORKER_CLAIM_CUTOFF_MS ?? 55_000));
  while (Date.now() - started < claimCutoff) {
    let batch: any[] = [];
    try { batch = await w('office_worker_claim', { p_worker: workerId, p_max: 3 }); } catch (e: any) { report.errors.push(e.message); break; }
    if (!batch.length) break;
    await Promise.all(batch.map((c) => execute(c, workerId)));
    report.executed += batch.length;
    try { report.outbox += await dispatchOutbox(); } catch (e: any) { report.errors.push(e.message); }
  }
  return report;
}
