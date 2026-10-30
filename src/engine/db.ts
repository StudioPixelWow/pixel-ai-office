import 'server-only';
import { supabaseAnon } from '@/lib/supabase/anon';
const SECRET = () => { const s = process.env.WORKER_SECRET || process.env.CRON_SECRET; if (!s) throw new Error('CRON_SECRET missing'); return s; };
export async function w<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAnon().rpc(fn, { p_secret: SECRET(), ...args });
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}
