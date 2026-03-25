/**
 * Central SEO config: base URL, site name, default copy.
 * Use NEXT_PUBLIC_APP_URL in production (e.g. https://procloser.vercel.app).
 */
const baseUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (typeof process.env.VERCEL_URL === 'string'
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000');

export const seo = {
  baseUrl: baseUrl.replace(/\/$/, ''),
  siteName: 'ProCloser',
  tagline: 'AI Sales Coaching',
  defaultTitle: 'ProCloser – AI Sales Coaching & Performance Analytics',
  defaultDescription:
    'ProCloser is AI-powered sales coaching for reps and teams. Analyze calls, practice with AI roleplay, track performance and figures, and improve close rates.',
  defaultKeywords: [
    'sales coaching',
    'AI sales',
    'sales training',
    'call analysis',
    'sales performance',
    'close rate',
    'sales roleplay',
    'sales analytics',
  ] as string[],
  twitterHandle: '', // e.g. @procloser
  ogImagePath: '/og.png', // optional: add og.png to public/
} as const;

export function absoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${seo.baseUrl}${p}`;
}
