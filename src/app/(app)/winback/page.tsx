import { rpc, me } from '@/lib/api';
import { Empty } from '@/components/ui';
import { Winback } from './winback';
export const dynamic = 'force-dynamic';
export default async function WinbackPage() {
  const m = await me(); if (!['owner', 'admin', 'account_manager'].includes(m.role)) return <Empty>זמין לבעלים ולמנהלי לקוחות בלבד.</Empty>;
  const rows = await rpc<any[]>('office_winback').catch(() => []);
  return <Winback rows={rows} />;
}
