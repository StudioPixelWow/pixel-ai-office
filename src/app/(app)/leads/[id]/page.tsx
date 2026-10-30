import Link from 'next/link';
import { get, safeList, me } from '@/lib/api';
import { Badge, Table } from '@/components/ui';
import { ActionForm } from '@/components/client';
import { fmtMoney, he } from '@/lib/format';
import { notFound } from 'next/navigation';
import { QuickProposal } from './quick-proposal';
import { serviceLabel } from '@/lib/services';
import { rpc } from '@/lib/api';
import { JourneyBar } from '@/components/journey';
export default async function Lead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const l = await get<any>('leads', id); if (!l) notFound(); const m = await me();
  const [journey, briefs, proposals, terms] = await Promise.all([rpc<any>('office_journey', { p_lead: id }).catch(() => null), safeList('briefs', { lead_id: id }), safeList('proposals', { lead_id: id }), safeList('terms_templates')]);
  return <>
    <div className="hero"><div className="row"><div className="sp"><h1>{l.company}</h1><p>{l.need ?? ''}</p></div><Badge s={l.stage} /></div></div>
    <JourneyBar j={journey} />
    <div className="grid g2">
      <div className="card"><h2>פרטי הליד</h2><dl className="kv"><dt>איש קשר</dt><dd>{l.contact_name ?? '—'}</dd><dt>עיסוק</dt><dd>{l.industry ?? '—'}</dd><dt>טלפון</dt><dd dir="ltr">{l.contact_phone_e164 ?? '—'}</dd><dt>דוא״ל</dt><dd dir="ltr">{l.contact_email ?? '—'}</dd><dt>מקור</dt><dd>{l.source}</dd><dt>מטרות</dt><dd>{l.goals ?? '—'}</dd>
        <dt>שירותים מבוקשים</dt><dd>{(l.requested_services ?? []).map(serviceLabel).join(', ') || '—'}</dd><dt>קיים → נדרש</dt><dd>{l.current_state ?? '—'} → {l.required_state ?? '—'}</dd>
        <dt>דחיפות</dt><dd>{l.urgency ?? '—'}</dd><dt>תקציב הלקוח</dt><dd>{fmtMoney(l.client_budget)} <span className="small muted">(אינו המחיר שלך)</span></dd></dl>
        <h3 style={{ marginTop: 14 }}>בריף</h3>{briefs.map((b: any) => <pre key={b.id} className="out">v{b.version_no}: {b.content?.text ?? JSON.stringify(b.content)}</pre>)}
        <ActionForm action="update_brief" extra={{ lead_id: id }} submit="שמור גרסת בריף" fields={[{ name: 'content', label: 'בריף (JSON או {"text":"…"})', type: 'textarea', json: true, ltr: true, defaultValue: '{"text":""}' }]} />
        <ActionForm action="update_lead" reset={false} extra={{ id, version: l.version }} submit="עדכן שלב" fields={[{ name: 'stage', label: 'שלב', type: 'select', options: ['new', 'scoping', 'negotiation', 'lost', 'archived'].map((s) => [s, he(s)]), defaultValue: l.stage }]} /></div>
      <div className="card" id="proposal"><h2>הצעות</h2>
        <Table head={['הצעה', 'סטטוס', 'מחיר נעול']} rows={proposals.map((p: any) => [<Link key="l" href={`/proposals/${p.id}`}>{p.title}</Link>, <Badge key="b" s={p.status} />, p.price_locked_at ? `${fmtMoney(p.locked_setup)} + ${fmtMoney(p.locked_monthly)}/ח׳` : 'טרם נקבע'])} empty="אין הצעה" />
        {m.role === 'owner' && <><h3 style={{ marginTop: 14 }}>הצעת מחיר ממותגת</h3>
          <QuickProposal lead={l} terms={terms.map((t: any) => ({ id: t.id, name: `${t.name}${t.vat_rate != null ? ` · מע״מ ${t.vat_rate}%` : ''}` }))} /></>}
        <details style={{ marginTop: 14 }}><summary className="small">פתיחת הצעה ריקה (מתקדם)</summary>
        <ActionForm action="create_proposal" extra={{ lead_id: id }} redirectTo="/proposals/{id}" fields={[{ name: 'title', label: 'כותרת', required: true, defaultValue: `הצעת מחיר — ${l.company}` },
          { name: 'terms_template_id', label: 'תבנית תנאים מאושרת', type: 'select', options: terms.map((t: any) => [t.id, t.name]) }]} /></details>
        {m.role === 'owner' && !terms.length && <p className="small muted">אין עדיין תבנית מע״מ. כדי שההצעה תציג גם סכום כולל מע״מ, הגדר תבנית (למשל 18%) במסך ההגדרות — המערכת לא מנחשת שיעורי מס.</p>}</div></div>
  </>;
}
