import { withAuth } from '@/lib/auth/middleware';
import { getTeams, getUserTeams } from '@/lib/db/teams';

// 获取当前用户可见的团队：管理员看全部，普通用户看自己所属团队
// 供创建团队项目时的「选择团队」下拉使用
export const GET = withAuth(async function (request) {
  try {
    const user = request.user;
    const teams = user.role === 'admin' ? await getTeams() : await getUserTeams(user.id);
    return Response.json(teams);
  } catch (error) {
    console.error('Failed to get teams:', error);
    return Response.json({ error: '获取团队列表失败' }, { status: 500 });
  }
});
