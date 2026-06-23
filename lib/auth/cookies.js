// 会话 / 状态 Cookie 的名称与属性，以及安全跳转校验。
// 集中管理以保证 set / clear 属性一致；无 Node 依赖，可被 Edge middleware 安全 import。
// 设计参考：§13.2（会话 Cookie 防 CSRF）/ §13.4（state SameSite）/ §13.5（returnTo 防开放重定向）

export const SESSION_COOKIE = 'ed_session';
export const STATE_COOKIE = 'ed_4a_state';

const isProd = process.env.NODE_ENV === 'production';

/** 会话 Cookie：HttpOnly + SameSite=Lax + Secure(prod)，供 middleware 页面网关读取。 */
export function sessionCookieOptions(maxAgeSec = 7 * 24 * 3600) {
  return { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: maxAgeSec };
}

/** state 短时 Cookie：必须 SameSite=Lax，否则从 4A 跨站回跳时浏览器不会发送 → state 校验必失败。 */
export function stateCookieOptions(maxAgeSec = 600) {
  return { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: maxAgeSec };
}

/** 防开放重定向：仅允许同源相对路径（以 `/` 开头，且非 `//`、`/\`）。 */
export function safeReturnTo(v) {
  if (!v || typeof v !== 'string') return '/';
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return '/';
  return v;
}
