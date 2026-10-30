'use client';
import { useState } from 'react';
import { callRpc } from '@/components/client';

// Upload a full 4x2 character sheet (8 agents). Dark (#000-ish) margins are trimmed automatically, then the sheet is
// split into 8 cells and each cell is imported as that agent's public avatar via a fresh 30-minute owner token.
export function AvatarSheetUpload({ ids }: { ids: string[] }) {
  const [sheet, setSheet] = useState(1);
  const [log, setLog] = useState<string>('');
  async function onFile(f: File) {
    setLog('מעבד…');
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(f); });
    const c0 = document.createElement('canvas'); c0.width = img.naturalWidth; c0.height = img.naturalHeight;
    const g0 = c0.getContext('2d')!; g0.drawImage(img, 0, 0);
    const { data, width, height } = g0.getImageData(0, 0, c0.width, c0.height);
    const dark = (x: number, y: number) => { const p = (y * width + x) * 4; return data[p] + data[p + 1] + data[p + 2] < 45; };
    const rowDark = (y: number) => { for (let x = 0; x < width; x += 4) if (!dark(x, y)) return false; return true; };
    const colDark = (x: number) => { for (let y = 0; y < height; y += 4) if (!dark(x, y)) return false; return true; };
    let top = 0, bottom = height - 1, left = 0, right = width - 1;
    while (top < bottom && rowDark(top)) top++; while (bottom > top && rowDark(bottom)) bottom--;
    while (left < right && colDark(left)) left++; while (right > left && colDark(right)) right--;
    const W = right - left + 1, H = bottom - top + 1, cw = W / 4, ch = H / 2;
    const { token } = await callRpc('office_create_import_token', { p_purpose: 'avatars' });
    const out: string[] = [];
    for (let k = 0; k < 8; k++) {
      const id = ids[(sheet - 1) * 8 + k]; if (!id) continue;
      const col = k % 4, row = Math.floor(k / 4);
      const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * ch / cw);
      c.getContext('2d')!.drawImage(c0, left + col * cw, top + row * ch, cw, ch, 0, 0, c.width, c.height);
      const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1];
      const r = await fetch('/api/avatars/import', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, agent_id: id, mime: 'image/jpeg', b64, meta: { source: 'chatgpt', sheet, cell: k + 1 } }) });
      out.push(`${id}: ${r.ok ? '✓' : (await r.json()).error}`); setLog(out.join('\n'));
    }
    setLog(out.join('\n') + '\nסיום.');
  }
  return <div className="f">
    <p className="small muted">מעלים גיליון דמויות של 4×2. השוליים הכהים נחתכים אוטומטית, וכל תא נשמר כדמות של הסוכן לפי הסדר.</p>
    <label>גיליון<select value={sheet} onChange={(e) => setSheet(Number(e.target.value))}>
      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{`גיליון ${n} — סוכנים ${(n - 1) * 8 + 1}–${n * 8}`}</option>)}</select></label>
    <input type="file" accept="image/*" data-avatar-sheet onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    {log && <pre className="small" dir="ltr" style={{ whiteSpace: 'pre-wrap' }}>{log}</pre>}
  </div>;
}
