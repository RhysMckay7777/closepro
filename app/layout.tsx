import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from 'next-themes';
import { Instrument_Sans, Instrument_Serif, Space_Grotesk } from 'next/font/google';
import { UserProvider } from '@/contexts/user-context';
export const metadata: Metadata = {
  title: 'ClosePro - AI Sales Coaching',
  description: 'AI-powered sales coaching and performance analytics',
};

const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400","500", "600", "700"],
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
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <UserProvider>
          <body suppressHydrationWarning className={`${sans.variable} ${serif.variable} ${mono.variable} antialiased`}>{children}</body>
        </UserProvider>
      </ThemeProvider>
    </html>
  );
}
