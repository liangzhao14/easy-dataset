import { withAuth } from '@/lib/auth/middleware';
import { db } from '@/lib/db/index';

// GET: 全局统计 + 项目总览 + 标注排行 + 阶段进度
export const GET = withAuth(async function (request) {
  try {
    const user = request.user;
    const isAdmin = user.role === 'admin';
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';

    // 权限过滤：普通用户只看自己有权限的项目
    let projectFilter = {};
    if (!isAdmin) {
      const teamIds = (await db.teamMembers.findMany({
        where: { userId: user.id }, select: { teamId: true }
      })).map(r => r.teamId);
      projectFilter = {
        OR: [
          { ownerId: user.id },
          { projectType: 'demo' },
          { Members: { some: { userId: user.id } } },
          ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : [])
        ]
      };
    }

    if (type === 'overview') {
      // 项目总览
      const projects = await db.projects.findMany({
        where: projectFilter,
        include: {
          _count: { select: { Datasets: true, Questions: true, UploadFiles: true } },
          owner: { select: { id: true, displayName: true } },
          team: { select: { id: true, name: true } },
          lastOperator: { select: { id: true, displayName: true } }
        },
        orderBy: { updateAt: 'desc' }
      });

      // 统计每个项目的确认数
      const projectIds = projects.map(p => p.id);
      const confirmStats = await db.datasets.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, confirmed: true },
        _count: { id: true }
      });
      const confirmMap = new Map(confirmStats.map(s => [s.projectId, s._count.id]));

      const overview = projects.map(p => {
        const totalDatasets = p._count.Datasets;
        const confirmedCount = confirmMap.get(p.id) || 0;
        const stage = computeStage(p, totalDatasets, confirmedCount);
        return {
          id: p.id, name: p.name, projectType: p.projectType,
          teamName: p.team?.name || null, ownerName: p.owner?.displayName || '未知',
          memberCount: 0, // would need separate query
          fileCount: p._count.UploadFiles, questionCount: p._count.Questions,
          datasetCount: totalDatasets, confirmedCount,
          completionRate: totalDatasets > 0 ? Math.round((confirmedCount / totalDatasets) * 100) : 0,
          stage,
          lastOperator: p.lastOperator?.displayName || null,
          lastOperatedAt: p.lastOperatedAt
        };
      });

      return Response.json({ overview });
    }

    if (type === 'ranking') {
      // 用户标注排行
      const period = searchParams.get('period') || 'all';
      let dateFilter = {};
      const now = new Date();
      if (period === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter.annotatedAt = { gte: start };
      } else if (period === 'week') {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        dateFilter.annotatedAt = { gte: start };
      } else if (period === 'month') {
        dateFilter.annotatedAt = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
      }

      const rankings = await db.datasets.groupBy({
        by: ['annotatorId'],
        where: { confirmed: true, annotatorId: { not: null }, ...dateFilter },
        _count: { id: true }
      });

      const userIds = rankings.map(r => r.annotatorId);
      const users = await db.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, username: true }
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      const result = rankings
        .map((r, i) => ({
          rank: i + 1,
          userId: r.annotatorId,
          displayName: userMap.get(r.annotatorId)?.displayName || '未知',
          username: userMap.get(r.annotatorId)?.username || '',
          count: r._count.id
        }))
        .sort((a, b) => b.count - a.count)
        .map((r, i) => ({ ...r, rank: i + 1 }))
        .slice(0, 20);

      return Response.json({ ranking: result });
    }

    if (type === 'stats') {
      // 全局统计卡片
      const projects = await db.projects.count({ where: projectFilter });
      const projectIdsForStats = (await db.projects.findMany({
        where: projectFilter, select: { id: true }
      })).map(p => p.id);

      const [fileCount, questionCount, datasetCount, confirmedCount] = await Promise.all([
        db.uploadFiles.count({ where: { projectId: { in: projectIdsForStats } } }),
        db.questions.count({ where: { projectId: { in: projectIdsForStats } } }),
        db.datasets.count({ where: { projectId: { in: projectIdsForStats } } }),
        db.datasets.count({ where: { projectId: { in: projectIdsForStats }, confirmed: true } })
      ]);

      const avgRate = datasetCount > 0 ? Math.round((confirmedCount / datasetCount) * 100) : 0;

      return Response.json({
        stats: { projects, fileCount, questionCount, datasetCount, confirmedCount, avgCompletionRate: avgRate }
      });
    }

    // 项目内按人统计
    if (type === 'member-stats') {
      const projectId = searchParams.get('projectId');
      if (!projectId) return Response.json({ error: '缺少 projectId' }, { status: 400 });

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
    }

    return Response.json({ error: 'Unknown type' }, { status: 400 });
  } catch (error) {
    console.error('Monitoring error:', error);
    return Response.json({ error: '获取监控数据失败' }, { status: 500 });
  }
});

function computeStage(project, totalDatasets, confirmedCount) {
  // 简单阶段判断
  if (!project._count) return '未开始';
  if (project._count.UploadFiles === 0 && totalDatasets === 0) return '未开始';
  if (totalDatasets > 0 && confirmedCount === totalDatasets) return '标注完成';
  if (totalDatasets > 0 && confirmedCount > 0) return '标注中';
  if (project._count.Questions > 0) return '问题生成完成';
  if (project._count.UploadFiles > 0) return '文件解析完成';
  return '未开始';
}
