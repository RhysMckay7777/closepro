import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/signin', '/signup', '/'];
  const isPublicRoute = publicRoutes.some(route => pathname === route);

  // Check for Better Auth session cookie
  const sessionToken = request.cookies.get('better-auth.session_token');

  // Redirect to signin if accessing protected route without session
  if (!isPublicRoute && !sessionToken) {
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect to dashboard if accessing auth pages while logged in
  if ((pathname === '/signin' || pathname === '/signup') && sessionToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
