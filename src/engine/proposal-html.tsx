import { readFile } from 'fs/promises';
import path from 'path';
import { ProposalDoc, type ProposalData } from '@/components/proposal-doc';
// Self-contained HTML of the branded proposal (same component + same CSS as the screen) — rendered without any page
// navigation, so no login, cookies or deployment protection stand between the PDF and the document.
export async function proposalHtml(data: ProposalData) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const css = await readFile(path.join(process.cwd(), 'src/app/globals.css'), 'utf8').catch(() => '');
  const body = renderToStaticMarkup(<ProposalDoc data={data} />);
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><style>${css}</style></head><body>${body}</body></html>`;
}
