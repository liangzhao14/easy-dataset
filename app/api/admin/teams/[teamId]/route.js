import { withAuth } from '@/lib/auth/middleware';
import { getTeam, updateTeam, deleteTeam } from '@/lib/db/teams';

// 获取团队详情
export const GET = withAuth(async function (request, { params }) {
  const team = await getTeam(params.teamId);
  if (!team) return Response.json({ error: '团队不存在' }, { status: 404 });
  return Response.json(team);
}, { requireAdmin: true });

// 编辑团队
export const PATCH = withAuth(async function (request, { params }) {
  const data = await request.json();
  const team = await updateTeam(params.teamId, data);
  return Response.json(team);
}, { requireAdmin: true });

// 删除团队
export const DELETE = withAuth(async function (request, { params }) {
  await deleteTeam(params.teamId);
  return Response.json({ success: true });
}, { requireAdmin: true });
