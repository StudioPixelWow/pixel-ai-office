import Link from 'next/link';
import { me, rpc } from '@/lib/api';
import { Nav } from '@/components/nav';
import { LiveRefresh } from '@/components/client';

export const dynamic = 'force-dynamic';
const ROLE: Record<string, string> = { owner: 'Owner', admin: 'מנהל מערכת', account_manager: 'מנהל לקוח', employee: 'עובד', viewer: 'צופה' };
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const m = await me();
  const d = await rpc<any>('office_dashboard').catch(() => ({ waiting_me: 0 }));
  return <div className="shell">
    <aside className="side"><div className="logo"><img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-500.webp" alt="Pixel Digital" /><b>AI OFFICE</b></div>
      <Nav waiting={Number(d.waiting_me ?? 0)} /></aside>
    <div className="main">
      <header className="top">
        <Link className="btn y" href="/talk">תן משימה</Link><Link className="btn" href="/automations">אוטומציות</Link>
        <Link className="btn" href="/office">העבודה במשרד</Link><Link className="btn c" href="/approvals">ממתין לאישור שלי ({d.waiting_me ?? 0})</Link>
        <LiveRefresh />
        <span className="who">{m.email} · {ROLE[m.role]} · <a href="/auth/signout">יציאה</a></span>
      </header>
      <main className="page" id="main">{children}</main>
    </div></div>;
}
