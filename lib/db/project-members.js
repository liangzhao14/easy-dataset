'use server';
import { db } from '@/lib/db/index';

// 获取项目成员列表
export async function getProjectMembers(projectId) {
  try {
    return await db.projectMembers.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, username: true, displayName: true, role: true } }
      },
      orderBy: { createAt: 'asc' }
    });
  } catch (error) {
    console.error('Failed to get project members:', error);
    throw error;
  }
}

// 添加项目成员
export async function addProjectMember(projectId, userId, role = 'editor') {
  try {
    return await db.projectMembers.create({
      data: { projectId, userId, role },
      include: {
        user: { select: { id: true, username: true, displayName: true } }
      }
    });
  } catch (error) {
    console.error('Failed to add project member:', error);
    throw error;
  }
}

// 更新项目成员角色
export async function updateProjectMemberRole(projectId, userId, role) {
  try {
    return await db.projectMembers.update({
      where: { projectId_userId: { projectId, userId } },
      data: { role }
    });
  } catch (error) {
    console.error('Failed to update member role:', error);
    throw error;
  }
}

// 移除项目成员
export async function removeProjectMember(projectId, userId) {
  try {
    return await db.projectMembers.delete({
      where: { projectId_userId: { projectId, userId } }
    });
  } catch (error) {
    console.error('Failed to remove project member:', error);
    throw error;
  }
}

// 检查用户在项目中的角色
export async function getProjectMemberRole(projectId, userId) {
  try {
    const member = await db.projectMembers.findUnique({
      where: { projectId_userId: { projectId, userId } }
    });
    return member?.role || null;
  } catch (error) {
    console.error('Failed to get member role:', error);
    return null;
  }
}
