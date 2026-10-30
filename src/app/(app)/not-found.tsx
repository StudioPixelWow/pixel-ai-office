import Link from 'next/link';
export default function NotFound() {
  return <div className="err-page"><div className="err-ico">⌕</div><h1>לא מצאנו את העמוד</h1><p className="muted">ייתכן שהפריט נמחק או שאין לך הרשאה אליו.</p><Link className="btn y" href="/">למרכז הבקרה</Link></div>;
}
