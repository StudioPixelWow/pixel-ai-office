import 'server-only';
import { w } from './db';
import { execute } from './executor';
import { anthropicConfigured, listModels } from './adapters/anthropic';
import { openaiConfigured, checkImageModel, imageModel } from './adapters/openai';
import { klingConfigured, checkAuth } from './adapters/kling';
import { waConfigured, waCheck, waSendText } from './adapters/whatsapp';

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
  out.sandbox = await w('office_worker_connection_report', { p_provider: 'whatsapp_sandbox', p_label: 'WhatsApp — סביבת בדיקה (לא שולח לאף טלפון)', p_secret_ref: null,
    p_caps: [{ capability: 'send_message', implemented: true, status: 'action_tested', check_method: 'office.sandbox_outbox', details: 'רושם הודעות לטבלת בדיקה בלבד; מותר רק למספרי בדיקה שאישרת' }] });
  return out;
}

async function dispatchOutbox() {
  const items: any[] = await w('office_worker_outbox_claim', { p_max: 5 });
  for (const it of items) {
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
  if (opts.checks) { try { report.checks = await selfChecks(); } catch (e: any) { report.errors.push(e.message); } }
  try { report.outbox += await dispatchOutbox(); } catch (e: any) { report.errors.push(e.message); }
  while (Date.now() - started < budget) {
    let batch: any[] = [];
    try { batch = await w('office_worker_claim', { p_worker: workerId, p_max: 3 }); } catch (e: any) { report.errors.push(e.message); break; }
    if (!batch.length) break;
    await Promise.all(batch.map((c) => execute(c, workerId)));
    report.executed += batch.length;
    try { report.outbox += await dispatchOutbox(); } catch (e: any) { report.errors.push(e.message); }
  }
  return report;
}
