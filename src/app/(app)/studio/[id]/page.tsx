import { rpc, me } from '@/lib/api';
import { Badge, Empty } from '@/components/ui';
import { ActionButton, ActionForm } from '@/components/client';
import { fmtDateTime } from '@/lib/format';
import { notFound } from 'next/navigation';
export default async function ArtifactPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; b?: string }> }) {
  const { id } = await params; const sp = await searchParams; const m = await me();
  const art = await rpc<any>('office_artifact', { p_id: id }).catch(() => null); if (!art) notFound();
  const vs: any[] = art.versions; const cur = vs[0];
  const A = vs.find((v) => v.id === sp.a) ?? vs[1]; const B = vs.find((v) => v.id === sp.b) ?? cur;
  const blob = (v: any) => (v.storage_path ?? '').startsWith('blob:') ? v.storage_path.slice(5) : null;
  return <>
    <div className="hero"><div className="row"><div className="sp"><h1>{art.title}</h1><p>{art.kind} · {vs.length} גרסאות</p></div>{cur && <Badge s={cur.review_status} />}</div></div>
    {cur ? <div className="grid g2">
      <div className="card"><div className="row"><h2 className="sp">גרסה {cur.version_no}</h2><span className="small muted">{cur.created_by_agent} · {cur.model ?? cur.tool ?? ''} · {fmtDateTime(cur.created_at)}</span></div>
        {cur.needs_update && <div className="note warn">נדרש עדכון: {cur.needs_update_reason}. חומר מיושן לא יפורסם מכוח אישור לגרסה אחרת.</div>}
        {blob(cur) && cur.mime?.startsWith('image/') && <img src={`/api/files/${blob(cur)}`} alt={art.title} style={{ width: '100%', borderRadius: 18, border: '1px solid var(--line)' }} />}
        {blob(cur) && cur.mime?.startsWith('video/') && <video src={`/api/files/${blob(cur)}`} controls style={{ width: '100%', borderRadius: 18 }} />}
        <pre className="out">{cur.body ?? JSON.stringify(cur.data, null, 2)}</pre>
        <dl className="kv small"><dt>MIME</dt><dd>{cur.mime}</dd>{cur.width && <><dt>מידות</dt><dd>{cur.width}×{cur.height}</dd></>}{cur.duration_ms && <><dt>משך</dt><dd>{(cur.duration_ms / 1000).toFixed(1)}s</dd></>}<dt>SHA-256</dt><dd className="ltr">{cur.sha256?.slice(0, 20)}…</dd></dl>
        <div className="row" style={{ marginTop: 10 }}>{blob(cur) && <a className="btn sm" href={`/api/files/${blob(cur)}?download=${encodeURIComponent(art.title)}.${cur.mime?.split('/')[1]?.replace('svg+xml', 'svg')}`}>הורדת קובץ מקור</a>}
          {cur.data?.background_blob && <a className="btn sm" href={`/api/files/${cur.data.background_blob}?download=background.png`}>הורדת שכבת רקע</a>}
          {m.role === 'owner' && cur.review_status !== 'approved' && <ActionButton className="btn y sm" action="approve_artifact" payload={{ version_id: cur.id, approval_kind: art.kind === 'copy' ? 'copy' : art.kind === 'design' ? 'design' : art.kind === 'video' ? 'video' : 'general' }}>אשר גרסה {cur.version_no}</ActionButton>}</div>
        {cur.review_status !== 'approved' && <details style={{ marginTop: 12 }}><summary>בקשת תיקון לגרסה {cur.version_no}</summary>
          <ActionForm action="request_revision" extra={{ version_id: cur.id }} submit="שלח לתיקון" fields={[{ name: 'comment', label: 'מה לתקן', type: 'textarea', required: true }]} /></details>}</div>
      <div className="card"><h2>השוואת גרסאות</h2>{vs.length > 1 && A && B ? <>
        <form className="row"><select name="a" defaultValue={A.id}>{vs.map((v) => <option key={v.id} value={v.id}>v{v.version_no}</option>)}</select><span>מול</span>
          <select name="b" defaultValue={B.id}>{vs.map((v) => <option key={v.id} value={v.id}>v{v.version_no}</option>)}</select><button className="btn sm">השווה</button></form>
        <div className="grid g2" style={{ marginTop: 10 }}><div><b>v{A.version_no}</b> <Badge s={A.review_status} /><pre className="out">{A.body}</pre></div><div><b>v{B.version_no}</b> <Badge s={B.review_status} /><pre className="out">{B.body}</pre></div></div>
        <p className="small">{B.diff_summary}</p></> : <Empty>גרסה אחת בלבד</Empty>}
        <h3>היסטוריית ביקורות</h3>{(art.reviews ?? []).map((r: any) => <div key={r.id} className="small">{fmtDateTime(r.decided_at)} · {r.approval_kind} · {r.decision} · {r.comment}</div>)}</div></div> : <Empty>אין גרסאות</Empty>}
  </>;
}
