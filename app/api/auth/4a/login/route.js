// 4A 登录入口：生成 state → 跳转 4A 授权页（设计 §6.4）。
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { fourAConfig, is4AEnabled } from '@/lib/auth/4a/config';
import { STATE_COOKIE, stateCookieOptions, safeReturnTo } from '@/lib/auth/cookies';

// 读运行时 env(is4AEnabled)且会在未启用时早退、不触碰 request，
// 构建期会被静态预渲染并缓存(x-nextjs-cache HIT)，导致生产配了 4A 仍返回"未启用"。
// 与 app/api/auth/config 同因(见 commit 5bc4d1c)，强制运行时求值。
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!is4AEnabled()) {
    return NextResponse.json({ error: '4A 登录未启用' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const state = crypto.randomUUID();

  // 拼授权 URL（searchParams 自动 URLEncode，含 redirect_uri）
  const authorizeUrl = new URL(fourAConfig.authorizeUrl);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', fourAConfig.clientId);
  authorizeUrl.searchParams.set('redirect_uri', fourAConfig.redirectUri);
  authorizeUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authorizeUrl.toString(), 302);
  // state 与 returnTo 一起写入短时 Cookie，callback 校验 state、恢复 returnTo
  res.cookies.set(STATE_COOKIE, `${state}.${encodeURIComponent(returnTo)}`, stateCookieOptions());
  return res;
}
