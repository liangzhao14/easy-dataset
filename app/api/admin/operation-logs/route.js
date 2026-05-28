import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db/index';

export const GET = withAuth(async function (request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const pageSize = Math.min(parseInt(searchParams.get('pageSize')) || 50, 200);
    const operatorId = searchParams.get('operatorId');
    const projectId = searchParams.get('projectId');
    const action = searchParams.get('action');
    const targetType = searchParams.get('targetType');

    const where = {};
    if (operatorId) where.operatorId = operatorId;
    if (projectId) where.projectId = projectId;
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;

    const [logs, total] = await Promise.all([
      db.operationLogs.findMany({
        where,
        orderBy: { createAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          operator: { select: { id: true, username: true, displayName: true } }
        }
      }),
      db.operationLogs.count({ where })
    ]);

    return Response.json({ data: logs, total, page, pageSize });
  } catch (error) {
    console.error('Failed to get operation logs:', error);
    return Response.json({ error: '获取日志失败' }, { status: 500 });
  }
}, { requireAdmin: true });
