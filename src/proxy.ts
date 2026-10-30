import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Every page requires a session. Public: /login, /auth/*, worker/webhook/avatar endpoints (they authenticate themselves).
const PUBLIC = [/^\/login/, /^\/pay\//, /^\/p\//, /^\/api\/public\//, /^\/auth\//, /^\/api\/worker\//, /^\/api\/webhooks\//, /^\/api\/avatar\//, /^\/api\/avatars\/import/, /^\/api\/health/, /^\/_next\//, /^\/favicon/];
export async function proxy(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  if (PUBLIC.some((r) => r.test(req.nextUrl.pathname))) return res;
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => req.cookies.getAll(), setAll: (l) => l.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    if (req.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return res;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
