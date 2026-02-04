'use client';

import Link from 'next/link';
import { ChevronDown, Menu } from 'lucide-react';
import { LandingLogo } from '@/components/landing/logo';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const navProductItems = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/#faq' },
];

const navCompanyItems = [
  { label: 'About Us', href: '#' },
  { label: 'Careers', href: '#' },
  { label: 'Blog', href: '#' },
  { label: 'Contact', href: '#' },
];

export function LandingHeader() {
  return (
    <header className="relative z-50 w-full border-b border-black/5 bg-neutral-50/80 tracking-tighter backdrop-blur-md transition-all duration-300 dark:border-white/5 dark:bg-black/80">
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="flex h-16 items-center justify-between gap-8">
          <div className="flex items-center">
            <LandingLogo inHeader />
          </div>

          <div className="hidden items-center gap-1 lg:flex">
            <nav className="group/nav flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg px-3 py-2 font-medium text-[15px] tracking-tighter text-black/80 outline-none transition-all duration-200 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
                  >
                    Product
                    <ChevronDown className="h-4 w-4 text-black/60 transition-transform duration-200 dark:text-white/60" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-40">
                  {navProductItems.map((item) => (
                    <DropdownMenuItem key={item.label} asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg px-3 py-2 font-medium text-[15px] tracking-tighter text-black/80 outline-none transition-all duration-200 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
                  >
                    Company
                    <ChevronDown className="h-4 w-4 text-black/60 transition-transform duration-200 dark:text-white/60" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-40">
                  {navCompanyItems.map((item) => (
                    <DropdownMenuItem key={item.label} asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Link
                href="/#pricing"
                className="flex items-center gap-1 rounded-lg px-3 py-2 font-medium text-[15px] tracking-tighter text-black/80 transition-all duration-200 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/5"
              >
                Pricing
              </Link>
            </nav>
            <div className="mx-3 h-4 w-px bg-black/10 dark:bg-white/10" />
            <ThemeSwitcher className="rounded-lg border-black/10 bg-transparent p-1 ring-0 dark:border-white/10" />
            <Link
              href="/signup"
              className="inline-flex h-9 w-fit items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#ecbf64] px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-[#ecbf64]/80 hover:shadow-md dark:bg-[#ecbf64] dark:text-neutral-900 dark:hover:bg-[#ecbf64]/80"
            >
              Get Started
            </Link>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeSwitcher className="rounded-lg border-black/10 bg-transparent p-1 ring-0 dark:border-white/10" />
            <Sheet>
              <SheetTrigger
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                aria-label="Toggle mobile menu"
                aria-expanded={false}
              >
                <Menu className="h-5 w-5" aria-hidden />
              </SheetTrigger>
              <SheetContent side="right" className="flex flex-col gap-6 pt-10">
                <nav className="flex flex-col gap-1">
                  {navProductItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="rounded-lg px-3 py-2 font-medium text-[15px] text-black/80 dark:text-white/80"
                    >
                      {item.label}
                    </Link>
                  ))}
                  {navCompanyItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="rounded-lg px-3 py-2 font-medium text-[15px] text-black/80 dark:text-white/80"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <Link
                    href="/#pricing"
                    className="rounded-lg px-3 py-2 font-medium text-[15px] text-black/80 dark:text-white/80"
                  >
                    Pricing
                  </Link>
                </nav>
                <Link
                  href="/signin"
                  className="inline-flex h-9 w-fit items-center justify-center rounded-lg bg-[#ecbf64] px-4 text-sm font-medium text-neutral-900 dark:bg-[#ecbf64] dark:text-neutral-900"
                >
                  Get Started
                </Link>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
