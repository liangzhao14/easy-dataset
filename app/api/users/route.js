import { withAuth } from '@/lib/auth/middleware';
import { listUsers } from '@/lib/db/users';

// 获取用户列表（供项目成员邀请等场景，任意登录用户可用）
// 仅返回基本信息（listUsers 已用 select 排除 passwordHash），且只列启用用户
export const GET = withAuth(async function () {
  try {
    const users = await listUsers({ status: 1 });
    return Response.json(users);
  } catch (error) {
    console.error('Failed to list users:', error);
    return Response.json({ error: '获取用户列表失败' }, { status: 500 });
  }
});
