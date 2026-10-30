import { safeList, me } from '@/lib/api';
import { Hero, Table, When } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/client';
export default async function Usage() {
  const m = await me(); const [usage, budgets, ks, audit, clients] = await Promise.all([safeList('usage_entries', {}, 500), safeList('budgets'), safeList('kill_switches'), safeList('audit_events', {}, 100), safeList('clients')]);
  const cn = Object.fromEntries(clients.map((c: any) => [c.id, c.name]));
  const by = (k: string) => Object.entries(usage.reduce((a: any, u: any) => { const key = (k === 'client_id' ? cn[u[k]] : u[k]) ?? '—'; a[key] = a[key] ?? { n: 0, inp: 0, out: 0, cost: 0, unknown: 0 }; a[key].n++; a[key].inp += Number(u.input_units ?? 0); a[key].out += Number(u.output_units ?? 0); if (u.cost_usd === null) a[key].unknown++; else a[key].cost += Number(u.cost_usd); return a; }, {}));
  const sys = ks.find((k: any) => k.scope_type === 'system');
  return <>
    <Hero title={<>שימוש, <span className="mark">עלויות ופעילות</span></>} sub="עלות מדווחת, מחושבת והערכה מוצגות בנפרד. כשספק לא מדווח עלות — מוצגות יחידות בלבד, בלי דיוק מדומה." />
    <div className="grid g2">
      <div className="card"><h2>לפי ספק</h2><Table head={['ספק', 'קריאות', 'יחידות קלט/פלט', 'עלות מדווחת', 'ללא נתון עלות']} rows={by('provider').map(([k, v]: any) => [k, v.n, `${v.inp}/${v.out}`, `$${v.cost.toFixed(2)}`, v.unknown])} /></div>
      <div className="card"><h2>לפי לקוח</h2><Table head={['לקוח', 'קריאות', 'עלות מדווחת', 'ללא נתון']} rows={by('client_id').map(([k, v]: any) => [k, v.n, `$${v.cost.toFixed(2)}`, v.unknown])} /></div>
      <div className="card"><h2>לפי סוכן</h2><Table head={['סוכן', 'קריאות', 'יחידות']} rows={by('agent_id').map(([k, v]: any) => [k, v.n, `${v.inp}/${v.out}`])} /></div>
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
