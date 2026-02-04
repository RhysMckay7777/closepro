import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from 'next-themes';
import { Instrument_Sans, Instrument_Serif, Space_Grotesk } from 'next/font/google';
import { UserProvider } from '@/contexts/user-context';
import { Toaster } from '@/components/ui/sonner';
import { seo, absoluteUrl } from '@/lib/seo';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(seo.baseUrl),
  title: {
    default: seo.defaultTitle,
    template: `%s | ${seo.siteName}`,
  },
  description: seo.defaultDescription,
  keywords: seo.defaultKeywords,
  authors: [{ name: seo.siteName, url: seo.baseUrl }],
  creator: seo.siteName,
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: seo.baseUrl,
    siteName: seo.siteName,
    title: seo.defaultTitle,
    description: seo.defaultDescription,
    images: seo.ogImagePath ? [{ url: absoluteUrl(seo.ogImagePath), width: 1200, height: 630, alt: seo.siteName }] : [],
  },
  twitter: {
    card: 'summary_large_image',
    title: seo.defaultTitle,
    description: seo.defaultDescription,
    ...(seo.twitterHandle && { creator: seo.twitterHandle }),
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: seo.baseUrl },
  category: 'technology',
};

const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
});

const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
});

const mono = Space_Grotesk({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal"],
  display: "swap",
  preload: true,
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${sans.variable} ${serif.variable} ${mono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <UserProvider>
            {children}
            <Toaster />
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
