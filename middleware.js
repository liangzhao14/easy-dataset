import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '@/lib/auth/constants';
import { is4AEnabled } from '@/lib/auth/4a/config';
import { SESSION_COOKIE } from '@/lib/auth/cookies';

// ⚠️ middleware 运行在 Edge Runtime：只能用 jose 验签会话 Cookie，
//    绝不能查库 / import Prisma / Node 模块 / 4A client（设计 §13.1）。
const secretKey = new TextEncoder().encode(JWT_SECRET);

// 页面网关白名单：无需登录态即可访问（/api 与静态资源已被 matcher 排除）。
// 登录页、首次初始化页必须放行，否则会与强制跳转形成死循环（§13.6）。
const PUBLIC_PATHS = ['/login', '/init'];

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

async function hasValidSession(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey); // 仅验签，不查库（Edge 限制）
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const response = NextResponse.next();
  // 安全响应头（保留原有行为）
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // 4A 未启用：保持原行为（本地用户名密码登录），不做页面级强制跳转。
  if (!is4AEnabled()) return response;

  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return response;

  // 有有效会话 → 放行；否则强制跳 4A 登录并带 returnTo。
  if (await hasValidSession(request)) return response;

  const loginUrl = new URL('/api/auth/4a/login', request.url);
  loginUrl.searchParams.set('returnTo', pathname + (search || ''));
  return NextResponse.redirect(loginUrl, 302);
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico|imgs).*)'
};
