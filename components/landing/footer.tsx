'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LandingLogo } from '@/components/landing/logo';
import { seo } from '@/lib/seo';
import { useState } from 'react';
import { toast } from 'sonner';

const productLinks = [
  { label: 'Call Analysis', href: '/#features' },
  { label: 'AI Roleplay', href: '/#features' },
  { label: 'Performance & Figures', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
];

const companyLinks = [
  { label: 'About Us', href: '#' },
  { label: 'Careers', href: '#' },
  { label: 'Blog', href: '#' },
  { label: 'Contact', href: '#' },
];

function FooterNewsletterForm() {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    toast.success('Thanks for subscribing.');
    setEmail('');
  }

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          autoComplete="off"
          placeholder="Enter your email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9 flex-1 rounded-lg border border-black/10 bg-black/5 px-3 text-xs tracking-tighter shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-black/40 focus:border-black/20 focus:outline-none focus:ring-1 focus:ring-black/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/40 dark:focus:border-white/20 dark:focus:ring-white/20 md:text-sm"
        />
        <button
          type="submit"
          className="group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-black/10 bg-black/5 p-0 text-sm font-medium text-black/80 shadow-sm transition-all hover:bg-black/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10 [&_svg]:size-4 [&_svg]:shrink-0"
        >
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
      </div>
      <p className="text-xs tracking-tighter text-black/40 dark:text-white/40">Sales tips and product updates, no spam.</p>
    </form>
  );
}

export function LandingFooter() {
  return (
    <footer className="rounded-xl border border-black/5 bg-black/3 p-6 dark:border-white/10 dark:bg-white/3 md:p-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 lg:col-span-2">
          <LandingLogo />
          <p className="max-w-xs text-sm tracking-tighter text-black/60 dark:text-white/60">
            {seo.defaultDescription}
          </p>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-medium tracking-tighter text-black/80 dark:text-white/80">Computer Brain</h3>
          <ul className="space-y-2">
            {productLinks.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-sm tracking-tighter text-black/60 transition-colors hover:text-black/80 dark:text-white/60 dark:hover:text-white/80"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-medium tracking-tighter text-black/80 dark:text-white/80">Company</h3>
          <ul className="space-y-2">
            {companyLinks.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-sm tracking-tighter text-black/60 transition-colors hover:text-black/80 dark:text-white/60 dark:hover:text-white/80"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 border-t border-black/5 pt-6 dark:border-white/10">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-medium tracking-tighter text-black/80 dark:text-white/80">Stay in the loop</h3>
            <p className="text-xs tracking-tighter text-black/60 dark:text-white/60">
              Get sales coaching tips, product updates, and best practices delivered to your inbox.
            </p>
          </div>
          <div className="md:flex md:items-end">
            <FooterNewsletterForm />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col justify-between gap-3 border-t border-black/5 pt-6 text-xs tracking-tighter text-black/50 sm:flex-row sm:items-center dark:border-white/10 dark:text-white/50">
        <p>© {new Date().getFullYear()} {seo.siteName}. All rights reserved.</p>
        <div className="flex gap-4">
          <Link href="#" className="transition-colors hover:text-black/70 dark:hover:text-white/70">Terms</Link>
          <Link href="#" className="transition-colors hover:text-black/70 dark:hover:text-white/70">Privacy</Link>
          <Link href="#" className="transition-colors hover:text-black/70 dark:hover:text-white/70">Cookies</Link>
        </div>
      </div>
    </footer>
  );
}
