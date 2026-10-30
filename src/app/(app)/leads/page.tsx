import Link from 'next/link';
import { safeList } from '@/lib/api';
import { LeadForm } from './lead-form';
import { SheetButton } from '@/components/sheet';
import { serviceLabel } from '@/lib/services';
import { fmtMoney } from '@/lib/format';
// Sales pipeline: every lead is a card; clicking opens it in a sheet over the board.
const COLS: [string, string, string[]][] = [['חדש', 'לחזור ללקוח', ['new']], ['בירור צורך', 'בריף ושאלות', ['scoping']], ['הצעה בהכנה', 'סוכנים + מחיר שלך', ['proposal_drafting', 'pending_approval']],
  ['מוכן לשליחה', 'לשלוח ללקוח', ['ready_to_send']], ['אצל הלקוח', 'נשלחה / מו״מ', ['sent', 'negotiation']], ['נסגר 🎉', 'עסקה נפתחה', ['engaged']]];
const ago = (d: string) => { const h = (Date.now() - +new Date(d)) / 36e5; return h < 1 ? 'עכשיו' : h < 24 ? `לפני ${Math.round(h)} שע׳` : `לפני ${Math.round(h / 24)} ימים`; };
export default async function Leads({ searchParams }: { searchParams: Promise<{ lost?: string }> }) {
  const sp = await searchParams; const leads = await safeList<any>('leads', { _active: true }, 500);
  const open = leads.filter((l) => !['lost', 'archived'].includes(l.stage)); const lost = leads.filter((l) => l.stage === 'lost');
  const won = leads.filter((l) => l.stage === 'engaged').length; const rate = leads.length ? Math.round((won / Math.max(1, won + lost.length)) * 100) : 0;
  const stale = open.filter((l) => l.stage === 'new' && Date.now() - +new Date(l.updated_at ?? l.created_at) > 2 * 864e5).length;
  return <div className="pipe">
    <section className="pg-head"><div><h1>לידים <span className="mark">ומכירות</span></h1><p>ליד ← בריף ← הצעה ← חתימה ← עסקה. לחיצה על כרטיס פותחת אותו כאן, בלי לעזוב את הלוח.</p></div>
      <SheetButton label="＋ ליד חדש" title="ליד חדש"><LeadForm /></SheetButton></section>
    <div className="kpis">
      <div className="kpi"><b>{open.filter((l) => l.stage !== 'engaged').length}</b><span>לידים פתוחים</span></div>
      <div className={`kpi${stale ? ' hot' : ''}`}><b>{stale}</b><span>חדשים בלי מענה 48+ שע׳</span></div>
      <div className="kpi"><b>{open.filter((l) => ['sent', 'negotiation'].includes(l.stage)).length}</b><span>הצעות אצל לקוחות</span></div>
      <div className="kpi"><b>{won}</b><span>עסקאות שנסגרו</span></div>
      <div className="kpi"><b>{rate}%</b><span>אחוז סגירה</span></div>
    </div>
    {leads.length ? <div className="board">{COLS.map(([t, sub, st]) => { const items = open.filter((l) => st.includes(l.stage));
      return <section key={t} className="board-col"><header><b>{t}</b><span>{sub}</span><i>{items.length}</i></header>
        {items.map((l) => <Link key={l.id} href={`/leads/${l.id}`} scroll={false} className="board-card">
          <div className="bc-h"><span className="av">{(l.company ?? '?').slice(0, 1)}</span><div><b>{l.company}</b><small>{l.contact_name ?? ''}{l.industry ? ` · ${l.industry}` : ''}</small></div></div>
          {(l.requested_services ?? []).length > 0 && <div className="bc-tags">{l.requested_services.slice(0, 3).map((s: string) => <span key={s}>{serviceLabel(s)}</span>)}</div>}
          <div className="bc-f"><span>{ago(l.updated_at ?? l.created_at)}</span>{l.client_budget ? <span>תקציב {fmtMoney(l.client_budget)}</span> : null}{l.source && l.source !== 'manual' ? <span className="src">{l.source === 'loud_intake' ? '🎙 LOUD' : l.source}</span> : null}</div>
        </Link>)}{!items.length && <div className="board-empty">—</div>}</section>; })}</div>
      : <div className="onb"><h2>עוד אין לידים</h2><p>הוסף ליד ראשון — המערכת תוביל אותך מבריף, דרך הצעת מחיר ממותגת וחתימה דיגיטלית, ועד פתיחת לקוח ואבני דרך.</p></div>}
    {lost.length > 0 && <details className="lost" open={!!sp.lost}><summary>לידים שלא נסגרו ({lost.length})</summary><div className="lost-l">{lost.map((l) => <Link key={l.id} href={`/leads/${l.id}`} scroll={false}>{l.company}</Link>)}</div></details>}
  </div>;
}
