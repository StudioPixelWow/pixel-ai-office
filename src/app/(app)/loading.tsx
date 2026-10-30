export default function Loading() {
  return <div className="skel" aria-busy="true" aria-label="טוען"><div className="skel-hero" /><div className="skel-row">{[0, 1, 2, 3].map((i) => <div key={i} className="skel-card" />)}</div><div className="skel-block" /></div>;
}
