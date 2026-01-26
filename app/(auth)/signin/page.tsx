'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from '@/lib/auth-client';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';

function SignInForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // #region agent log
    console.log('[DEBUG] Sign-in form submitted', {email: email.substring(0,3)+'***', timestamp: Date.now()});
    // #endregion

    try {
      const result = await signIn.email({
        email,
        password,
      });

      // #region agent log
      console.log('[DEBUG] Sign-in API response', {hasError: !!result.error, errorMessage: result.error?.message, hasData: !!result.data, timestamp: Date.now()});
      // #endregion

      // #region agent log
      const allCookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split('=');
        if (name.includes('session') || name.includes('auth')) acc[name] = value?.substring(0, 20) + '...';
        return acc;
      }, {} as Record<string, string>);
      console.log('[DEBUG] Cookies after sign-in API call', {cookieCount: Object.keys(allCookies).length, cookies: allCookies, timestamp: Date.now()});
      // #endregion

      if (result.error) {
        setError(result.error.message || 'Invalid email or password');
        setIsLoading(false);
        return;
      }

      // Get callback URL from query params, or default to dashboard
      const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
      
      // #region agent log
      console.log('[DEBUG] Before delay and redirect', {callbackUrl, delayMs: 300, timestamp: Date.now()});
      // #endregion
      
      // Small delay to ensure cookie is set by Better Auth before redirect
      // This is critical for the proxy to detect the session
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // #region agent log
      const cookiesAfterDelay = document.cookie.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split('=');
        if (name.includes('session') || name.includes('auth')) acc[name] = value?.substring(0, 20) + '...';
        return acc;
      }, {} as Record<string, string>);
      console.log('[DEBUG] Cookies after delay, before redirect', {cookieCount: Object.keys(cookiesAfterDelay).length, cookies: cookiesAfterDelay, redirectingTo: callbackUrl, timestamp: Date.now()});
      // #endregion
      
      // Use window.location.href to force a full page reload
      // This ensures the cookie is properly set and the proxy can read it
      window.location.href = callbackUrl;
    } catch (err) {
      // #region agent log
      console.log('[DEBUG] Sign-in exception caught', {errorMessage: err instanceof Error ? err.message : String(err), timestamp: Date.now()});
      // #endregion
      console.error('Signin error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
            </div>
            ClosePro
          </Link>
          <ThemeSwitcher />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <form className={cn("flex flex-col gap-6")} onSubmit={handleSubmit}>
              <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-2xl font-bold">Sign in to your account</h1>
                  <p className="text-muted-foreground text-sm text-balance">
                    Enter your email and password to sign in
                  </p>
                </div>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <FieldDescription>
                    <Link href="#" className="text-primary hover:underline">
                      Forgot your password?
                    </Link>
                  </FieldDescription>
                </Field>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Field>
                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? 'Signing in...' : 'Sign in'}
                  </Button>
                </Field>
                <FieldSeparator />
                <Field>
                  <FieldDescription className="text-center">
                    Don&apos;t have an account?{' '}
                    <Link href="/signup" className="font-medium text-primary hover:underline">
                      Sign up
                    </Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <div className="absolute inset-0 bg-linear-to-br from-primary/20 via-primary/10 to-background/50" />
        <div className="absolute inset-0 flex items-center justify-center p-10">
          <div className="max-w-md space-y-4 text-center">
            <h2 className="text-3xl font-bold">Welcome Back</h2>
            <p className="text-muted-foreground text-lg">
              Continue your journey to sales excellence with AI-powered insights and coaching.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex justify-between gap-2">
            <Link href="/" className="flex items-center gap-2 font-medium">
              <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                  <path d="M3 3v18h18" />
                  <path d="M18 17V9" />
                  <path d="M13 17V5" />
                  <path d="M8 17v-3" />
                </svg>
              </div>
              ClosePro
            </Link>
            <ThemeSwitcher />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs">
              <div className="text-center">Loading...</div>
            </div>
          </div>
        </div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
