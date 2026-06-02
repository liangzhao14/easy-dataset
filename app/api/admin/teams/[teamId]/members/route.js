import { withAuth } from '@/lib/auth/middleware';
import { addTeamMember, removeTeamMember, getTeam } from '@/lib/db/teams';
import { logOperation } from '@/lib/audit/logger';

// 获取团队成员列表
export const GET = withAuth(async function (request, { params }) {
  const team = await getTeam(params.teamId);
  if (!team) return Response.json({ error: '团队不存在' }, { status: 404 });
  return Response.json({
    members: team.members.map(m => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      user: m.user,
      createAt: m.createAt
    }))
  });
}, { requireAdmin: true });

// 添加成员
export const POST = withAuth(async function (request, { params }) {
  const { userId, role } = await request.json();
  if (!userId) return Response.json({ error: '请选择用户' }, { status: 400 });

  try {
    const member = await addTeamMember(params.teamId, userId, role || 'member');

    await logOperation({
      operatorId: request.user.id,
      operatorName: request.user.displayName,
      action: 'add_team_member',
      targetType: 'team',
      targetId: userId,
      teamId: params.teamId,
      afterSnapshot: { userId, role: role || 'member' }
    });

    return Response.json(member, { status: 201 });
  } catch (error) {
    if (error?.code === 'P2002') {
      return Response.json({ error: '该用户已是团队成员' }, { status: 400 });
    }
    console.error('Add team member error:', error);
    return Response.json({ error: '添加成员失败' }, { status: 500 });
  }
}, { requireAdmin: true });

// 移除成员
export const DELETE = withAuth(async function (request, { params }) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return Response.json({ error: '缺少 userId' }, { status: 400 });

  try {
    await removeTeamMember(params.teamId, userId);

    await logOperation({
      operatorId: request.user.id,
      operatorName: request.user.displayName,
      action: 'remove_team_member',
      targetType: 'team',
      targetId: userId,
      teamId: params.teamId
    });

    return Response.json({ success: true });
  } catch (error) {
    if (error?.code === 'P2025') {
      return Response.json({ error: '成员不存在' }, { status: 404 });
    }
    console.error('Remove team member error:', error);
    return Response.json({ error: '移除成员失败' }, { status: 500 });
  }
}, { requireAdmin: true });
