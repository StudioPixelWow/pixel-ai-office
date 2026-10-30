'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { callAction } from '@/components/client';
import { heError } from '@/lib/errors';

export function TalkForm({ clients, projects, canAll }: { clients: [string, string][]; projects: [string, string, string][]; canAll: boolean }) {
  const r = useRouter(); const [client, setClient] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); setBusy(true); setMsg('');
    const scope = String(fd.get('scope'));
    try {
      const d = await callAction('create_request', { text: fd.get('text'), mode: fd.get('mode'), scope: scope === 'auto' ? null : scope,
        client_id: scope === 'all_active_clients' ? null : client || null, project_id: fd.get('project_id') || null, idempotency_key: `talk:${crypto.randomUUID()}` });
      r.push(d.request_id ? `/room/${d.request_id}` : `/talk`); r.refresh();
    } catch (err) { setMsg(heError(err)); } finally { setBusy(false); }
  }
  return <form className="f" onSubmit={submit}>
    <label>הקשר<select name="scope" defaultValue="auto"><option value="auto">לקוח שנבחר / כללי Pixel</option>{canAll && <option value="all_active_clients">כל הלקוחות הפעילים</option>}</select></label>
    <label>לקוח<select value={client} onChange={(e) => setClient(e.target.value)}><option value="">— הקשר כללי של Pixel —</option>{clients.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
      <span className="hint">המערכת לא מנחשת לקוח לפי שם דומה — בחר במפורש.</span></label>
    <label>פרויקט<select name="project_id"><option value="">—</option>{projects.filter((p) => p[2] === client).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
    <label>סוג הבקשה<select name="mode" defaultValue="work"><option value="answer">תשובה בלבד</option><option value="draft">הכנת טיוטה</option><option value="work">פתיחת עבודה</option></select></label>
    <label>מה לעשות?<textarea name="text" required placeholder="למשל: תכין גאנט לחודש הבא לפי החבילה" /></label>
    <div className="row"><button className="btn y" disabled={busy}>{busy ? 'שולח…' : 'שלח למשרד'}</button>{msg && <span className="small" style={{ color: 'var(--bad)' }}>{msg}</span>}</div>
  </form>;
}
