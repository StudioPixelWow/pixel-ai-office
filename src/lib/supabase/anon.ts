import { createClient } from '@supabase/supabase-js';
// Anon client for the worker/runner/webhooks. It carries NO privileges: every call is a DB function
// that authenticates with a secret whose hash lives in the DB, and only performs scoped state transitions.
export function supabaseAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
