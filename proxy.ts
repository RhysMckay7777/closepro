import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/signin', '/signup', '/', '/pricing'];
  const isPublicRoute = publicRoutes.some(route => pathname === route) || pathname.startsWith('/checkout/');

  // Special routes that handle their own authentication checks
  // These pages check for session client-side, so we allow them through
  const selfAuthRoutes = ['/dashboard/create-organization', '/dashboard/pricing'];
  const isSelfAuthRoute = selfAuthRoutes.some(route => pathname === route);

  // Check for Better Auth session cookie
  // In production with secure cookies, browser adds __Secure- prefix
  // Check all possible cookie name variations
  const sessionToken1 = request.cookies.get('__Secure-better-auth.session_token');
  const sessionToken2 = request.cookies.get('better-auth.session_token');
  const sessionToken3 = request.cookies.get('better-auth_session_token');
  const sessionToken4 = request.cookies.get('session_token');

  const sessionToken = sessionToken1 || sessionToken2 || sessionToken3 || sessionToken4;
  const hasSession = !!sessionToken;

  // Redirect to signin if accessing protected route without session
  if (!isPublicRoute && !isSelfAuthRoute && !hasSession) {
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect to dashboard if accessing auth pages while logged in
  if ((pathname === '/signin' || pathname === '/signup') && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
