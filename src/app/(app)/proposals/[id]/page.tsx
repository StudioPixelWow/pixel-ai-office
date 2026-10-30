import Link from 'next/link';
import { get, list, safeList, me } from '@/lib/api';
import { Badge, Table, Empty } from '@/components/ui';
import { ActionForm, ActionButton } from '@/components/client';
import { fmtMoney, fmtDateTime, he } from '@/lib/format';
import { notFound } from 'next/navigation';
import { rpc } from '@/lib/api';
import { ProposalDoc } from '@/components/proposal-doc';
import { ShareBox } from './share-box';
import { gmailConfigured } from '@/engine/adapters/gmail';
export default async function Proposal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const p = await get<any>('proposals', id); if (!p) notFound(); const m = await me();
  const [versions, terms, reqs] = await Promise.all([list('proposal_versions', { proposal_id: id }), safeList('terms_templates'), safeList('requests', {}, 50)]);
  const cur = versions.find((v: any) => v.version_no === p.current_version); const items = cur ? await list('proposal_items', { proposal_version_id: cur.id }) : [];
  const t = cur?.totals ?? {};
  const branded = !!cur?.content?.blocks; const cl = cur?.content?.client ?? {};
  const sig = ['owner', 'admin'].includes(m.role) ? await rpc<any>('office_proposal_signature', { p_proposal: id }).catch(() => null) : null;
  return <>
    <div className="hero"><div className="row"><div className="sp"><h1>{p.title}</h1><p>גרסה נוכחית: {p.current_version || '—'}</p></div><Badge s={p.status} />
      {cur && <Link className="btn" href={`/proposals/${id}/print`}>תצוגת הדפסה / PDF</Link>}</div></div>
    {branded && <div className="grid g2" style={{ marginBottom: 16 }}>
      <div className="card"><h2>שליחה לחתימה</h2>
        {sig ? <><p><span className="badge ok">נחתם</span> על ידי <b>{sig.signer_name}</b>{sig.signer_title ? ` (${sig.signer_title})` : ''} · {fmtDateTime(sig.signed_at)}</p>
          {sig.signature_blob_id && <img src={`/api/files/${sig.signature_blob_id}`} alt="חתימה" style={{ maxHeight: 80, background: '#fff', border: '1px solid var(--line,#e3eaf2)', borderRadius: 12 }} />}
          <p className="small muted">טביעת תוכן (SHA-256) של הגרסה החתומה: <span dir="ltr">{String(sig.content_hash).slice(0, 16)}…</span></p>
          {p.payment_link_url && <p className="small">הלקוח פתח קישור תשלום: <a href={p.payment_link_url} target="_blank" rel="noreferrer" dir="ltr">Grow</a></p>}</>
        : cur?.review_status !== 'approved' ? <><p>בדוק את ההצעה למטה. אחרי אישור תוכל ליצור קישור לחתימה.</p>
            {m.role === 'owner' && <ActionButton className="btn y" action="approve_proposal" payload={{ version_id: cur.id }}>אשר את ההצעה</ActionButton>}</>
        : m.role === 'owner' ? <ShareBox proposalId={id} company={cl.company ?? p.title} contactName={cl.contact_name} phone={cl.phone} email={cl.email} gmail={gmailConfigured()} hasLink={!!p.share_token_hash} />
        : <p className="small muted">רק ה-Owner שולח הצעות ללקוחות.</p>}</div>
      <div className="card"><h2>פרטים</h2><dl className="kv"><dt>מס׳ הצעה</dt><dd>{p.number ?? '—'}</dd><dt>לקוח</dt><dd>{cl.company} {cl.contact_name ? `· ${cl.contact_name}` : ''}</dd>
        <dt>טלפון</dt><dd dir="ltr">{cl.phone ?? '—'}</dd><dt>דוא״ל</dt><dd dir="ltr">{cl.email ?? '—'}</dd><dt>תוקף הקישור</dt><dd>{p.share_expires_at ? fmtDateTime(p.share_expires_at) : '—'}</dd></dl>
        <Link className="btn" href={`/proposals/${id}/print`}>הדפסה / PDF</Link></div></div>}
    {branded && cur && <div style={{ marginBottom: 20 }}><ProposalDoc data={{ title: p.title, number: p.number, created_at: cur.created_at, content: cur.content, price: cur.price_snapshot ?? {}, totals: cur.totals ?? {},
      items: items.filter((i: any) => i.unit_price !== null).map((i: any) => ({ title: i.title, description: i.description, price: Number(i.unit_price) })) }} /></div>}
    <details open={!branded}><summary><b>ניהול מתקדם: מחיר, גרסאות והתקשרות</b></summary>
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
          fields={[{ name: 'text', label: 'הנחיה לבונה ההצעות', type: 'textarea', required: true, defaultValue: 'הכן הצעה ממותגת לפי הבריף והמחיר הנעול' }]} redirectTo="/talk?r={request_id}" /></div>
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
        {versions.length > 1 && <><h3 style={{ marginTop: 14 }}>היסטוריית גרסאות</h3><Table head={['גרסה', 'סטטוס', 'סיכום']} rows={versions.map((v: any) => [`v${v.version_no}`, he(v.review_status), v.change_summary ?? ''])} /></>}</div></div></details>
  </>;
}
