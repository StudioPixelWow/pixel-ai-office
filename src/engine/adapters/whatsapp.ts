// WhatsApp Cloud API (official). The only path that sends. Callers must hold a consumed, owner approval (enforced in DB).
const V = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0';
export const waConfigured = () => !!(process.env.WHATSAPP_CLOUD_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
export async function waCheck() {
  const r = await fetch(`https://graph.facebook.com/${V}/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name`, { headers: { authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}` } });
  const j = await r.json().catch(() => ({})); return { ok: r.ok, account: j.display_phone_number as string | undefined, error: j?.error?.message };
}
export async function waSendText(to: string, body: string, template?: { name: string; language?: string; params?: string[] } | null) {
  const payload = template?.name
    ? { messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'template', template: { name: template.name, language: { code: template.language ?? 'he' },
        components: template.params?.length ? [{ type: 'body', parameters: template.params.map((t) => ({ type: 'text', text: t })) }] : undefined } }
    : { messaging_product: 'whatsapp', to: to.replace('+', ''), type: 'text', text: { body, preview_url: true } };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(`https://graph.facebook.com/${V}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { method: 'POST', signal: ctrl.signal,
      headers: { authorization: `Bearer ${process.env.WHATSAPP_CLOUD_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.messages?.[0]?.id) return { outcome: 'accepted' as const, id: j.messages[0].id as string };
    if (r.status >= 400 && r.status < 500) return { outcome: 'failed' as const, error: j?.error?.message ?? `HTTP ${r.status}` };
    return { outcome: 'uncertain' as const, error: `HTTP ${r.status}` };
  } catch (e: any) { return { outcome: 'uncertain' as const, error: e?.name === 'AbortError' ? 'timeout' : String(e?.message ?? e) }; }
  finally { clearTimeout(t); }
}
