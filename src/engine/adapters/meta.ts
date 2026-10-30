import 'server-only';
import { w } from '@/engine/db';
import { seal, unseal } from '@/lib/crypto';
// Meta Marketing API — read-only (ads_read). Token source: a System User token in Vercel (META_SYSTEM_TOKEN) if set,
// otherwise the office user's own login ("חיבור מטא" — sees every ad account that user can access, incl. ones added later).
const V = process.env.META_GRAPH_VERSION ?? 'v26.0';
export const P_META = 'meta_user';
export const metaAppConfigured = () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
let tk: { t: string | null; at: number } | null = null;
export async function metaToken(): Promise<string | null> {
  if (process.env.META_SYSTEM_TOKEN) return process.env.META_SYSTEM_TOKEN;
  if (tk && Date.now() - tk.at < 10 * 60_000) return tk.t;
  const r: any = await w('office_worker_oauth_get', { p_provider: P_META }).catch(() => null);
  let t: string | null = null; try { t = r?.token_enc ? JSON.parse(unseal(r.token_enc)).token : null; } catch { t = null; }
  tk = { t, at: Date.now() }; return t;
}
export const metaConfigured = async () => !!(await metaToken());
export function metaAuthUrl(origin: string, state: string) {
  const q = new URLSearchParams({ client_id: process.env.META_APP_ID!, redirect_uri: `${origin}/api/meta/callback`, state, response_type: 'code', scope: 'ads_read,read_insights,business_management' });
  return `https://www.facebook.com/${V}/dialog/oauth?${q}`;
}
export async function metaExchange(origin: string, code: string) {
  const a = new URLSearchParams({ client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, redirect_uri: `${origin}/api/meta/callback`, code });
  const r1: any = await (await fetch(`https://graph.facebook.com/${V}/oauth/access_token?${a}`)).json(); if (!r1.access_token) throw new Error(r1.error?.message ?? 'no_token');
  const b = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, fb_exchange_token: r1.access_token });
  const r2: any = await (await fetch(`https://graph.facebook.com/${V}/oauth/access_token?${b}`)).json(); const token = r2.access_token ?? r1.access_token;
  const meR: any = await (await fetch(`https://graph.facebook.com/${V}/me?fields=id,name&access_token=${encodeURIComponent(token)}`)).json();
  const expires = r2.expires_in ? new Date(Date.now() + r2.expires_in * 1000).toISOString() : null;
  await w('office_worker_oauth_save', { p_provider: P_META, p_account: meR.name ?? meR.id ?? 'Meta', p_token_enc: seal(JSON.stringify({ token, expires })), p_scopes: 'ads_read,read_insights,business_management' });
  tk = null; return { name: meR.name, expires };
}
async function g(path: string, params: Record<string, string> = {}) {
  const t = await metaToken(); if (!t) throw Object.assign(new Error('meta not_connected'), { status: 0 });
  const q = new URLSearchParams({ ...params, access_token: t });
  const r = await fetch(`https://graph.facebook.com/${V}/${path}?${q}`, { signal: AbortSignal.timeout(20000) });
  const j: any = await r.json().catch(() => ({})); if (!r.ok || j.error) throw Object.assign(new Error(`meta ${r.status}: ${j.error?.message ?? ''}`.slice(0, 240)), { status: r.status });
  return j;
}
export async function metaCheck() { try { const me = await g('me', { fields: 'id,name' }); return { ok: true as const, name: me.name }; } catch (e: any) { return { ok: false as const, error: e.message, status: e.status }; } }
export async function metaAdAccounts(): Promise<{ id: string; name: string; status: number; currency: string }[]> {
  const out: any[] = []; let after = '';
  for (let i = 0; i < 6; i++) { const j = await g('me/adaccounts', { fields: 'name,account_id,account_status,currency', limit: '100', ...(after ? { after } : {}) });
    out.push(...(j.data ?? []).map((a: any) => ({ id: a.account_id, name: a.name, status: a.account_status, currency: a.currency }))); after = j.paging?.cursors?.after; if (!j.paging?.next) break; }
  return out;
}
const LEAD = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.messaging_conversation_started_7d'];
export async function metaInsights(account: string, since: string, until: string) {
  const j = await g(`act_${account.replace(/^act_/, '')}/insights`, { fields: 'spend,impressions,clicks,ctr,cpc,actions,reach', time_range: JSON.stringify({ since, until }), level: 'account' });
  const x = j.data?.[0] ?? {}; const act = (k: string[]) => (x.actions ?? []).filter((a: any) => k.includes(a.action_type)).reduce((s: number, a: any) => s + Number(a.value), 0);
  const leads = act(LEAD.slice(0, 3)); const msgs = act([LEAD[3]]);
  const spend = Number(x.spend ?? 0);
  return { spend, impressions: Number(x.impressions ?? 0), clicks: Number(x.clicks ?? 0), reach: Number(x.reach ?? 0), ctr: Number(x.ctr ?? 0), leads, conversations: msgs, cpl: leads ? Math.round((spend / leads) * 100) / 100 : null };
}
/** Several ad accounts for one client (comma-separated ids) — sums the month. */
export async function metaInsightsMany(ids: string, since: string, until: string) {
  const list = String(ids).split(',').map((x) => x.trim()).filter(Boolean); const parts = await Promise.all(list.map((id) => metaInsights(id, since, until)));
  const sum = (k: string) => parts.reduce((a, p: any) => a + (Number(p[k]) || 0), 0);
  const spend = sum('spend'), leads = sum('leads'), clicks = sum('clicks'), impressions = sum('impressions');
  return { spend, impressions, clicks, reach: sum('reach'), ctr: impressions ? Math.round((clicks / impressions) * 10000) / 100 : 0, leads, conversations: sum('conversations'), cpl: leads ? Math.round((spend / leads) * 100) / 100 : null, accounts: list.length };
}
export async function metaDaily(account: string, days = 8) {
  const until = new Date(); const since = new Date(Date.now() - days * 864e5); const f = (d: Date) => d.toISOString().slice(0, 10);
  const j = await g(`act_${account.replace(/^act_/, '')}/insights`, { fields: 'spend,actions', time_range: JSON.stringify({ since: f(since), until: f(until) }), time_increment: '1', level: 'account' });
  const acc = await g(`act_${account.replace(/^act_/, '')}`, { fields: 'account_status,disable_reason,spend_cap,amount_spent,name' });
  return { days: (j.data ?? []).map((d: any) => ({ date: d.date_start, spend: Number(d.spend ?? 0), leads: (d.actions ?? []).filter((a: any) => LEAD.slice(0, 3).includes(a.action_type)).reduce((s: number, a: any) => s + Number(a.value), 0) })), account: acc };
}
