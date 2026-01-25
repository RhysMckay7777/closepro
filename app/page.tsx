import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen  flex items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center">
        <ThemeSwitcher className="mb-4 w-fit mx-auto" />
        <h1 className="text-5xl font-semibold font-serif mb-4">
          Welcome to ClosePro
        </h1>
        <p className="text-xl text-stone-600 mb-8">
          AI-powered sales coaching and performance analytics
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/signup"
          >
            <Button variant="default">
            Get Started
            </Button>
          </Link>
          <Link
            href="/signin"
          >
            <Button variant="outline">
            Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
