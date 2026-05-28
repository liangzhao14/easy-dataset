import { verifyToken } from './index';
import { db } from '@/lib/db/index';
import { ROLES } from './constants';

export async function getCurrentUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await db.users.findUnique({
    where: { id: payload.userId }
  });
  if (!user || user.status !== 1) return null;
  return user;
}

/**
 * @param {Function} handler
 * @param {Object} options
 * @param {boolean} options.requireAdmin
 * @param {string} options.minProjectRole - 'owner'|'editor'|'annotator'|'viewer'
 */
export function withAuth(handler, options = {}) {
  const { requireAdmin = false, minProjectRole = null } = options;

  return async function (request, contextOrParams) {
    // 1. 提取用户
    const user = await getCurrentUser(request);
    if (!user) {
      return Response.json({ error: '请先登录' }, { status: 401 });
    }

    // 2. 管理员检查
    if (requireAdmin && user.role !== ROLES.ADMIN) {
      return Response.json({ error: '需要管理员权限' }, { status: 403 });
    }

    // 3. 项目可见性和权限检查
    const projectId = contextOrParams?.params?.projectId;
    console.log('[AUTH] projectId:', projectId, 'user:', user.username, 'role:', user.role);
    if (projectId) {
      const project = await db.projects.findUnique({ where: { id: projectId } });
      console.log('[AUTH] project.type:', project?.projectType, 'method:', request.method);
      if (!project) {
        return Response.json({ error: '项目不存在' }, { status: 404 });
      }

      const method = request.method.toUpperCase();

      // Admin 可操作所有
      if (user.role !== ROLES.ADMIN) {
        // Demo 项目：所有用户可见，仅读
        if (project.projectType === 'demo') {
          if (method !== 'GET') {
            return Response.json({ error: '示范项目仅供查看' }, { status: 403 });
          }
        }
        // Owner 全部权限
        else if (project.ownerId === user.id) {
          // OK
        }
        // 其他：检查成员关系
        else {
          let member = await db.projectMembers.findUnique({
            where: { projectId_userId: { projectId, userId: user.id } }
          });

          if (!member && project.teamId) {
            const teamMember = await db.teamMembers.findUnique({
              where: { teamId_userId: { teamId: project.teamId, userId: user.id } }
            });
            if (teamMember) {
              member = { role: 'editor' };
            }
          }

          if (!member) {
            return Response.json({ error: '无权访问该项目' }, { status: 403 });
          }

          // 角色权限检查
          if (minProjectRole) {
            const roleLevels = { owner: 4, editor: 3, annotator: 2, viewer: 1 };
            if ((roleLevels[member.role] || 0) < (roleLevels[minProjectRole] || 1)) {
              return Response.json({ error: '当前角色无权执行此操作' }, { status: 403 });
            }
          }
        }
      }
    }

    // 4. 注入 user 到请求上下文
    request.user = user;

    // 5. 调用原始 handler
    return handler(request, contextOrParams);
  };
}
