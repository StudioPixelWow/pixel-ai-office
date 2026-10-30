import Link from 'next/link';
import { me, today } from '@/lib/api';
import { Nav, MobileBar, LOGO_WHITE } from '@/components/nav';
import { LiveRefresh } from '@/components/client';

export const dynamic = 'force-dynamic';
const ROLE: Record<string, string> = { owner: 'Owner', admin: 'מנהל מערכת', account_manager: 'מנהל לקוח', employee: 'עובד', viewer: 'צופה' };
export default async function AppLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const [m, t] = await Promise.all([me(), today()]); const d = { waiting_me: Number(t?.action_count ?? 0) }; const liveN = (t?.live ?? []).length;
  return <div className="shell">
    <MobileBar waiting={d.waiting_me} />
    <aside className="side" id="side"><div className="logo"><img src={LOGO_WHITE} alt="Pixel Digital" /><b>AI OFFICE</b></div>
      <Nav waiting={Number(d.waiting_me ?? 0)} /></aside>
    <div className="main">
      <header className="top">
        <Link className="btn y" href="/talk">＋ משימה לסוכנים</Link>
        <Link className={`btn ${d.waiting_me ? 'c' : ''}`} href="/approvals">לטיפולי{d.waiting_me ? ` · ${d.waiting_me}` : ' ✓'}</Link>
        <Link className="btn ghost top-live" href="/office"><span className="cc-pulse" />{liveN ? `${liveN} סוכנים עובדים` : 'המשרד זמין'}</Link>
        <LiveRefresh />
        <span className="who">{m.email} · {ROLE[m.role]} · <a href="/auth/signout">יציאה</a></span>
      </header>
      <main className="page" id="main">{children}</main>{modal}
    </div></div>;
}
