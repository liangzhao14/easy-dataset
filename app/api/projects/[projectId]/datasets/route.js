import { NextResponse } from 'next/server';
import { getDatasetsByPagination, updateDataset, getDatasetsById, getDatasetsCounts, getConfirmationStats } from '@/lib/db/datasets';
import { generateDatasetForQuestion } from '@/lib/services/datasets';
import { withAuth } from '@/lib/auth/middleware';
import { logOperation, updateProjectLastOperator } from '@/lib/audit/logger';

// GET: 保持原逻辑，加 auth
export const GET = withAuth(async function (request, { params }) {
  try {
    const { projectId } = params;
    if (!projectId) {
      return NextResponse.json({ error: '项目ID不能为空' }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const pageSize = parseInt(searchParams.get('pageSize')) || 10;
    const status = searchParams.get('status');
    const input = searchParams.get('input') || '';
    const field = searchParams.get('field') || 'question';
    const hasCot = searchParams.get('hasCot') || 'all';
    const isDistill = searchParams.get('isDistill') || 'all';
    const scoreRange = searchParams.get('scoreRange') || '';
    const customTag = searchParams.get('customTag') || '';
    const noteKeyword = searchParams.get('noteKeyword') || '';
    const chunkName = searchParams.get('chunkName') || '';

    let confirmed = undefined;
    if (status === 'confirmed') confirmed = true;
    if (status === 'unconfirmed') confirmed = false;

    const { data, total, confirmedCount } = await getDatasetsByPagination(
      projectId, page, pageSize, confirmed, input, field, hasCot, isDistill,
      scoreRange, customTag, noteKeyword, chunkName
    );

    const counts = await getDatasetsCounts(projectId);
    const stats = await getConfirmationStats(projectId);

    return NextResponse.json({ data, total, confirmedCount, ...counts, ...stats });
  } catch (error) {
    console.error('获取数据集失败:', String(error));
    return NextResponse.json({ error: error.message || '获取数据集失败' }, { status: 500 });
  }
});

// PATCH: 更新数据集（含标注归属）
export const PATCH = withAuth(async function (request) {
  try {
    const user = request.user;
    const { searchParams } = new URL(request.url);
    const datasetId = searchParams.get('id');
    const { answer, cot, question, confirmed } = await request.json();

    // 标注员（annotator）仅可确认/打分/打标签，不可编辑内容；编辑 answer/cot/question 需 editor+
    const isContentEdit = answer !== undefined || cot !== undefined || question !== undefined;
    const roleLevels = { admin: 5, owner: 4, editor: 3, annotator: 2, viewer: 1 };
    if (isContentEdit && (roleLevels[request.projectRole] || 0) < roleLevels.editor) {
      return NextResponse.json({ error: '标注员只能确认/打分，不能编辑内容' }, { status: 403 });
    }

    if (!datasetId) {
      return NextResponse.json({ error: 'Dataset ID cannot be empty' }, { status: 400 });
    }

    let dataset = await getDatasetsById(datasetId);
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset does not exist' }, { status: 404 });
    }

    const before = { confirmed: dataset.confirmed, answer: dataset.answer?.substring(0, 100) };

    let updateData = { id: datasetId };
    if (confirmed !== undefined) {
      updateData.confirmed = confirmed;
      if (confirmed) {
        updateData.annotatorId = user.id;
        updateData.annotatedAt = new Date();
      }
    }
    if (answer) updateData.answer = answer;
    if (cot) updateData.cot = cot;
    if (question) updateData.question = question;

    // 最后操作人
    updateData.lastOperatorId = user.id;

    await updateDataset(updateData);

    // 记录操作日志
    const action = confirmed ? 'confirm_dataset' : confirmed === false ? 'unconfirm_dataset' : 'update_dataset';
    await logOperation({
      operatorId: user.id,
      operatorName: user.displayName,
      action,
      targetType: 'dataset',
      targetId: datasetId,
      projectId: dataset.projectId,
      beforeSnapshot: before,
      afterSnapshot: { confirmed, answer: answer?.substring(0, 100) }
    });

    // 更新项目最终操作人
    await updateProjectLastOperator(dataset.projectId, user.id, action);

    return NextResponse.json({ success: true, message: 'Dataset updated successfully' });
  } catch (error) {
    console.error('Failed to update dataset:', String(error));
    return NextResponse.json({ error: error.message || 'Failed to update dataset' }, { status: 500 });
  }
}, { minProjectRole: 'annotator' });

// POST: 为单个问题同步生成数据集（问题列表「生成数据集」、自动蒸馏均调用此接口）
export const POST = withAuth(
  async function (request, { params }) {
    try {
      const user = request.user;
      const { projectId } = params;
      const { questionId, model, language } = await request.json();

      if (!projectId) {
        return NextResponse.json({ error: '项目ID不能为空' }, { status: 400 });
      }
      if (!questionId) {
        return NextResponse.json({ error: '问题ID不能为空' }, { status: 400 });
      }
      if (!model) {
        return NextResponse.json({ error: '缺少模型配置' }, { status: 400 });
      }

      // 复用答案生成服务（LLM 用量由 LLMClient 内部上报，无需重复埋点）
      const result = await generateDatasetForQuestion(projectId, questionId, { model, language });

      // 操作日志 + 项目最终操作人
      await logOperation({
        operatorId: user.id,
        operatorName: user.displayName,
        action: 'generate_dataset',
        targetType: 'dataset',
        targetId: result?.dataset?.id,
        projectId,
        afterSnapshot: { questionId, datasetId: result?.dataset?.id }
      });
      await updateProjectLastOperator(projectId, user.id, 'generate_dataset');

      return NextResponse.json(result);
    } catch (error) {
      console.error('生成数据集失败:', String(error));
      return NextResponse.json({ error: error.message || '生成数据集失败' }, { status: 500 });
    }
  },
  { minProjectRole: 'editor' }
);
