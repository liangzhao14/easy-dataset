import { withAuth } from '@/lib/auth/middleware';
import { updateProjectMemberRole } from '@/lib/db/project-members';

export const PATCH = withAuth(async function (request, { params }) {
  const { role } = await request.json();
  await updateProjectMemberRole(params.projectId, params.userId, role);
  return Response.json({ success: true });
});
