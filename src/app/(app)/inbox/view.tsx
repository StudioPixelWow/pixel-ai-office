'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';
import { ago } from '@/lib/format';

const KIND: Record<string, string> = { request: 'בקשה', approval: 'אישור', feedback: 'משוב', complaint: 'תלונה', payment: 'תשלום', meeting: 'פגישה', lead: 'פנייה חדשה', info: 'מידע' };
const ST: Record<string, [string, string]> = { needs_match: ['להתאים ללקוח', 'yellow'], task: ['נפתחה משימה', 'ok'], lead: ['ליד חדש', 'cyan'], info: ['מידע בלבד', 'muted'], dismissed: ['לא רלוונטי', 'muted'], new: ['חדש', 'muted'] };
const TABS: [string, string][] = [['needs_match', 'להתאים'], ['task', 'משימות'], ['lead', 'לידים'], ['info', 'מידע'], ['all', 'הכל']];
// איריס — what the inbox agent did with every new email; match unknown senders to a client in one click (it learns).
export function InboxView({ d }: { d: any }) {
  const r = useRouter(); const items: any[] = d.items ?? []; const c = d.counts ?? {};
  const [tab, setTab] = useState(items.some((x) => x.status === 'needs_match') ? 'needs_match' : 'all'); const [pick, setPick] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const run = async (id: string, action: string, extra: any = {}) => { setBusy(id + action); setMsg(''); try { const x = await callAction(action, { id, ...extra }); setMsg(x?.note ?? 'עודכן'); r.refresh(); } catch (e) { setMsg(heError(e)); } finally { setBusy(''); } };
  const shown = items.filter((x) => tab === 'all' || x.status === tab);
  return <>
    <div className="hero"><h1>דואר <span className="mark">נכנס</span></h1>
      <p>איריס קוראת כל מייל חדש שמגיע ל-office@ (בקריאה בלבד: היא לא עונה, לא מסמנת ולא מוחקת). כל מייל שדורש פעולה הופך למשימת מעקב אצל הלקוח הנכון.
        {d.state?.started_at ? ` פעילה מ-${new Date(d.state.started_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' })}.` : ' תתחיל לעבוד בדקות הקרובות, ומאותו רגע תקרא רק מיילים חדשים.'}</p></div>
    <div className="acc-bar"><div className="tabs" style={{ margin: 0 }}>{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k !== 'all' && c[k] ? ` (${c[k]})` : ''}</button>)}</div></div>
    {msg && <p className="small acc-msg">{msg}</p>}
    <div className="ib-list">{shown.map((x) => { const [sl, st] = ST[x.status] ?? [x.status, 'muted']; const sel = pick[x.id] ?? x.suggested_client ?? '';
      return <div key={x.id} className={`card ib ${x.kind === 'complaint' ? 'hot' : ''}`}>
        <div className="ib-h"><div className="sp"><b>{x.subject || '(ללא נושא)'}</b><small>{x.from_name ? `${x.from_name} · ` : ''}<span dir="ltr">{x.from_email}</span> · {ago(x.received_at)}</small></div>
          {x.kind && <span className="badge">{KIND[x.kind] ?? x.kind}</span>}<span className={`badge ${st}`}>{sl}</span></div>
        {x.summary && <p className="ib-sum">{x.summary}</p>}
        <div className="ib-f">
          {x.client ? <Link href={`/clients/${x.client_id}`} className="badge cyan">{x.client}{x.match_by ? ` · ${({ contact: 'איש קשר', lead: 'ליד', learned: 'שולח מוכר', domain: 'דומיין', manual: 'שויך ידנית' } as any)[x.match_by] ?? x.match_by}` : ''}</Link>
            : x.status !== 'info' && x.status !== 'dismissed' && <>
              <select value={sel} onChange={(e) => setPick({ ...pick, [x.id]: e.target.value })} aria-label="לקוח"><option value="">בחר לקוח…</option>{(d.clients ?? []).map((k: any) => <option key={k.id} value={k.id}>{k.name}{k.id === x.suggested_client ? ' (הצעה)' : ''}</option>)}</select>
              <button className="btn sm y" disabled={!sel || !!busy} onClick={() => run(x.id, 'inbox_assign', { client_id: sel })}>שייך</button>
              <button className="btn sm" disabled={!!busy} onClick={() => run(x.id, 'inbox_lead')}>צור ליד</button></>}
          {x.todo_title && <span className="small ib-todo">✓ משימה: {x.todo_title}{x.todo_status !== 'open' ? ` (${x.todo_status === 'done' ? 'בוצעה' : 'בוטלה'})` : ''}</span>}
          <span className="sp" />{x.status !== 'dismissed' && <button className="btn sm ghost" disabled={!!busy} onClick={() => run(x.id, 'inbox_dismiss')}>לא רלוונטי</button>}
        </div></div>; })}
      {!shown.length && <p className="muted">{items.length ? 'אין מיילים בתצוגה הזו.' : 'עוד לא הגיעו מיילים חדשים מאז שאיריס הופעלה.'}</p>}</div>
  </>;
}
