import Link from 'next/link';
import { rpc } from '@/lib/api';
export const dynamic = 'force-dynamic';
export default async function Winners() {
  const list: any[] = await rpc<any[]>('office_winners', {}).catch(() => []);
  const by = list.reduce((g: Record<string, any[]>, x) => { (g[x.client] ??= []).push(x); return g; }, {});
  return <>
    <section className="pg-head pg-hero"><div><h1>פוסטים <span className="mark">מנצחים</span></h1><p>הפוסטים שהצליחו במיוחד. הסוכנים מקבלים אותם כהשראה בכל פעם שהם כותבים ללקוח — כדי לשחזר את מה שעובד. מסמנים פוסט מנצח מתוך גאנט התוכן, אחרי שעלה.</p></div></section>
    {list.length ? Object.entries(by).map(([client, items]) => <section key={client} className="ag-sec"><h2>{client} <span className="ag-n">{(items as any[]).length}</span></h2>
      <div className="wn-grid">{(items as any[]).map((x) => <article key={x.id} className="wn-card">
        {x.img ? <img src={`/api/files/${x.img}`} alt="" loading="lazy" /> : <div className="pt-noimg">❝</div>}
        <div><b>{x.topic}</b>{x.hook && <p className="wn-hook">״{x.hook}״</p>}{x.note && <p className="wn-why">⭐ {x.note}</p>}
          <small>{[x.format, x.pillar].filter(Boolean).join(' · ')}</small>
          <div className="row">{x.url && <a className="btn sm ghost" href={x.url} target="_blank" rel="noreferrer">לפוסט ↗</a>}<Link className="btn sm ghost" href={`/content?client=${x.client_id}`}>לגאנט</Link></div></div>
      </article>)}</div></section>)
      : <div className="cc-empty"><b>עוד אין פוסטים מנצחים</b><p>בגאנט התוכן, פתח פוסט שעלה ולחץ ״⭐ סמן כמנצח״ — וכתוב בקצרה למה הוא הצליח.</p><Link className="btn sm y" href="/content">לגאנט התוכן</Link></div>}
  </>;
}
