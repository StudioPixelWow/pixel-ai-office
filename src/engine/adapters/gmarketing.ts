import 'server-only';
import { w } from '@/engine/db';
import { seal, unseal } from '@/lib/crypto';
import { redirectUri } from './gcal';
// Google Ads (via the PIXEL MCC) + GA4 — read-only. Separate OAuth grant from the calendar; developer token / MCC id are set by the owner in Vercel.
export const P = 'google_marketing';
export const MSCOPES = ['https://www.googleapis.com/auth/adwords', 'https://www.googleapis.com/auth/analytics.readonly', 'openid', 'email'];
const ADS_V = process.env.GOOGLE_ADS_API_VERSION ?? 'v26';
export const adsConfigured = () => !!(process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_MCC_ID);
export function marketingAuthUrl(origin: string, state: string) {
  const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(origin), response_type: 'code', scope: MSCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account', state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}
export async function marketingExchange(origin: string, code: string) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri(origin), grant_type: 'authorization_code' }) });
  const j: any = await r.json().catch(() => ({})); if (!r.ok || !j.refresh_token) throw new Error(j.error_description || j.error || 'no_refresh_token');
  let email = ''; try { email = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString()).email ?? ''; } catch {}
  await w('office_worker_oauth_save', { p_provider: P, p_account: email, p_token_enc: seal(JSON.stringify({ refresh_token: j.refresh_token })), p_scopes: j.scope ?? '' });
  return email;
}
let cached: { t: string; at: number } | null = null;
export async function marketingToken(): Promise<string | null> {
  if (cached && Date.now() - cached.at < 40 * 60_000) return cached.t;
  const t: any = await w('office_worker_oauth_get', { p_provider: P }); if (!t?.token_enc) return null;
  const { refresh_token } = JSON.parse(unseal(t.token_enc));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: 'refresh_token' }) });
  const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`refresh: ${j.error ?? r.status}`);
  cached = { t: j.access_token, at: Date.now() }; return j.access_token;
}
// ── GA4
export async function ga4Properties(): Promise<{ id: string; name: string; account: string }[]> {
  const t = await marketingToken(); if (!t) return [];
  const r = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', { headers: { authorization: `Bearer ${t}` } });
  const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`ga4 admin ${r.status}: ${j.error?.message ?? ''}`.slice(0, 240));
  return (j.accountSummaries ?? []).flatMap((a: any) => (a.propertySummaries ?? []).map((p: any) => ({ id: String(p.property).replace('properties/', ''), name: p.displayName, account: a.displayName })));
}
export async function ga4Month(property: string, start: string, end: string) {
  const t = await marketingToken(); if (!t) throw new Error('not_connected');
  const run = async (body: any) => { const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`ga4 ${r.status}: ${j.error?.message ?? ''}`.slice(0, 240)); return j; };
  const tot = await run({ dateRanges: [{ startDate: start, endDate: end }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'keyEvents' }, { name: 'engagementRate' }] });
  const ch = await run({ dateRanges: [{ startDate: start, endDate: end }], dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], limit: 6, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] });
  const v = (tot.rows?.[0]?.metricValues ?? []).map((x: any) => Number(x.value));
  return { sessions: v[0] ?? 0, users: v[1] ?? 0, key_events: v[2] ?? 0, engagement_rate: v[3] != null ? Math.round(v[3] * 1000) / 10 : null,
    channels: (ch.rows ?? []).map((r: any) => ({ channel: r.dimensionValues[0].value, sessions: Number(r.metricValues[0].value) })) };
}
// ── Google Ads
async function gaql(customer: string, query: string) {
  const t = await marketingToken(); if (!t) throw new Error('not_connected'); if (!adsConfigured()) throw new Error('developer_token_missing');
  const r = await fetch(`https://googleads.googleapis.com/${ADS_V}/customers/${customer.replace(/-/g, '')}/googleAds:searchStream`, { method: 'POST',
    headers: { authorization: `Bearer ${t}`, 'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!, 'login-customer-id': process.env.GOOGLE_ADS_MCC_ID!.replace(/-/g, ''), 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
  const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`google ads ${r.status}: ${(Array.isArray(j) ? j[0] : j)?.error?.message ?? ''}`.slice(0, 260));
  return (Array.isArray(j) ? j : [j]).flatMap((b: any) => b.results ?? []);
}
export async function adsClients(): Promise<{ id: string; name: string; manager: boolean; status: string }[]> {
  const rows = await gaql(process.env.GOOGLE_ADS_MCC_ID!, 'SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.status, customer_client.level FROM customer_client WHERE customer_client.level <= 2');
  return rows.map((r: any) => ({ id: String(r.customerClient.id), name: r.customerClient.descriptiveName ?? '', manager: !!r.customerClient.manager, status: r.customerClient.status })).filter((x: any) => !x.manager);
}
export async function adsMonth(customer: string, start: string, end: string) {
  const rows = await gaql(customer, `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.ctr FROM customer WHERE segments.date BETWEEN '${start}' AND '${end}'`);
  const s = rows.reduce((a: any, r: any) => ({ cost: a.cost + Number(r.metrics?.costMicros ?? 0) / 1e6, imp: a.imp + Number(r.metrics?.impressions ?? 0), clk: a.clk + Number(r.metrics?.clicks ?? 0), conv: a.conv + Number(r.metrics?.conversions ?? 0) }), { cost: 0, imp: 0, clk: 0, conv: 0 });
  return { spend: Math.round(s.cost * 100) / 100, impressions: s.imp, clicks: s.clk, conversions: Math.round(s.conv * 10) / 10, ctr: s.imp ? Math.round((s.clk / s.imp) * 10000) / 100 : null, cpa: s.conv ? Math.round((s.cost / s.conv) * 100) / 100 : null };
}
export async function adsDaily(customer: string) {
  const rows = await gaql(customer, `SELECT segments.date, metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date DURING LAST_14_DAYS`);
  return rows.map((r: any) => ({ date: r.segments.date, spend: Number(r.metrics?.costMicros ?? 0) / 1e6, conversions: Number(r.metrics?.conversions ?? 0) }));
}
