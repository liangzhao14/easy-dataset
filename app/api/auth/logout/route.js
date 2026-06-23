// 登出：清会话 Cookie；若是 4A 会话则尽力做单点登出(SLO)。
// 注意：必须清 ed_session，否则 4A 登录态仍在、middleware 会重新放行/引导（§6.7）。
import { NextResponse } from 'next/server';
import { is4AEnabled, fourAConfig } from '@/lib/auth/4a/config';
import { SESSION_COOKIE, AT_COOKIE } from '@/lib/auth/cookies';

export async function POST(request) {
  // 4A 单点登出（best-effort）：切换用户场景必须先登出 4A，否则 SSO 会自动复登同一人。
  const accessToken = request.cookies.get(AT_COOKIE)?.value;
  if (is4AEnabled() && fourAConfig.logoutUrl && accessToken) {
    try {
      const { logout } = await import('@/lib/auth/4a/client');
      await logout(accessToken);
    } catch (e) {
      console.warn('[4a] 单点登出失败（忽略）：', e?.message || e);
    }
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  res.cookies.set(AT_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
