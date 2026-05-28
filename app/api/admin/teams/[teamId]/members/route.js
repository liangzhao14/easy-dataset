import { withAuth } from '@/lib/auth/middleware';
import { addTeamMember, removeTeamMember } from '@/lib/db/teams';

// 添加成员
export const POST = withAuth(async function (request, { params }) {
  const { userId, role } = await request.json();
  if (!userId) return Response.json({ error: '请选择用户' }, { status: 400 });

  const member = await addTeamMember(params.teamId, userId, role || 'member');
  return Response.json(member, { status: 201 });
}, { requireAdmin: true });

// 移除成员
export const DELETE = withAuth(async function (request, { params }) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return Response.json({ error: '缺少 userId' }, { status: 400 });

  await removeTeamMember(params.teamId, userId);
  return Response.json({ success: true });
}, { requireAdmin: true });
