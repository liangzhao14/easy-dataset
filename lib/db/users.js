'use server';
import { db } from '@/lib/db/index';

/**
 * 根据用户名查找用户
 */
export async function getUserByUsername(username) {
  try {
    return await db.users.findUnique({ where: { username } });
  } catch (error) {
    console.error('Failed to get user by username:', error);
    throw error;
  }
}

/**
 * 根据 ID 查找用户
 */
export async function getUserById(id) {
  try {
    return await db.users.findUnique({ where: { id } });
  } catch (error) {
    console.error('Failed to get user by id:', error);
    throw error;
  }
}

/**
 * 创建用户
 */
export async function createUser({ username, displayName, passwordHash, role = 'user' }) {
  try {
    return await db.users.create({
      data: { username, displayName, passwordHash, role }
    });
  } catch (error) {
    console.error('Failed to create user:', error);
    throw error;
  }
}

/**
 * 更新用户
 */
export async function updateUser(userId, data) {
  try {
    return await db.users.update({
      where: { id: userId },
      data
    });
  } catch (error) {
    console.error('Failed to update user:', error);
    throw error;
  }
}

/**
 * 列出所有用户
 */
export async function listUsers({ role, status } = {}) {
  try {
    const where = {};
    if (role) where.role = role;
    if (status !== undefined) where.status = status;

    return await db.users.findMany({
      where,
      orderBy: { createAt: 'desc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createAt: true,
        updateAt: true
      }
    });
  } catch (error) {
    console.error('Failed to list users:', error);
    throw error;
  }
}

/**
 * 获取用户总数
 */
export async function countUsers() {
  try {
    return await db.users.count();
  } catch (error) {
    console.error('Failed to count users:', error);
    return 0;
  }
}
