import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db/index';

export const GET = withAuth(async function (request, { params }) {
  try {
    const { projectId } = params;
    const members = await db.projectMembers.findMany({
      where: { projectId },
      include: { user: { select: { id: true, displayName: true, username: true } } }
    });

    const memberIds = members.map(m => m.userId);
    const annotationStats = await db.datasets.groupBy({
      by: ['annotatorId'],
      where: { projectId, annotatorId: { in: memberIds }, confirmed: true },
      _count: { id: true }
    });
    const annotMap = new Map(annotationStats.map(s => [s.annotatorId, s._count.id]));

    const result = members.map(m => ({
      userId: m.userId,
      displayName: m.user.displayName,
      username: m.user.username,
      role: m.role,
      annotationCount: annotMap.get(m.userId) || 0
    }));

    return Response.json({ members: result });
  } catch (error) {
    console.error('Failed to get member stats:', error);
    return Response.json({ error: '获取失败' }, { status: 500 });
  }
});
