import 'server-only';
import { supabaseServer } from './supabase/server';
import { redirect } from 'next/navigation';

export type Me = { user_id: string; email: string; role: 'owner' | 'admin' | 'account_manager' | 'employee' | 'viewer'; org_id: string; permissions: string[]; org: Record<string, unknown> };

export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    if (/not_authenticated|JWT/.test(error.message)) redirect('/login');
    throw new Error(error.message);
  }
  return data as T;
}
export async function list<T = Record<string, any>>(entity: string, filters: Record<string, unknown> = {}, limit = 200): Promise<T[]> {
  return rpc<T[]>('office_list', { p_entity: entity, p_filters: filters, p_limit: limit, p_offset: 0 });
}
export async function get<T = Record<string, any>>(entity: string, id: string): Promise<T | null> {
  return rpc<T | null>('office_get', { p_entity: entity, p_id: id });
}
export async function me(): Promise<Me> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');
  const { data, error } = await sb.rpc('office_me');
  if (error) {
    if (/no_membership/.test(error.message)) {
      const b = await sb.rpc('office_bootstrap');
      if (b.error) redirect('/login?e=' + encodeURIComponent(b.error.message));
      const again = await sb.rpc('office_me'); return again.data as Me;
    }
    throw new Error(error.message);
  }
  return data as Me;
}
export async function safeList<T = Record<string, any>>(entity: string, filters: Record<string, unknown> = {}, limit = 200): Promise<T[]> {
  try { return await list<T>(entity, filters, limit); } catch { return []; }
}
