import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BUILD: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? 'dev' },
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: { '/api/proposals/**': ['./node_modules/@sparticuz/chromium/bin/**', './src/app/globals.css'], '/api/worker/tick': ['./node_modules/@sparticuz/chromium/bin/**', './src/app/globals.css'] },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ] }];
  },
};
export default config;
