import { get, list } from '@/lib/api';
import { fmtMoney, fmtDate } from '@/lib/format';
import { notFound } from 'next/navigation';
import { PrintButton } from './print-button';
import { ProposalDoc } from '@/components/proposal-doc';
// Protected (login + scope) print view; browser "Save as PDF" yields a Hebrew RTL PDF of the exact approved version.
export default async function PrintProposal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const p = await get<any>('proposals', id); if (!p) notFound();
  const vs = await list('proposal_versions', { proposal_id: id }); const v = vs.find((x: any) => x.version_no === p.current_version); if (!v) notFound();
  const items = await list('proposal_items', { proposal_version_id: v.id }); const c = v.content ?? {}; const t = v.totals ?? {};
  if (c.blocks) return <div>
    <div className="noprint row" style={{ marginBottom: 16 }}><PrintButton /><span className="muted small">גרסה {v.version_no} · {v.review_status === 'approved' ? 'מאושרת' : 'טיוטה — לא אושרה לשליחה'}</span></div>
    <ProposalDoc data={{ title: p.title, number: p.number, created_at: v.created_at, content: c, price: v.price_snapshot ?? {}, totals: t, items: items.filter((i: any) => i.unit_price !== null).map((i: any) => ({ title: i.title, description: i.description, price: Number(i.unit_price) })) }} /></div>;
  return <div className="print-doc">
    <div className="noprint row" style={{ marginBottom: 16 }}><PrintButton /><span className="muted small">גרסה {v.version_no} · {v.review_status === 'approved' ? 'מאושרת' : 'טיוטה — לא אושרה לשליחה'}</span></div>
    <div style={{ background: 'var(--grad)', borderRadius: 28, padding: 32 }}><img src="https://s-pixel.co.il/wp-content/uploads/2026/08/pixel-logo-500.webp" alt="Pixel Digital" style={{ height: 40, background: '#fff', borderRadius: 12, padding: 6 }} />
      <h1 style={{ marginTop: 18 }}>{p.title}</h1><p>הוכן על ידי Pixel Digital · {fmtDate(v.created_at)} · גרסה {v.version_no}</p></div>
    {c.need && <><h2 style={{ marginTop: 28 }}>הבנת הצורך</h2><p>{c.need}</p></>}
    {(c.services ?? []).length > 0 && <><h2>השירותים</h2><ul>{c.services.map((s: string) => <li key={s}>{s}</li>)}</ul></>}
    {(c.deliverables ?? []).length > 0 && <><h2>התוצרים</h2><ul>{c.deliverables.map((s: string) => <li key={s}>{s}</li>)}</ul></>}
    {(c.phases ?? []).length > 0 && <><h2>שלבי העבודה</h2><ol>{c.phases.map((s: any) => <li key={s.title}><b>{s.title}</b> — {s.detail}</li>)}</ol></>}
    {c.timeline && <><h2>לוח זמנים (מותנה)</h2><p>{c.timeline}</p></>}
    <h2>השקעה</h2><table className="t"><tbody>
      <tr><td>דמי הקמה</td><td><b>{fmtMoney(v.price_snapshot?.setup)}</b></td></tr><tr><td>ריטיינר חודשי</td><td><b>{fmtMoney(v.price_snapshot?.monthly)}</b></td></tr>
      {v.price_snapshot?.media != null && <tr><td>תקציב מדיה (משולם בנפרד לפלטפורמות)</td><td>{fmtMoney(v.price_snapshot.media)}</td></tr>}
      {items.filter((i: any) => i.unit_price !== null).map((i: any) => <tr key={i.id}><td className="small">{i.title}</td><td className="small">{fmtMoney(i.unit_price)}</td></tr>)}
      <tr><td className="small muted" colSpan={2}>{t.vat === 'not_configured' ? 'המחירים אינם כוללים מע״מ אלא אם צוין אחרת בתנאים.' : `מע״מ ${t.vat_rate}% ${t.prices_include_vat ? 'כלול' : 'אינו כלול'}.`}</td></tr></tbody></table>
    {(c.assumptions ?? []).length > 0 && <><h2>הנחות יסוד</h2><ul>{c.assumptions.map((s: string) => <li key={s}>{s}</li>)}</ul></>}
  </div>;
}
