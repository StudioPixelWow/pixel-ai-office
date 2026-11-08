import { headers } from 'next/headers';
import { rpc } from '@/lib/api';
import { intakeUrl } from '@/lib/loud';
import { LoudBoard } from './board';
import { LoudLeads } from './leads-panel';
export const dynamic = 'force-dynamic';
export default async function Loud() {
  const [d, h, leads] = await Promise.all([rpc<any>('office_studio_board').catch((e) => ({ error: String(e?.message ?? e) })), headers(), rpc<any[]>('office_loud_leads').catch(() => [])]);
  const origin = `${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host')}`;
  if ((d as any).error) return <div className="card">לא ניתן לטעון את האולפן: {(d as any).error}</div>;
  return <><LoudLeads leads={leads ?? []} /><LoudBoard d={d} intake={intakeUrl(origin)} /></>;
}
