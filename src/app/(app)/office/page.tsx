import { rpc, safeList } from '@/lib/api';
import { OfficeFloor } from './floor';
export default async function OfficePage() {
  const [board, defs, clients] = await Promise.all([rpc<any[]>('office_agent_board'), safeList('agent_definitions', {}, 200), safeList('clients', { _active: true }, 300)]);
  const avatars = Object.fromEntries(defs.map((d: any) => [d.id, d.avatar_blob_id]));
  const conns = await safeList('connection_capabilities', {}, 500);
  const ready = Array.from(new Set(conns.filter((c: any) => ['access_verified', 'action_tested'].includes(c.status)).map((c: any) => c.capability)));
  return <OfficeFloor board={board} avatars={avatars} clients={clients.map((c: any) => ({ id: c.id, name: c.name }))} readyCaps={ready} />;
}
