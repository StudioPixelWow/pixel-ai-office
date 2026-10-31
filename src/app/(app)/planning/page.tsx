import { rpc } from '@/lib/api';
import { Empty } from '@/components/ui';
import { WorkBoard } from './board';
export const dynamic = 'force-dynamic';
export default async function Planning() {
  const d = await rpc<any>('office_work_board').catch(() => null);
  if (!d) return <Empty>לא הצלחתי לטעון את הפרויקטים והמשימות.</Empty>;
  return <WorkBoard d={d} />;
}
