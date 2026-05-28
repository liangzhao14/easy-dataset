'use server';
import { db } from '@/lib/db/index';

// 创建团队
export async function createTeam({ name, description }) {
  try {
    return await db.teams.create({
      data: { name, description: description || '' }
    });
  } catch (error) {
    console.error('Failed to create team:', error);
    throw error;
  }
}

// 获取所有团队
export async function getTeams() {
  try {
    return await db.teams.findMany({
      include: {
        _count: { select: { members: true, projects: true } },
        members: {
          include: { user: { select: { id: true, username: true, displayName: true } } }
        }
      },
      orderBy: { createAt: 'desc' }
    });
  } catch (error) {
    console.error('Failed to get teams:', error);
    throw error;
  }
}

// 获取团队详情
export async function getTeam(teamId) {
  try {
    return await db.teams.findUnique({
      where: { id: teamId },
      include: {
        _count: { select: { members: true, projects: true } },
        members: {
          include: { user: { select: { id: true, username: true, displayName: true } } }
        }
      }
    });
  } catch (error) {
    console.error('Failed to get team:', error);
    throw error;
  }
}

// 更新团队
export async function updateTeam(teamId, data) {
  try {
    return await db.teams.update({ where: { id: teamId }, data });
  } catch (error) {
    console.error('Failed to update team:', error);
    throw error;
  }
}

// 删除团队
export async function deleteTeam(teamId) {
  try {
    return await db.teams.delete({ where: { id: teamId } });
  } catch (error) {
    console.error('Failed to delete team:', error);
    throw error;
  }
}

// 添加团队成员
export async function addTeamMember(teamId, userId, role = 'member') {
  try {
    return await db.teamMembers.create({
      data: { teamId, userId, role },
      include: { user: { select: { id: true, username: true, displayName: true } } }
    });
  } catch (error) {
    console.error('Failed to add team member:', error);
    throw error;
  }
}

// 移除团队成员
export async function removeTeamMember(teamId, userId) {
  try {
    return await db.teamMembers.delete({
      where: { teamId_userId: { teamId, userId } }
    });
  } catch (error) {
    console.error('Failed to remove team member:', error);
    throw error;
  }
}

// 获取用户所属团队
export async function getUserTeams(userId) {
  try {
    const memberships = await db.teamMembers.findMany({
      where: { userId },
      include: { team: true }
    });
    return memberships.map(m => m.team);
  } catch (error) {
    console.error('Failed to get user teams:', error);
    return [];
  }
}
