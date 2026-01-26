import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // #region agent log
  const allCookies: Record<string, string> = {};
  request.cookies.getAll().forEach(cookie => {
    allCookies[cookie.name] = cookie.value?.substring(0, 20) + '...';
  });
  console.log('[DEBUG PROXY] Proxy called', {pathname, cookieCount: Object.keys(allCookies).length, allCookieNames: Object.keys(allCookies), cookies: allCookies});
  // #endregion

  // Public routes that don't require authentication
  const publicRoutes = ['/signin', '/signup', '/'];
  const isPublicRoute = publicRoutes.some(route => pathname === route);

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

  // #region agent log
  console.log('[DEBUG PROXY] Cookie check results', {
    '__Secure-better-auth.session_token': !!sessionToken1,
    'better-auth.session_token': !!sessionToken2,
    'better-auth_session_token': !!sessionToken3,
    'session_token': !!sessionToken4,
    pathname
  });
  // #endregion

  const sessionToken = sessionToken1 || sessionToken2 || sessionToken3 || sessionToken4;
  const hasSession = !!sessionToken;

  // #region agent log
  console.log('[DEBUG PROXY] Session check result', {hasSession, isPublicRoute, isSelfAuthRoute, pathname});
  // #endregion

  // Redirect to signin if accessing protected route without session
  if (!isPublicRoute && !isSelfAuthRoute && !hasSession) {
    // #region agent log
    console.log('[DEBUG PROXY] Redirecting to signin - no session', {pathname, reason: 'no session token found'});
    // #endregion
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect to dashboard if accessing auth pages while logged in
  if ((pathname === '/signin' || pathname === '/signup') && hasSession) {
    // #region agent log
    console.log('[DEBUG PROXY] Redirecting to dashboard - has session', {pathname});
    // #endregion
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // #region agent log
  console.log('[DEBUG PROXY] Proxy allowing request through', {pathname, hasSession});
  // #endregion

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
