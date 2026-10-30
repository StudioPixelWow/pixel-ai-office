import 'server-only';
import { w } from '@/engine/db';
import { seal, unseal } from '@/lib/crypto';
// Google Calendar two-way sync. OAuth client id/secret are set by the owner in Vercel; tokens are encrypted before storage.
const P = 'google_calendar';
export const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly', 'openid', 'email'];
export const gcalConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const redirectUri = (origin: string) => `${origin.replace(/\/$/, '')}/api/google/callback`;
export function authUrl(origin: string, state: string) {
  const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(origin), response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}
export async function exchangeCode(origin: string, code: string) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri(origin), grant_type: 'authorization_code' }) });
  const j: any = await r.json().catch(() => ({})); if (!r.ok || !j.refresh_token) throw new Error(j.error_description || j.error || 'no_refresh_token');
  let email = ''; try { email = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString()).email ?? ''; } catch {}
  // first account = primary (also receives office meetings); every other account is an extra calendar feeding the office calendar
  const list: any[] = await w('office_worker_oauth_list', {});
  const primary = list.find((a) => a.primary);
  const provider = !primary || primary.account === email ? P : `${P}:${email.toLowerCase()}`;
  await w('office_worker_oauth_save', { p_provider: provider, p_account: email, p_token_enc: seal(JSON.stringify({ refresh_token: j.refresh_token })), p_scopes: j.scope ?? '' });
  return email;
}
async function accessToken(t: any): Promise<{ token: string; cal: string; last?: string } | null> {
  if (!t?.token_enc) return null;
  const { refresh_token } = JSON.parse(unseal(t.token_enc));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, grant_type: 'refresh_token' }) });
  const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(`refresh: ${j.error ?? r.status}`);
  return { token: j.access_token, cal: t.calendar_id || 'primary', last: t.last_sync_at };
}
const api = (cal: string, path = '') => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events${path}`;
function toEvent(m: any) {
  const tz = 'Asia/Jerusalem';
  const d = (s: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(s));
  return { summary: m.title, location: m.location ?? undefined, description: m.description ?? undefined,
    start: m.all_day ? { date: d(m.starts_at) } : { dateTime: new Date(m.starts_at).toISOString(), timeZone: tz },
    end: m.all_day ? { date: d(new Date(new Date(m.ends_at ?? m.starts_at).getTime() + 864e5).toISOString()) } : { dateTime: new Date(m.ends_at ?? m.starts_at).toISOString(), timeZone: tz },
    extendedProperties: { private: { pixel_meeting_id: m.id } } };
}
export async function gcalSync() {
  if (!gcalConfigured()) return { skipped: 'not_configured' };
  const accounts: any[] = await w('office_worker_oauth_list', {}); if (!accounts.length) return { skipped: 'not_connected' };
  const out: any[] = [];
  for (const acc of accounts) {
    const prov = acc.provider as string; let at;
    try { at = await accessToken(acc); } catch (e: any) { await w('office_worker_oauth_status', { p_provider: prov, p_error: String(e.message).slice(0, 200) }).catch(() => null); out.push({ account: acc.account, error: e.message }); continue; }
    if (!at) continue;
    const H = { authorization: `Bearer ${at.token}`, 'content-type': 'application/json' }; let pushed = 0, pulled = 0;
    try {
      if (acc.primary) {
        // push office → primary Google calendar
        const pend: any[] = await w('office_worker_calendar_pending', {});
        for (const m of pend) {
          try {
            let id = m.external_event_id as string | null;
            if (m.status === 'cancelled') { if (id) await fetch(api(at.cal, `/${encodeURIComponent(id)}`), { method: 'DELETE', headers: H }); }
            else {
              const r = await fetch(id ? api(at.cal, `/${encodeURIComponent(id)}`) : api(at.cal), { method: id ? 'PATCH' : 'POST', headers: H, body: JSON.stringify(toEvent(m)) });
              const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? String(r.status)); id = j.id;
            }
            await w('office_worker_calendar_mark', { p_id: m.id, p_external: id, p_state: 'synced', p_error: null }); pushed++;
          } catch (e: any) { await w('office_worker_calendar_mark', { p_id: m.id, p_external: null, p_state: 'error', p_error: String(e.message).slice(0, 200) }); }
        }
      }
      // pull Google → office (changes since last sync, window −7…+90 days); duplicates across accounts are merged in the DB
      const q = new URLSearchParams({ singleEvents: 'true', maxResults: '250', timeMin: new Date(Date.now() - 7 * 864e5).toISOString(), timeMax: new Date(Date.now() + 90 * 864e5).toISOString(), showDeleted: 'true' });
      if (acc.last_sync_at) q.set('updatedMin', new Date(new Date(acc.last_sync_at).getTime() - 5 * 60e3).toISOString());
      const r = await fetch(`${api(at.cal)}?${q}`, { headers: H }); const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message ?? String(r.status));
      const evs = (j.items ?? []).filter((e: any) => !e.extendedProperties?.private?.pixel_meeting_id).map((e: any) => ({ id: e.id, ical_uid: e.iCalUID, status: e.status, title: e.summary, location: e.location, description: e.description, updated: e.updated,
        all_day: !!e.start?.date, start: e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00+02:00` : null), end: e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00+02:00` : null),
        attendees: (e.attendees ?? []).map((a: any) => ({ email: a.email, name: a.displayName, status: a.responseStatus })) })).filter((e: any) => e.status === 'cancelled' || e.start);
      pulled = await w('office_worker_calendar_pull2', { p_account: acc.account, p_events: evs });
      await w('office_worker_oauth_status', { p_provider: prov, p_error: null });
      out.push({ account: acc.account, pushed, pulled });
    } catch (e: any) { await w('office_worker_oauth_status', { p_provider: prov, p_error: String(e.message).slice(0, 200) }).catch(() => null); out.push({ account: acc.account, error: e.message, pushed, pulled }); }
  }
  return { accounts: out };
}
