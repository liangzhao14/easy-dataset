import { createProject, getProjects, isExistByName } from '@/lib/db/projects';
import { createInitModelConfig, getModelConfigByProjectId } from '@/lib/db/model-config';
import { withAuth } from '@/lib/auth/middleware';
import { logOperation, updateProjectLastOperator } from '@/lib/audit/logger';

export const GET = withAuth(async function (request) {
  try {
    const user = request.user;
    const projects = await getProjects(user);
    return Response.json(projects);
  } catch (error) {
    console.error('Failed to get project list:', String(error));
    return Response.json({ error: String(error) }, { status: 500 });
  }
});

export const POST = withAuth(async function (request) {
  try {
    const user = request.user;
    const projectData = await request.json();

    // 仅取允许的字段，避免客户端注入 createAt / ownerId 等敏感字段
    const name = typeof projectData.name === 'string' ? projectData.name.trim() : '';
    const description = typeof projectData.description === 'string' ? projectData.description : '';
    const projectType = projectData.projectType || 'personal';
    const visibility = projectData.visibility || 'private';
    const teamId = projectData.teamId || null;
    const reuseConfigFrom = projectData.reuseConfigFrom || null;

    if (!name) {
      return Response.json({ error: 'Project name is required' }, { status: 400 });
    }
    if (name.length > 100) {
      return Response.json({ error: '项目名称不能超过 100 字符' }, { status: 400 });
    }
    if (description.length > 500) {
      return Response.json({ error: '项目描述不能超过 500 字符' }, { status: 400 });
    }
    if (!['personal', 'team', 'demo'].includes(projectType)) {
      return Response.json({ error: '无效的项目类型' }, { status: 400 });
    }
    if (await isExistByName(name)) {
      return Response.json({ error: 'Project name already exists' }, { status: 400 });
    }

    // 只有管理员可以创建示范项目
    if (projectType === 'demo' && user.role !== 'admin') {
      return Response.json({ error: '只有管理员可以创建示范项目' }, { status: 403 });
    }

    const newProject = await createProject({
      name,
      description,
      teamId,
      ownerId: user.id,
      projectType,
      visibility
    });

    if (reuseConfigFrom) {
      let data = await getModelConfigByProjectId(reuseConfigFrom);
      let newData = data.map(item => {
        delete item.id;
        return { ...item, projectId: newProject.id };
      });
      await createInitModelConfig(newData);
    }

    // 操作日志
    await logOperation({
      operatorId: user.id, operatorName: user.displayName,
      action: 'create_project', targetType: 'project', targetId: newProject.id,
      afterSnapshot: { name: newProject.name, projectType: newProject.projectType }
    });
    await updateProjectLastOperator(newProject.id, user.id, 'create_project');

    return Response.json(newProject, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', String(error));
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
