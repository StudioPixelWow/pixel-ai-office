import { rpc, me } from '@/lib/api';
import { Empty } from '@/components/ui';
import { InboxView } from './view';
export const dynamic = 'force-dynamic';
export default async function Inbox() {
  const m = await me(); if (!['owner', 'admin', 'account_manager'].includes(m.role)) return <Empty>זמין לבעלים ולמנהלי לקוחות בלבד.</Empty>;
  const d = await rpc<any>('office_inbox', { p_status: null, p_mailbox: null }).catch(() => null);
  return <InboxView d={d ?? { items: [], clients: [], counts: {} }} />;
}
