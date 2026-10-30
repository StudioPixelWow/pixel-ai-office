// WordPress REST with a dedicated user + Application Password (secret held in a server env var named by the connection's secret_ref).
export async function wpCreateDraft(site: string, secretRef: string, post: { title: string; content: string; excerpt?: string }) {
  const cred = process.env[secretRef]; if (!cred) throw Object.assign(new Error(`missing secret ${secretRef}`), { blocked: true });
  const r = await fetch(`${site.replace(/\/$/, '')}/wp-json/wp/v2/posts`, { method: 'POST', headers: { authorization: 'Basic ' + Buffer.from(cred).toString('base64'), 'content-type': 'application/json' },
    body: JSON.stringify({ ...post, status: 'draft' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`wp ${r.status}: ${j?.message ?? ''}`), { retryable: r.status >= 500 });
  return { id: j.id as number, link: j.link as string };
}
