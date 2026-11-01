import { safeList, me, rpc } from '@/lib/api';
import { Hero, Table, When } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/client';
export default async function Usage() {
  const m = await me(); const [usage, budgets, ks, audit, clients] = await Promise.all([safeList('usage_entries', {}, 500), safeList('budgets'), safeList('kill_switches'), safeList('audit_events', {}, 100), safeList('clients')]);
  const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  const by = (k: string) => Object.entries(usage.reduce((a: any, u: any) => { const key = (k === 'client_id' ? cn[u[k]] : u[k]) ?? '—'; a[key] = a[key] ?? { n: 0, inp: 0, out: 0, cost: 0, unknown: 0 }; a[key].n++; a[key].inp += Number(u.input_units ?? 0); a[key].out += Number(u.output_units ?? 0); if (u.cost_usd === null) a[key].unknown++; else a[key].cost += Number(u.cost_usd); return a; }, {}));
  const sys = ks.find((k: any) => k.scope_type === 'system');
  const sm: any = ['owner', 'admin'].includes(m.role) ? await rpc<any>('office_usage_summary').catch(() => null) : null; const usd = (n: any) => `$${Number(n ?? 0).toFixed(2)}`;
  return <>
    <Hero title={<>שימוש, <span className="mark">עלויות ופעילות</span></>} sub="עלות מדווחת, מחושבת והערכה מוצגות בנפרד. כשספק לא מדווח עלות — מוצגות יחידות בלבד, בלי דיוק מדומה." />
    {sm && <><div className="kpis us-kpis">
      <div className="kpi"><small>היום</small><b>{usd(sm.today)}</b></div>
      <div className="kpi"><small>7 ימים אחרונים</small><b>{usd(sm.week)}</b></div>
      <div className="kpi"><small>מתחילת החודש</small><b>{usd(sm.month)}</b>{sm.limit ? <span>מתוך תקרה {usd(sm.limit)}</span> : null}</div>
      <div className="kpi"><small>צפי לסוף החודש</small><b className={sm.limit && sm.projected > sm.limit ? 'bad' : ''}>{usd(sm.projected)}</b><span>לפי הקצב עד עכשיו</span></div></div>
</>}
    <div className="grid g2">
      <div className="card"><h2>לפי ספק</h2><Table head={['ספק', 'קריאות', 'יחידות קלט/פלט', 'עלות מדווחת', 'ללא נתון עלות']} rows={by('provider').map(([k, v]: any) => [k, v.n, `${v.inp}/${v.out}`, `$${v.cost.toFixed(2)}`, v.unknown])} /></div>
      <div className="card"><h2>לפי לקוח</h2><Table head={['לקוח', 'קריאות', 'עלות מדווחת', 'ללא נתון']} rows={by('client_id').map(([k, v]: any) => [k, v.n, `$${v.cost.toFixed(2)}`, v.unknown])} /></div>
      <div className="card"><h2>עלות לפי סוכן — החודש</h2><Table head={['סוכן', 'קריאות', 'עלות']} rows={(sm?.agents ?? []).map((a: any) => [a.agent, a.n, usd(a.cost)])} empty="אין שימוש החודש" /></div>
      <div className="card"><h2>מגבלות ועצירה</h2>
        <Table head={['היקף', 'תקרה חודשית', 'עצירה קשיחה']} rows={budgets.map((b: any) => [`${b.scope_type}:${b.scope_ref}`, `$${b.monthly_limit_usd}`, b.hard_stop ? 'כן' : 'לא'])} />
        {m.role === 'owner' && <ActionForm action="set_budget" extra={{ scope_type: 'org', scope_ref: 'org' }} submit="עדכן תקרה" fields={[{ name: 'monthly_limit_usd', label: 'תקרה חודשית למשרד ($)', type: 'number', required: true }]} />}
        <p className="small muted">בדיקת תקציב לפני כל שלב והתאמה לעלות המדווחת אחריו. פעולה שכבר יצאה לספק עשויה להמשיך לחיוב.</p>
        <div className="row" style={{ marginTop: 10 }}>{sys?.active ? <ActionButton className="btn y" action="set_kill_switch" payload={{ scope_type: 'system', scope_ref: 'all', active: false }}>בטל עצירת מערכת</ActionButton>
          : <ActionButton className="btn danger" action="set_kill_switch" payload={{ scope_type: 'system', scope_ref: 'all', active: true, reason: 'עצירה ידנית' }} confirm="לעצור את כל הסוכנים? עבודה שבוצעה לא תימחק.">עצירת מערכת</ActionButton>}</div>
        <Table head={['עצירה', 'פעיל', 'סיבה']} rows={ks.map((k: any) => [`${k.scope_type}:${k.scope_ref}`, k.active ? 'כן' : 'לא', k.reason ?? ''])} /></div></div>
    <div className="card" style={{ marginTop: 16 }}><h2>יומן ביקורת</h2><Table head={['מתי', 'מבצע', 'פעולה', 'ישות']} rows={audit.map((a: any) => [<When key="w" d={a.created_at} />, `${a.actor_type}:${String(a.actor_id ?? '').slice(0, 8)}`, a.action, `${a.entity ?? ''} ${String(a.entity_id ?? '').slice(0, 8)}`])} /></div>
  </>;
}
