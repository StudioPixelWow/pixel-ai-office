import Link from 'next/link';
// Where a lead/client stands on the way: lead → proposal → signature → deal → client → research → milestones → active.
type J = any;
export function journeySteps(j: J) {
  const L = j?.lead, P = j?.proposal, E = j?.engagement, C = j?.client, R = j?.research, M = j?.milestones;
  const steps = [
    { k: 'lead', l: 'ליד', done: !!L, href: L ? `/leads/${L.id}` : '/leads' },
    { k: 'proposal', l: 'הצעת מחיר', done: !!P?.approved, href: P ? `/proposals/${P.id}` : L ? `/leads/${L.id}` : null },
    { k: 'signed', l: 'חתימה', done: !!P?.signed || P?.status === 'accepted', href: P ? `/proposals/${P.id}` : null },
    { k: 'deal', l: 'עסקה', done: !!E, href: C ? `/clients/${C.id}?tab=milestones` : null },
    { k: 'paid', l: 'תשלום', done: !!j?.paid, href: C ? `/clients/${C.id}?tab=billing` : null },
    { k: 'research', l: 'מחקר ותיק מותג', done: !!C?.has_dossier, running: !!R?.running, href: C ? `/clients/${C.id}?tab=knowledge` : null },
    { k: 'milestones', l: 'אבני דרך', done: !!M?.total && M.done === M.total, partial: M?.total ? `${M.done}/${M.total}` : null, href: C ? `/clients/${C.id}?tab=milestones` : null },
    { k: 'active', l: 'פעיל', done: E?.status === 'active', href: C ? `/clients/${C.id}?tab=services` : null },
  ];
  const cur = steps.findIndex((s) => !s.done);
  return { steps, cur: cur < 0 ? steps.length : cur };
}
export function nextStep(j: J): { t: string; d: string; href?: string } | null {
  const L = j?.lead, P = j?.proposal, E = j?.engagement, C = j?.client;
  if (!P && L) return { t: 'להכין הצעת מחיר', d: 'הצעה ממותגת נבנית מהבריף בלחיצה — אתה קובע את המחיר.', href: `/leads/${L.id}#proposal` };
  if (P && !P.approved) return { t: 'לאשר את ההצעה', d: 'עבור על הגרסה, נעל מחיר ואשר לשליחה.', href: `/proposals/${P.id}` };
  if (P && P.approved && !P.signed && P.status !== 'accepted') return { t: 'לשלוח ללקוח לחתימה', d: 'שלח את קישור ההצעה. כשהלקוח חותם — העסקה, הלקוח ואבני הדרך נפתחים אוטומטית.', href: `/proposals/${P.id}` };
  if (C && !j?.paid && E) return { t: 'לגבות תשלום ראשון', d: 'פתח קישור תשלום ושלח ללקוח. אחרי התשלום מפעילים את העסקה.', href: `/clients/${C.id}?tab=billing` };
  if (C && !C.has_dossier) return j?.research?.running ? { t: 'המחקר רץ', d: 'הסוכנים בונים את תיק הלקוח ובנק הנכסים.', href: j.research.request_id ? `/room/${j.research.request_id}` : undefined }
    : { t: 'להפעיל מחקר לקוח', d: 'סריקת אתר, רשתות, מתחרים ושפת מותג — בסיס לכל העבודה.', href: `/clients/${C.id}?tab=knowledge` };
  if (E && E.status !== 'active') return { t: 'להפעיל את העסקה', d: 'כשתנאי ההתחלה התקיימו — מפעילים, ואבני הדרך החודשיות מתחילות להתגלגל.', href: `/clients/${C!.id}?tab=services` };
  if (j?.milestones?.overdue) return { t: `${j.milestones.overdue} אבני דרך באיחור`, d: 'עדכן סטטוס או תאריך.', href: `/clients/${C!.id}?tab=milestones` };
  return null;
}
export function JourneyBar({ j, compact }: { j: J; compact?: boolean }) {
  if (!j) return null; const { steps, cur } = journeySteps(j); const n = nextStep(j);
  return <section className={`jr${compact ? ' compact' : ''}`} aria-label="מסלול הלקוח">
    <ol className="jr-steps">{steps.map((s: any, i) => { const cls = s.done ? 'ok' : i === cur ? 'on' : '';
      const inner = <><b>{s.done ? '✓' : s.running ? '●' : i + 1}</b><span>{s.l}{s.partial && !s.done ? <em>{s.partial}</em> : null}</span></>;
      return <li key={s.k} className={`${cls}${s.running ? ' run' : ''}`}>{s.href ? <Link href={s.href}>{inner}</Link> : <div>{inner}</div>}</li>; })}</ol>
    {n && !compact && <div className="jr-next"><div><small>הצעד הבא</small><b>{n.t}</b><span>{n.d}</span></div>{n.href && <Link className="btn y" href={n.href}>{n.t} ←</Link>}</div>}
  </section>;
}
