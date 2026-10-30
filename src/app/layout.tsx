import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'PIXEL AI OFFICE', robots: { index: false, follow: false } };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="he" dir="rtl"><head>
    <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
    <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  </head><body>{children}</body></html>;
}
