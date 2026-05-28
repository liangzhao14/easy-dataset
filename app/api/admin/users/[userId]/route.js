import { withAuth } from '@/lib/auth/middleware';
import { updateUser, getUserById, listUsers } from '@/lib/db/users';
import { hashPassword } from '@/lib/auth';
import { db } from '@/lib/db/index';

// 编辑用户（displayName / role / status）
export const PATCH = withAuth(async function (request, { params }) {
  try {
    const { userId } = params;
    const data = await request.json();

    const user = await getUserById(userId);
    if (!user) {
      return Response.json({ error: '用户不存在' }, { status: 404 });
    }

    const updateData = {};
    if (data.displayName !== undefined) {
      if (typeof data.displayName !== 'string' || data.displayName.length > 50) {
        return Response.json({ error: '显示名称不能超过 50 字符' }, { status: 400 });
      }
      updateData.displayName = data.displayName;
    }
    if (data.role !== undefined) {
      if (!['admin', 'user'].includes(data.role)) {
        return Response.json({ error: '无效的角色' }, { status: 400 });
      }
      // 防止把自己从管理员降级，否则可能锁定系统
      if (data.role !== 'admin' && user.role === 'admin' && user.id === request.user.id) {
        return Response.json({ error: '不能修改自己的管理员角色' }, { status: 400 });
      }
      // 防止降级最后一个管理员
      if (data.role !== 'admin' && user.role === 'admin') {
        const allAdmins = await listUsers({ role: 'admin', status: 1 });
        if (allAdmins.length <= 1) {
          return Response.json({ error: '不能降级最后一个管理员' }, { status: 400 });
        }
      }
      updateData.role = data.role;
    }
    if (data.status !== undefined) {
      if (![0, 1].includes(data.status)) {
        return Response.json({ error: '无效的状态' }, { status: 400 });
      }
      // 防止禁用自己
      if (data.status === 0 && user.id === request.user.id) {
        return Response.json({ error: '不能禁用自己' }, { status: 400 });
      }
      updateData.status = data.status;
    }

    await updateUser(userId, updateData);

    // 返回更新后的用户（不含密码）
    const updated = await getUserById(userId);
    return Response.json({
      id: updated.id,
      username: updated.username,
      displayName: updated.displayName,
      role: updated.role,
      status: updated.status
    });
  } catch (error) {
    console.error('Update user error:', error);
    return Response.json({ error: '更新用户失败' }, { status: 500 });
  }
}, { requireAdmin: true });

// 删除用户（真删除，清理所有关联数据）
export const DELETE = withAuth(async function (request, { params }) {
  try {
    const { userId } = params;
    const user = await getUserById(userId);
    if (!user) {
      return Response.json({ error: '用户不存在' }, { status: 404 });
    }
    if (user.role === 'admin') {
      const allAdmins = await listUsers({ role: 'admin', status: 1 });
      if (allAdmins.length <= 1) {
        return Response.json({ error: '不能删除最后一个管理员' }, { status: 400 });
      }
    }

    // 清理关联数据，逐层解除引用
    await db.datasets.updateMany({
      where: { annotatorId: userId },
      data: { annotatorId: null, annotatedAt: null }
    });
    await db.datasets.updateMany({
      where: { lastOperatorId: userId },
      data: { lastOperatorId: null }
    });
    await db.projects.updateMany({
      where: { ownerId: userId },
      data: { ownerId: null }
    });
    await db.projects.updateMany({
      where: { lastOperatorId: userId },
      data: { lastOperatorId: null, lastOperatedAt: null, lastOperationType: null }
    });
    await db.teamMembers.deleteMany({ where: { userId } });
    await db.projectMembers.deleteMany({ where: { userId } });
    await db.operationLogs.deleteMany({ where: { operatorId: userId } });

    // 最后删除用户
    await db.users.delete({ where: { id: userId } });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return Response.json({ error: '删除用户失败' }, { status: 500 });
  }
}, { requireAdmin: true });

// 重置密码
export const POST = withAuth(async function (request, { params }) {
  try {
    const { userId } = params;
    const { password } = await request.json();

    if (!password || typeof password !== 'string' || password.length < 8) {
      return Response.json({ error: '密码至少 8 位' }, { status: 400 });
    }
    if (password.length > 128) {
      return Response.json({ error: '密码不能超过 128 字符' }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return Response.json({ error: '用户不存在' }, { status: 404 });
    }

    await updateUser(userId, { passwordHash: hashPassword(password) });
    return Response.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return Response.json({ error: '重置密码失败' }, { status: 500 });
  }
}, { requireAdmin: true });
