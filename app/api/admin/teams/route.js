import { withAuth } from '@/lib/auth/middleware';
import { getTeams, createTeam } from '@/lib/db/teams';
import { logOperation } from '@/lib/audit/logger';

// 获取团队列表
export const GET = withAuth(async function () {
  try {
    const teams = await getTeams();
    return Response.json(teams);
  } catch (error) {
    return Response.json({ error: '获取团队列表失败' }, { status: 500 });
  }
}, { requireAdmin: true });

// 创建团队
export const POST = withAuth(async function (request) {
  try {
    const { name, description } = await request.json();
    if (!name) {
      return Response.json({ error: '团队名称不能为空' }, { status: 400 });
    }
    const team = await createTeam({ name, description });

    await logOperation({
      operatorId: request.user.id,
      operatorName: request.user.displayName,
      action: 'create_team',
      targetType: 'team',
      targetId: team.id,
      teamId: team.id,
      afterSnapshot: { name: team.name }
    });

    return Response.json(team, { status: 201 });
  } catch (error) {
    return Response.json({ error: '创建团队失败' }, { status: 500 });
  }
}, { requireAdmin: true });
