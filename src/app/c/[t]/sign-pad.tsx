'use client';
import { useEffect, useRef, useState } from 'react';
// Finger / mouse signature pad → PNG data URL.
export function SignPad({ onChange }: { onChange: (png: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null); const drawing = useRef(false); const [empty, setEmpty] = useState(true);
  useEffect(() => { const c = ref.current!; const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; c.width = r.width * dpr; c.height = r.height * dpr;
    const x = c.getContext('2d')!; x.scale(dpr, dpr); x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#0B1320'; }, []);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e: React.PointerEvent) => { e.preventDefault(); ref.current!.setPointerCapture(e.pointerId); drawing.current = true; const [a, b] = pos(e); const x = ref.current!.getContext('2d')!; x.beginPath(); x.moveTo(a, b); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const [a, b] = pos(e); const x = ref.current!.getContext('2d')!; x.lineTo(a, b); x.stroke(); if (empty) setEmpty(false); };
  const up = () => { if (!drawing.current) return; drawing.current = false; onChange(empty ? null : ref.current!.toDataURL('image/png')); };
  const clear = () => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setEmpty(true); onChange(null); };
  return <div className="pt-pad"><canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="חתימה" />
    {empty ? <span className="pt-pad-hint">חתמו כאן באצבע או בעכבר</span> : <button type="button" className="pt-pad-clear" onClick={clear}>ניקוי</button>}</div>;
}
