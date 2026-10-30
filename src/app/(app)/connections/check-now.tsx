'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function CheckNow() {
  const r = useRouter(); const [s, setS] = useState('');
  return <span className="row"><button className="btn y" onClick={async () => { setS('בודק…'); const x = await fetch('/api/setup/check-connections', { method: 'POST' }); const j = await x.json(); setS(j.ok ? 'הבדיקה הסתיימה' : j.error); r.refresh(); }}>בדוק חיבורים עכשיו</button>
    {s && <span className="small muted">{s}</span>}</span>;
}
