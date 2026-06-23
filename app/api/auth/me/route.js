import { getCurrentUser } from '@/lib/auth/middleware';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { SESSION_COOKIE } from '@/lib/auth/cookies';

export async function GET(request) {
  try {
    // 1) 优先 Bearer（现有行为不变，withAuth 体系保持 Bearer-only 防 CSRF §13.2）
    let user = await getCurrentUser(request);
    let cookieToken = null;

    // 2) 回退会话 Cookie（4A SSO：页面网关用 Cookie；前端借此把 token 换进 localStorage §13.3）
    if (!user) {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      if (token) {
        const payload = await verifyToken(token);
        if (payload?.userId) {
          const u = await db.users.findUnique({ where: { id: payload.userId } });
          if (u && u.status === 1) {
            user = u;
            cookieToken = token;
          }
        }
      }
    }

    if (!user) {
      return Response.json({ error: '未登录' }, { status: 401 });
    }

    const body = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role
    };
    // 仅当经 Cookie 鉴权时回传 token，供前端写入 localStorage 后续走 Bearer。
    if (cookieToken) body.token = cookieToken;

    return Response.json(body);
  } catch (error) {
    console.error('Get current user error:', error);
    return Response.json({ error: '获取用户信息失败' }, { status: 500 });
  }
}
