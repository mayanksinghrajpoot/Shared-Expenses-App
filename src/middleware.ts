import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value;
  const { pathname } = request.nextUrl;

  // Define public routes
  const isPublicRoute = pathname === '/login' || pathname === '/register';
  const isApiAuthRoute = pathname.startsWith('/api/auth');
  const isStaticFile = pathname.includes('.') || pathname.startsWith('/_next');

  if (isStaticFile || isApiAuthRoute) {
    return NextResponse.next();
  }

  if (!token && !isPublicRoute) {
    // Redirect unauthenticated user to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (token && isPublicRoute) {
    // Redirect authenticated user to dashboard
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Apply middleware to all routes except API, static assets, etc.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
