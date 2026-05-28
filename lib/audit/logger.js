import { db } from '@/lib/db/index';

/**
 * 记录操作日志
 */
export async function logOperation({
  operatorId,
  operatorName,
  action,
  targetType,
  targetId = null,
  projectId = null,
  teamId = null,
  beforeSnapshot = null,
  afterSnapshot = null,
  ip = null,
  userAgent = null
}) {
  try {
    return await db.operationLogs.create({
      data: {
        operatorId,
        operatorName,
        action,
        targetType,
        targetId,
        projectId,
        teamId,
        beforeSnapshot: beforeSnapshot ? JSON.stringify(beforeSnapshot) : null,
        afterSnapshot: afterSnapshot ? JSON.stringify(afterSnapshot) : null,
        ip,
        userAgent
      }
    });
  } catch (error) {
    console.error('Failed to write operation log:', error);
    // 日志写入失败不应中断业务
  }
}

/**
 * 更新项目最终操作人
 */
export async function updateProjectLastOperator(projectId, userId, operationType) {
  try {
    const user = await db.users.findUnique({ where: { id: userId }, select: { displayName: true } });
    await db.projects.update({
      where: { id: projectId },
      data: {
        lastOperatorId: userId,
        lastOperatedAt: new Date(),
        lastOperationType: operationType
      }
    });
  } catch (error) {
    console.error('Failed to update project last operator:', error);
  }
}
