import { db } from './index';

/**
 * 系统初始化：首次启动时创建管理员 + 迁移历史项目
 * 在 next start 或 dev 启动时通过 instrumentation 调用
 */
export async function initializeSystem() {
  try {
    // 检查是否需要初始化管理员
    const userCount = await db.users.count();
    const needsAdmin = userCount === 0;

    // 迁移无 owner 的历史项目
    const unmigratedProjects = await db.projects.findMany({
      where: { ownerId: null }
    });

    if (unmigratedProjects.length > 0 && !needsAdmin) {
      // 有未迁移项目且有管理员：将历史项目迁移给第一个管理员
      const admin = await db.users.findFirst({
        where: { role: 'admin', status: 1 }
      });

      if (admin) {
        for (const project of unmigratedProjects) {
          await db.projects.update({
            where: { id: project.id },
            data: {
              ownerId: admin.id,
              projectType: 'personal',
              visibility: 'private'
            }
          });
        }
        console.log(`✅ Migrated ${unmigratedProjects.length} legacy projects to admin ${admin.username}`);
      }
    }

    return { needsAdmin, unmigratedCount: unmigratedProjects.length };
  } catch (error) {
    console.error('System initialization error:', error);
    return { needsAdmin: false, unmigratedCount: 0, error: error.message };
  }
}
