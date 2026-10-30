import { IntakeForm } from './intake-form';
export const dynamic = 'force-static';
export default function Podcast() {
  return <main className="ld-wrap">
    <header className="ld-hero">
      <div className="ld-hero-media" style={{ backgroundImage: 'url(/brand/loud-studio-mic.webp)' }} />
      <div className="ld-hero-in">
        <img className="ld-logo" src="/brand/loud-on-dark.svg" alt="LOUD Podcast Studio" />
        <h1>הסיפור שלך<br /><mark>ראוי להישמע.</mark></h1>
        <p>כמה דקות של היכרות, ואנחנו נעשה את השאר: מחקר על העסק, קובץ שאלות מותאם אישית לשעת ראיון, ואולפן מקצועי שמחכה לך.</p>
        <ol className="ld-how"><li><b>1</b>ממלאים את הטופס</li><li><b>2</b>מקבלים קובץ שאלות לאישור</li><li><b>3</b>קובעים מועד ומקליטים</li></ol>
      </div>
    </header>
    <section className="ld-card ld-form-card"><IntakeForm /></section>
    <footer className="ld-foot"><img src="/brand/loud-icon.svg" alt="" /> LOUD Podcast Studio · by Studio Pixel</footer>
  </main>;
}
