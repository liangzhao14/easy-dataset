import { NextResponse } from 'next/server';
import { getDatasetsByPagination, updateDataset, getDatasetsById, getDatasetsCounts, getConfirmationStats } from '@/lib/db/datasets';
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
});
