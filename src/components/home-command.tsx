'use client';
import { useState } from 'react';
const HINTS = ['תכין גאנט לנובמבר לכל הלקוחות', 'מה תקוע השבוע?', 'תכתוב פוסט לסטודיו LOUD על פודקאסט לעסקים', 'פתח את הליד האחרון'];
export function HomeCommand() {
  const [t, setT] = useState(''); const ask = (q: string) => window.dispatchEvent(new CustomEvent('pixi:ask', { detail: q }));
  return <form className="hc" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { ask(t.trim()); setT(''); } }}>
    <span className="hc-ic">✦</span>
    <input value={t} onChange={(e) => setT(e.target.value)} placeholder="מה המשרד יעשה בשבילך? כתוב חופשי — פיקסי ינתב לסוכנים" aria-label="משימה חופשית" />
    <button className="btn y" disabled={!t.trim()}>שלח</button>
    <div className="hc-hints">{HINTS.map((h) => <button type="button" key={h} onClick={() => ask(h)}>{h}</button>)}</div>
  </form>;
}
