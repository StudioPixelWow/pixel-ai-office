'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
// Square-crops (top-left, largest square) and resizes to 512px webp, then saves as Pixi's avatar.
export function PixiUpload({ current }: { current?: string | null }) {
  const r = useRouter(); const [msg, setMsg] = useState<string | null>(null); const [prev, setPrev] = useState<string | null>(current ? `/api/avatar/${current}` : null);
  const pick = async (f: File) => {
    const img = new Image(); img.src = URL.createObjectURL(f); await img.decode();
    const s = Math.min(img.naturalWidth, img.naturalHeight); const c = document.createElement('canvas'); c.width = c.height = 512;
    c.getContext('2d')!.drawImage(img, 0, 0, s, s, 0, 0, 512, 512);
    const url = c.toDataURL('image/webp', 0.9); setPrev(url);
    const res = await fetch('/api/setup/pixi-avatar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mime: 'image/webp', b64: url.split(',')[1] }) }).then((x) => x.json()).catch(() => ({ error: 'אין חיבור' }));
    setMsg(res.error ? `שגיאה: ${res.error}` : 'נשמר ✓'); r.refresh();
  };
  return <div className="card"><h2>הדמות של פיקסי</h2>
    <div className="row">{prev && <img src={prev} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', border: '3px solid var(--yellow)' }} />}
      <label className="btn sm">העלאת תמונה<input type="file" accept="image/*" hidden data-pixi-upload onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} /></label>{msg && <span className="small">{msg}</span>}</div></div>;
}
