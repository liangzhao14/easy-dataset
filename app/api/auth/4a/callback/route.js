// 4A 回调：校验 state → 换 token/取用户 → 建号 → 签 JWT 写会话 Cookie → 跳回（设计 §6.4）。
import { NextResponse } from 'next/server';
import { is4AEnabled } from '@/lib/auth/4a/config';
import { getToken, getUserInfo } from '@/lib/auth/4a/client';
import { upsertSsoUser } from '@/lib/auth/4a/user';
import { createToken } from '@/lib/auth';
import { SESSION_COOKIE, STATE_COOKIE, AT_COOKIE, sessionCookieOptions, safeReturnTo } from '@/lib/auth/cookies';

// 同 login 路由：未启用时早退、构建期会被静态缓存，强制运行时求值（见 commit 5bc4d1c）。
export const dynamic = 'force-dynamic';

/** 出错时跳登录页并带错误信息；同时清掉 state Cookie。不调 4A 登出（手册 4.2.4）。 */
function errorRedirect(origin, message) {
  const url = new URL('/login', origin);
  url.searchParams.set('error', message);
  const res = NextResponse.redirect(url.toString(), 302);
  res.cookies.delete(STATE_COOKIE);
  return res;
}

export async function GET(request) {
  if (!is4AEnabled()) {
    return NextResponse.json({ error: '4A 登录未启用' }, { status: 404 });
  }

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');

  // 1. 校验 state（防 CSRF），并恢复 returnTo
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value || '';
  const dot = stateCookie.indexOf('.');
  const savedState = dot >= 0 ? stateCookie.slice(0, dot) : stateCookie;
  const savedReturn = dot >= 0 ? decodeURIComponent(stateCookie.slice(dot + 1)) : '/';
  const returnTo = safeReturnTo(savedReturn);

  if (!code || !stateParam || !savedState || stateParam !== savedState) {
    return errorRedirect(origin, 'state 校验失败，请重新登录');
  }

  try {
    // 2. 换 token + 取用户
    const tokenResp = await getToken(code);
    const accessToken = tokenResp.access_token;
    if (!accessToken) {
      return errorRedirect(origin, '未获取到访问令牌');
    }
    const info = await getUserInfo(accessToken);
    const usercode = info.usercode;
    if (!usercode) {
      return errorRedirect(origin, '未获取到工号信息');
    }

    // 3. 建号 / 复用（默认 user、无项目权限）
    const user = await upsertSsoUser({
      usercode,
      username: info.username,
      orgname: info.orgname
    });

    // 4. 禁用校验：被禁用则提示，不跳回 4A（手册 4.2.4）
    if (user.status !== 1) {
      return errorRedirect(origin, '账号已被禁用，请联系管理员');
    }

    // 5. 签本地 JWT → 写会话 Cookie → 跳回 returnTo
    const token = await createToken(user);
    const res = NextResponse.redirect(new URL(returnTo, origin).toString(), 302);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    // 存 4A access_token 供登出时单点登出(SLO)；本地登录不会走到这里
    res.cookies.set(AT_COOKIE, accessToken, sessionCookieOptions());
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (e) {
    console.error('[4a] callback error:', e);
    return errorRedirect(origin, '4A 登录失败：' + (e?.message || '未知错误'));
  }
}
