// One place to read a client's logo: the verified logo pass first, then research leftovers (only real URLs, never "חסר…" notes).
const ok = (u: any) => typeof u === 'string' && /^(https?:\/\/|\/api\/files\/)/.test(u.trim());
export function logoOf(profile: any): { src: string | null; dark: boolean } {
  const p = profile ?? {};
  if (ok(p.logo_url) && String(p.logo_url).startsWith('/api/files/')) return { src: p.logo_url, dark: p.logo_bg === 'dark' };
  if (p.logo_checked) return { src: null, dark: false };   // the logo pass ran and rejected what research had found
  const alt = [p.dossier?.brand?.logo_url, p.dossier_extra?.logo, p.logo_url].find(ok) ?? null;
  return { src: alt, dark: false };
}
