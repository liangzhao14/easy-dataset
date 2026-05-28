import { deleteProject, getProject, updateProject, getTaskConfig } from '@/lib/db/projects';
import { withAuth } from '@/lib/auth/middleware';
import { logOperation, updateProjectLastOperator } from '@/lib/audit/logger';

export const GET = withAuth(async function (request, { params }) {
  try {
    const { projectId } = params;
    const project = await getProject(projectId);
    const taskConfig = await getTaskConfig(projectId);
    if (!project) {
      return Response.json({ error: '项目不存在' }, { status: 404 });
    }
    return Response.json({ ...project, taskConfig });
  } catch (error) {
    console.error('获取项目详情出错:', String(error));
    return Response.json({ error: String(error) }, { status: 500 });
  }
});

export const PUT = withAuth(async function (request, { params }) {
  try {
    const user = request.user;
    const { projectId } = params;
    const projectData = await request.json();

    const updatedProject = await updateProject(projectId, projectData);
    if (!updatedProject) {
      return Response.json({ error: '项目不存在' }, { status: 404 });
    }
    await logOperation({
      operatorId: user.id, operatorName: user.displayName,
      action: 'update_project', targetType: 'project', targetId: projectId
    });
    await updateProjectLastOperator(projectId, user.id, 'update_project');

    return Response.json(updatedProject);
  } catch (error) {
    console.error('更新项目出错:', String(error));
    return Response.json({ error: String(error) }, { status: 500 });
  }
});

export const DELETE = withAuth(async function (request, { params }) {
  try {
    const user = request.user;
    const { projectId } = params;
    const project = await getProject(projectId);

    const success = await deleteProject(projectId);
    if (!success) {
      return Response.json({ error: '项目不存在' }, { status: 404 });
    }

    await logOperation({
      operatorId: user.id, operatorName: user.displayName,
      action: 'delete_project', targetType: 'project', targetId: projectId,
      beforeSnapshot: project ? { name: project.name } : null
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('删除项目出错:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
