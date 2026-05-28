'use server';

import fs from 'fs';
import path from 'path';
import { getProjectRoot, readJsonFile } from './base';
import { DEFAULT_SETTINGS } from '@/constant/setting';
import { db } from '@/lib/db/index';
import { nanoid } from 'nanoid';

// 创建新项目
export async function createProject(projectData) {
  try {
    let projectId = nanoid(12);
    const projectRoot = await getProjectRoot();
    const projectDir = path.join(projectRoot, projectId);
    // 创建项目目录
    await fs.promises.mkdir(projectDir, { recursive: true });
    // 创建子目录
    await fs.promises.mkdir(path.join(projectDir, 'files'), { recursive: true }); // 原始文件
    return await db.projects.create({
      data: {
        id: projectId,
        name: projectData.name,
        description: projectData.description || '',
        ownerId: projectData.ownerId || null,
        teamId: projectData.teamId || null,
        projectType: projectData.projectType || 'personal',
        visibility: projectData.visibility || 'private'
      }
    });
  } catch (error) {
    console.error('Failed to create project in database');
    throw error;
  }
}

export async function isExistByName(name) {
  try {
    const count = await db.projects.count({
      where: {
        name: name
      }
    });
    return count > 0;
  } catch (error) {
    console.error('Failed to get project by name in database');
    throw error;
  }
}

// 获取所有项目（支持用户权限过滤）
export async function getProjects(user = null) {
  try {
    let where = {};

    if (user && user.role !== 'admin') {
      // 获取用户所属团队 ID 列表
      const userTeamIds = await db.teamMembers.findMany({
        where: { userId: user.id },
        select: { teamId: true }
      }).then(rows => rows.map(r => r.teamId));

      // 普通用户：自己的项目 + 参与的项目 + 所属团队的项目 + 示范项目
      where = {
        OR: [
          { ownerId: user.id },
          { projectType: 'demo' },
          {
            Members: {
              some: { userId: user.id }
            }
          },
          // 用户所属团队的项目
          ...(userTeamIds.length > 0 ? [{ teamId: { in: userTeamIds } }] : [])
        ]
      };
    }

    const projects = await db.projects.findMany({
      where,
      include: {
        _count: {
          select: {
            Datasets: true,
            Questions: true,
            ImageDatasets: true,
            EvalDatasets: true
          }
        }
      },
      orderBy: {
        createAt: 'desc'
      }
    });

    // 批量获取每个项目的 Token 统计（使用聚合查询优化性能）
    const projectIds = projects.map(p => p.id);

    const tokenStats = await db.llmUsageLogs.groupBy({
      by: ['projectId'],
      where: {
        projectId: {
          in: projectIds
        }
      },
      _sum: {
        inputTokens: true,
        outputTokens: true
      }
    });

    // 将 Token 统计映射到项目
    const tokenStatsMap = new Map(
      tokenStats.map(stat => [
        stat.projectId,
        {
          totalTokens: (stat._sum.inputTokens || 0) + (stat._sum.outputTokens || 0)
        }
      ])
    );

    // 合并数据
    return projects.map(project => ({
      ...project,
      totalTokens: tokenStatsMap.get(project.id)?.totalTokens || 0
    }));
  } catch (error) {
    console.error('Failed to get projects in database');
    throw error;
  }
}

// 获取项目详情
export async function getProject(projectId) {
  try {
    return await db.projects.findUnique({ where: { id: projectId } });
  } catch (error) {
    console.error('Failed to get project by id in database');
    throw error;
  }
}

// 更新项目配置
export async function updateProject(projectId, projectData) {
  try {
    delete projectData.projectId;
    return await db.projects.update({
      where: { id: projectId },
      data: { ...projectData }
    });
  } catch (error) {
    console.error('Failed to update project in database');
    throw error;
  }
}

// 删除项目
export async function deleteProject(projectId) {
  try {
    const projectRoot = await getProjectRoot();
    const projectPath = path.join(projectRoot, projectId);
    await db.projects.delete({ where: { id: projectId } });
    if (fs.existsSync(projectPath)) {
      await fs.promises.rm(projectPath, { recursive: true });
    }
    return true;
  } catch (error) {
    return false;
  }
}

// 获取任务配置
export async function getTaskConfig(projectId) {
  const projectRoot = await getProjectRoot();
  const projectPath = path.join(projectRoot, projectId);
  const taskConfigPath = path.join(projectPath, 'task-config.json');
  const taskData = await readJsonFile(taskConfigPath);
  if (!taskData) {
    return DEFAULT_SETTINGS;
  }
  return taskData;
}
