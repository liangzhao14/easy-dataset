import { getCurrentUser } from '@/lib/auth/middleware';

export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return Response.json({ error: '未登录' }, { status: 401 });
    }

    return Response.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return Response.json({ error: '获取用户信息失败' }, { status: 500 });
  }
}
