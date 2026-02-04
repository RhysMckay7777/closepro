import Link from 'next/link';
import { seo } from '@/lib/seo';

const LogoIcon = ({ className }: { className?: string }) => (
  <svg
    fill="none"
    height="32"
    viewBox="0 0 48 48"
    width="32"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    <title>{seo.siteName}</title>
    <path
      className="stroke"
      d="M20.19 5.99992C14.9 4.46992 7.46999 1.23992 4.80999 6.58992C1.89999 12.4699 7.04999 17.9999 10.41 22.3499C12.72 25.6499 11.9 28.4699 8.83999 31.6899C1.99999 38.8599 5.07999 48.4599 15.15 48.6199C19.54 48.6199 23.61 46.5399 27.48 44.4599C34.9 40.4599 39.48 43.4099 44.31 39.9399C47.55 37.6299 45.26 31.7299 43.92 28.1799C42.777 25.2112 42.7028 21.9374 43.71 18.9199C44.71 15.0999 45.35 8.91992 41.13 7.00992C39.21 6.28992 37 7.11992 35 6.46992C32.52 5.63992 31.28 2.70992 28.85 1.73992C24.12 -0.160081 24 6.99992 20.19 5.99992Z"
      stroke="currentColor"
      strokeMiterlimit="10"
      strokeWidth="0.5"
    />
    <path
      className="stroke"
      d="M33.29 31.21C36.6645 31.21 39.4 28.4745 39.4 25.1C39.4 21.7255 36.6645 18.99 33.29 18.99C29.9155 18.99 27.18 21.7255 27.18 25.1C27.18 28.4745 29.9155 31.21 33.29 31.21Z"
      stroke="currentColor"
      strokeMiterlimit="10"
      strokeWidth="0.29"
    />
  </svg>
);

export function LandingLogo({ inHeader = false }: { inHeader?: boolean }) {
  const wrapperClass = inHeader
    ? 'flex items-center gap-2'
    : 'inline-block font-semibold text-2xl text-black/80 tracking-tighter transition-opacity hover:opacity-80 dark:text-white/80';

  return (
    <Link href="/" className={wrapperClass} aria-label={seo.siteName}>
      <LogoIcon className="h-6 w-6" />
      <span className="font-bold text-2xl text-black tracking-tighter transition-colors dark:text-white">
        {seo.siteName}
      </span>
    </Link>
  );
}
