import 'server-only';
// Meta Marketing API — read-only (ads_read) via a System User token the owner sets in Vercel (META_SYSTEM_TOKEN).
const V = process.env.META_GRAPH_VERSION ?? 'v26.0';
export const metaConfigured = () => !!process.env.META_SYSTEM_TOKEN;
async function g(path: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams({ ...params, access_token: process.env.META_SYSTEM_TOKEN! });
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
export async function metaDaily(account: string, days = 8) {
  const until = new Date(); const since = new Date(Date.now() - days * 864e5); const f = (d: Date) => d.toISOString().slice(0, 10);
  const j = await g(`act_${account.replace(/^act_/, '')}/insights`, { fields: 'spend,actions', time_range: JSON.stringify({ since: f(since), until: f(until) }), time_increment: '1', level: 'account' });
  const acc = await g(`act_${account.replace(/^act_/, '')}`, { fields: 'account_status,disable_reason,spend_cap,amount_spent,name' });
  return { days: (j.data ?? []).map((d: any) => ({ date: d.date_start, spend: Number(d.spend ?? 0), leads: (d.actions ?? []).filter((a: any) => LEAD.slice(0, 3).includes(a.action_type)).reduce((s: number, a: any) => s + Number(a.value), 0) })), account: acc };
}
