'use client';
import { useEffect, useRef, useState } from 'react';
type Slide = { title: string; big?: string; line?: string; at: number };
// Narrated report player: the slides follow the narration (each slide starts at its share of the script).
export function TalkingReport({ src, slides, label = 'הדוח המדבר' }: { src: string; slides: Slide[]; label?: string }) {
  const a = useRef<HTMLAudioElement>(null); const [i, setI] = useState(0); const [play, setPlay] = useState(false); const [p, setP] = useState(0);
  useEffect(() => { const el = a.current; if (!el) return;
    const t = () => { const f = el.duration ? el.currentTime / el.duration : 0; setP(f); let k = 0; slides.forEach((s, j) => { if (f >= s.at) k = j; }); setI(k); };
    const e = () => { setPlay(false); }; el.addEventListener('timeupdate', t); el.addEventListener('ended', e); return () => { el.removeEventListener('timeupdate', t); el.removeEventListener('ended', e); }; }, [slides]);
  const s = slides[i] ?? slides[0];
  const toggle = () => { const el = a.current; if (!el) return; if (el.paused) { el.play(); setPlay(true); } else { el.pause(); setPlay(false); } };
  return <div className={`tr ${play ? 'on' : ''}`}>
    <div className="tr-stage" key={i}><small>{label} · {i + 1}/{slides.length}</small>{s?.big ? <b className="tr-big">{s.big}</b> : null}<h3>{s?.title}</h3>{s?.line && <p>{s.line}</p>}</div>
    <div className="tr-bar"><button className="tr-play" onClick={toggle} aria-label={play ? 'השהה' : 'נגן'}>{play ? '❚❚' : '▶'}</button>
      <div className="tr-prog"><i style={{ width: `${p * 100}%` }} />{slides.map((x, j) => <span key={j} style={{ insetInlineStart: `${x.at * 100}%` }} />)}</div></div>
    <audio ref={a} src={src} preload="metadata" />
  </div>;
}
