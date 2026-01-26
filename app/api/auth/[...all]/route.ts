import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { NextRequest, NextResponse } from 'next/server';

const handler = toNextJsHandler(auth);

export async function GET(request: NextRequest, context: any) {
  const response = await handler.GET(request, context);
  
  // #region agent log
  const setCookieHeaders = response.headers.getSetCookie();
  console.log('[DEBUG AUTH API] GET request', {
    path: request.nextUrl.pathname,
    setCookieCount: setCookieHeaders.length,
    setCookieHeaders: setCookieHeaders.map(h => h.split(';')[0]), // Just the cookie name=value part
  });
  // #endregion
  
  return response;
}

export async function POST(request: NextRequest, context: any) {
  const response = await handler.POST(request, context);
  
  // #region agent log
  const setCookieHeaders = response.headers.getSetCookie();
  console.log('[DEBUG AUTH API] POST request', {
    path: request.nextUrl.pathname,
    setCookieCount: setCookieHeaders.length,
    setCookieHeaders: setCookieHeaders.map(h => h.split(';')[0]), // Just the cookie name=value part
    status: response.status,
  });
  // #endregion
  
  return response;
}
