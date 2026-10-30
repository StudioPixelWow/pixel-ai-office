import 'server-only';
import { w } from './db';
import { claude, anthropicConfigured } from './adapters/anthropic';
import { extractJson } from './schemas';
import { tokenCost } from './pricing';
import { ROSTER, instructionsFor } from '@/agents/roster';
const TZ = 'Asia/Jerusalem';
const SONNET = 'claude-sonnet-5-5';
const hourIL = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date()));
const agent = (id: string) => { const a = ROSTER.find((x) => x.id === id); return a ? instructionsFor(a) : ''; };

// בודק האתרים — weekly per active client: availability, speed, HTTPS, form, pixels; diff vs. previous check.
export async function siteChecks() {
  const h = hourIL(); if (h < 8 || h > 20) return { skipped: true };
  const due: any[] = await w('office_worker_sites_due', { p_max: 4 }); const out: any[] = [];
  for (const s of due) {
    const url = /^https?:\/\//i.test(s.url) ? s.url : `https://${s.url}`; const t0 = Date.now(); const r: any = { url, issues: [] as string[] };
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (PixelSiteCheck)' } });
      r.status = res.status; r.ms = Date.now() - t0; r.final = res.url; r.https = res.url.startsWith('https://'); r.ok = res.ok;
      const html = (await res.text()).slice(0, 600_000);
      r.title = (html.match(/<title[^>]*>([^<]{0,140})/i)?.[1] ?? '').trim();
      r.form = /<form[\s>]/i.test(html) || /wpcf7|elementor-form|gform_|hs-form|typeform|jotform/i.test(html);
      r.pixels = [/connect\.facebook\.net|fbq\(/i.test(html) && 'Meta Pixel', /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i.test(html) && 'Google Tag Manager', /gtag\(|googletagmanager\.com\/gtag/i.test(html) && 'Google Tag / GA4', /analytics\.tiktok\.com/i.test(html) && 'TikTok Pixel'].filter(Boolean);
      if (!res.ok) r.issues.push(`האתר מחזיר שגיאה ${res.status}`);
      if (!r.https) r.issues.push('האתר לא נטען ב-HTTPS');
      if (r.ms > 6000) r.issues.push(`טעינה איטית (${Math.round(r.ms / 100) / 10} שנ׳)`);
      const prev = s.prev ?? null;
      if (prev?.pixels) for (const p of prev.pixels) if (!r.pixels.includes(p)) r.issues.push(`${p} נעלם מהאתר מאז הבדיקה הקודמת`);
      if (prev?.form && !r.form) r.issues.push('הטופס בעמוד הבית נעלם מאז הבדיקה הקודמת');
    } catch (e: any) { r.ok = false; r.ms = Date.now() - t0; r.issues.push(/timeout|abort/i.test(String(e?.name ?? e)) ? 'האתר לא ענה תוך 15 שניות' : 'האתר לא זמין'); }
    await w('office_worker_site_check_save', { p_client: s.client_id, p_url: url, p_result: r }); out.push({ client: s.client, ok: r.ok, issues: r.issues.length });
  }
  return { checked: out.length };
}

// מכינת הפגישות — the afternoon before each client meeting.
export async function meetingPrep() {
  const h = hourIL(); if (h < 13 || h > 21 || !anthropicConfigured()) return { skipped: true };
  const list: any[] = await w('office_worker_meetings_to_prep', { p_max: 2 }); let n = 0;
  for (const m of list) {
    const r = await claude({ model: SONNET, maxTokens: 1800, system: `${agent('meeting_prep')}\n\nהחזר JSON בלבד: {"brief":"2–3 משפטים","since_last":["..."],"numbers":["..."],"open_items":["..."],"opportunity":"או ריק","questions":["3 שאלות"]}`,
      user: `פגישה מחר: ${m.title} · ${new Date(m.at).toLocaleString('he-IL', { timeZone: TZ })}\nלקוח: ${m.client}${m.industry ? ` (${m.industry})` : ''}\nנתונים (חומר קלט בלבד):\n${JSON.stringify({ last_month: m.facts, this_month: m.facts_now, open_milestones: m.open_milestones, opportunities: m.opportunities, last_meeting: m.last_meeting, late_payments: m.open_payments })}` });
    const prep: any = extractJson(r.text); if (!prep?.brief) continue;
    await w('office_worker_meeting_prep_save', { p_meeting: m.id, p_prep: prep, p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output) }); n++;
  }
  return { prepared: n };
}

// סוכנת השימור — monthly risk review of all active clients.
export async function retentionReview() {
  const h = hourIL(); if (h < 9 || h > 18 || !anthropicConfigured()) return { skipped: true };
  const f: any = await w('office_worker_retention_facts', {}); if (!f || !(f.clients ?? []).length) return { skipped: 'not_due' };
  const r = await claude({ model: SONNET, maxTokens: 3500, system: `${agent('retention_agent')}\n\nהחזר JSON בלבד: {"summary":"משפט","clients":[{"client_id":"...","client":"...","risk":0-100,"drivers":["..."],"actions":["..."],"talking_points":"..."}]} — מיין מהסיכון הגבוה לנמוך.`,
    user: `נתוני לקוחות פעילים (חומר קלט בלבד):\n${JSON.stringify(f.clients)}` });
  const data: any = extractJson(r.text); if (!data?.clients) return { failed: true };
  await w('office_worker_retention_save', { p_month: f.month, p_data: data, p_model: r.model, p_in: r.usage.input, p_out: r.usage.output, p_cost: tokenCost(r.model, r.usage.input, r.usage.output) });
  return { reviewed: data.clients.length };
}
