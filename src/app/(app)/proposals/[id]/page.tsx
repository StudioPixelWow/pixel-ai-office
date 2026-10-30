import Link from 'next/link';
import { get, list, safeList, me } from '@/lib/api';
import { Badge, Table, Empty } from '@/components/ui';
import { ActionForm, ActionButton } from '@/components/client';
import { fmtMoney, fmtDateTime, he } from '@/lib/format';
import { notFound } from 'next/navigation';
export default async function Proposal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const p = await get<any>('proposals', id); if (!p) notFound(); const m = await me();
  const [versions, terms, reqs] = await Promise.all([list('proposal_versions', { proposal_id: id }), safeList('terms_templates'), safeList('requests', {}, 50)]);
  const cur = versions.find((v: any) => v.version_no === p.current_version); const items = cur ? await list('proposal_items', { proposal_version_id: cur.id }) : [];
  const t = cur?.totals ?? {};
  return <>
    <div className="hero"><div className="row"><div className="sp"><h1>{p.title}</h1><p>גרסה נוכחית: {p.current_version || '—'}</p></div><Badge s={p.status} />
      {cur && <Link className="btn" href={`/proposals/${id}/print`}>תצוגת הדפסה / PDF</Link>}</div></div>
    <div className="grid g2">
      <div className="card"><h2>המחיר שלך (נעול)</h2>
        {p.price_locked_at ? <dl className="kv"><dt>דמי הקמה</dt><dd><b>{fmtMoney(p.locked_setup)}</b></dd><dt>ריטיינר חודשי</dt><dd><b>{fmtMoney(p.locked_monthly)}</b></dd>
          <dt>תקציב מדיה (נפרד)</dt><dd>{fmtMoney(p.locked_media_budget)}</dd><dt>הערה</dt><dd>{p.locked_total_note ?? '—'}</dd><dt>ננעל</dt><dd>{fmtDateTime(p.price_locked_at)}</dd>
          <dt>מע״מ</dt><dd>{t.vat === 'not_configured' ? t.vat_note : `${t.vat_rate}% ${t.prices_include_vat ? 'כלול' : 'לא כלול'} → הקמה ${fmtMoney(t.setup_with_vat)}, חודשי ${fmtMoney(t.monthly_with_vat)}`}</dd></dl> : <Empty>טרם קבעת מחיר. סוכנים לא קובעים מחיר.</Empty>}
        {m.role === 'owner' ? <details open={!p.price_locked_at}><summary>{p.price_locked_at ? 'שינוי מחיר (יוצר רישום היסטוריה)' : 'קביעת מחיר'}</summary>
          <ActionForm action="set_price" extra={{ proposal_id: id }} reset={false} submit="נעל מחיר" fields={[{ name: 'setup', label: 'דמי הקמה (₪)', type: 'number', defaultValue: p.locked_setup },
            { name: 'monthly', label: 'ריטיינר חודשי (₪)', type: 'number', defaultValue: p.locked_monthly }, { name: 'media_budget', label: 'תקציב מדיה נפרד (₪)', type: 'number', defaultValue: p.locked_media_budget },
            { name: 'terms_template_id', label: 'תבנית תנאים', type: 'select', options: terms.map((x: any) => [x.id, x.name]), defaultValue: p.terms_template_id },
            { name: 'note', label: 'הערה' }, { name: 'reason', label: 'סיבת שינוי' }]} /></details> : <p className="small muted">רק ה-Owner קובע מחיר.</p>}
        <h3 style={{ marginTop: 16 }}>הכנת ההצעה ע״י הצוות</h3>
        <ActionForm action="create_request" submit="הפעל תהליך הצעה" extra={{ scope: 'pixel', plan: { proposal_id: id, lead_id: p.lead_id }, mode: 'work', idempotency_key: `proposal:${id}:${p.current_version}` }}
          fields={[{ name: 'text', label: 'הנחיה לבונה ההצעות', type: 'textarea', required: true, defaultValue: 'הכן הצעה ממותגת לפי הבריף והמחיר הנעול' }]} redirectTo={(d) => `/talk?r=${d.request_id}`} /></div>
      <div className="card"><h2>גרסה {cur?.version_no ?? '—'}</h2>{cur ? <>
        <Badge s={cur.review_status} /> <span className="small muted">{cur.change_summary}</span>
        <pre className="out">{[cur.content?.need && `צורך: ${cur.content.need}`, (cur.content?.services ?? []).length && `שירותים: ${cur.content.services.join(', ')}`, (cur.content?.deliverables ?? []).length && `תוצרים: ${cur.content.deliverables.join(', ')}`, cur.content?.timeline && `לו״ז: ${cur.content.timeline}`].filter(Boolean).join('\n')}</pre>
        <Table head={['סוג', 'סעיף', 'כמות', 'מחיר יחידה']} rows={items.map((i: any) => [i.kind, i.title, i.quantity, i.unit_price === null ? <span key="s" className="muted small">פיצול מוצע — ממתין לאישורך</span> : fmtMoney(i.unit_price)])} empty="אין סעיפים" />
        <div className="row" style={{ marginTop: 12 }}>
          {m.role === 'owner' && cur.review_status !== 'approved' && <ActionButton className="btn y" action="approve_proposal" payload={{ version_id: cur.id }}>אשר הצעה לשליחה</ActionButton>}
          {m.role === 'owner' && p.status === 'ready_to_send' && <ActionButton className="btn" action="mark_proposal_sent" payload={{ proposal_id: id }}>סמן שנשלחה</ActionButton>}</div>
        {m.role === 'owner' && cur.review_status === 'approved' && p.status !== 'accepted' && <details style={{ marginTop: 14 }}><summary><b>תיעוד התקשרות מאושרת</b> (רק כשהלקוח אישר בפועל)</summary>
          <ActionForm action="confirm_engagement" extra={{ version_id: cur.id }} submit="תעד התקשרות ופתח תיק לקוח" fields={[{ name: 'start_date', label: 'תאריך התחלה', type: 'date' },
            { name: 'entitlements', label: 'שירותים ומכסות (JSON) — שאתה מאשר', type: 'textarea', json: true, ltr: true, required: true, defaultValue: '[{"service_key":"social_post","title":"פוסט סושיאל","unit":"post","quantity":8},{"service_key":"reel_video","title":"סרטון קצר","unit":"video","quantity":2}]' },
            { name: 'start_conditions', label: 'תנאי התחלה (JSON)', type: 'textarea', json: true, ltr: true, defaultValue: '["תשלום דמי הקמה","קבלת חומרים וגישות"]' }]} /></details>}
      </> : <Empty>טרם נוצרה גרסה — הפעל את תהליך ההצעה או צור גרסה ידנית.</Empty>}
        {versions.length > 1 && <><h3 style={{ marginTop: 14 }}>היסטוריית גרסאות</h3><Table head={['גרסה', 'סטטוס', 'סיכום']} rows={versions.map((v: any) => [`v${v.version_no}`, he(v.review_status), v.change_summary ?? ''])} /></>}</div></div>
  </>;
}
