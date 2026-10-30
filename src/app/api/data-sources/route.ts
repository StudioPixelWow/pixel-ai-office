import { NextResponse } from 'next/server';
import { me } from '@/lib/api';
import { metaConfigured, metaAdAccounts, metaCheck } from '@/engine/adapters/meta';
import { adsConfigured, adsClients, ga4Properties, marketingToken } from '@/engine/adapters/gmarketing';
export const maxDuration = 60;
// Lists the ad accounts / GA4 properties the office can read, for mapping to clients. Never returns tokens.
export async function GET() {
  const m = await me(); if (!['owner', 'admin', 'account_manager'].includes(m.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const hasG = !!(await marketingToken().catch(() => null));
  const [meta, ads, ga4, mc] = await Promise.all([
    metaConfigured() ? metaAdAccounts().catch((e) => ({ error: e.message })) : null,
    hasG && adsConfigured() ? adsClients().catch((e) => ({ error: e.message })) : null,
    hasG ? ga4Properties().catch((e) => ({ error: e.message })) : null,
    metaConfigured() ? metaCheck() : null]);
  return NextResponse.json({ meta: { configured: metaConfigured(), check: mc, accounts: meta }, google: { connected: hasG, ads_configured: adsConfigured(), ads: ads, ga4: ga4 } });
}
