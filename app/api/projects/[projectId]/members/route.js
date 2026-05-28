import { withAuth } from '@/lib/auth/middleware';
import { getProjectMembers, addProjectMember, removeProjectMember } from '@/lib/db/project-members';

// 获取项目成员
export const GET = withAuth(async function (request, { params }) {
  const members = await getProjectMembers(params.projectId);
  return Response.json(members);
});

// 添加成员
export const POST = withAuth(async function (request, { params }) {
  const { userId, role } = await request.json();
  if (!userId) return Response.json({ error: '请选择用户' }, { status: 400 });

  const member = await addProjectMember(params.projectId, userId, role || 'editor');
  return Response.json(member, { status: 201 });
});

// 移除成员
export const DELETE = withAuth(async function (request, { params }) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return Response.json({ error: '缺少 userId' }, { status: 400 });

  await removeProjectMember(params.projectId, userId);
  return Response.json({ success: true });
});
