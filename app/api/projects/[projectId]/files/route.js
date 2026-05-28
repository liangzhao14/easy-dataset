import { NextResponse } from 'next/server';
import { getProject } from '@/lib/db/projects';
import path from 'path';
import { getProjectRoot, ensureDir } from '@/lib/db/base';
import { promises as fs } from 'fs';
import {
  checkUploadFileInfoByMD5,
  createUploadFileInfo,
  delUploadFileInfoById,
  getUploadFilesPagination
} from '@/lib/db/upload-files';
import { getFileMD5 } from '@/lib/util/file';
import { batchSaveTags } from '@/lib/db/tags';
import { getProjectChunks, getProjectTocByName } from '@/lib/file/text-splitter';
import { handleDomainTree } from '@/lib/util/domain-tree';
import { withAuth } from '@/lib/auth/middleware';
import { logOperation, updateProjectLastOperator } from '@/lib/audit/logger';

// 服务端上传限制
const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_EXTS = ['.md', '.pdf'];

/**
 * 文件名安全化：剥离路径分隔符 / 上级目录引用 / 控制字符
 * 只保留 basename，拒绝危险字符
 */
function sanitizeFileName(rawName) {
  if (typeof rawName !== 'string' || !rawName) return null;
  // 取 basename，去掉任何路径分量
  const base = path.basename(rawName.replace(/\\/g, '/'));
  // 拒绝空、纯点、含控制字符
  if (!base || base === '.' || base === '..' || /[\x00-\x1f]/.test(base)) return null;
  // 拒绝绝对路径标识
  if (base.startsWith('/') || /^[a-zA-Z]:/.test(base)) return null;
  // 长度限制
  if (base.length > 255) return null;
  return base;
}

// Replace the deprecated config export with the new export syntax
export const dynamic = 'force-dynamic';
// This tells Next.js not to parse the request body automatically
export const bodyParser = false;

// 获取项目文件列表
export const GET = withAuth(async function (request, { params }) {
  try {
    const { projectId } = params;

    // 验证项目ID
    if (!projectId) {
      return NextResponse.json({ error: 'The project ID cannot be empty' }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const pageSize = parseInt(searchParams.get('pageSize')) || 10; // 每页10个文件，支持分页
    const fileName = searchParams.get('fileName') || '';
    const getAllIds = searchParams.get('getAllIds') === 'true'; // 新增：获取所有文件ID的标志

    // 如果请求所有文件ID，直接返回ID列表
    if (getAllIds) {
      const allFiles = await getUploadFilesPagination(projectId, 1, 9999, fileName); // 获取所有文件
      const allFileIds = allFiles.data?.map(file => String(file.id)) || [];
      return NextResponse.json({ allFileIds });
    }
    // 获取文件列表
    const files = await getUploadFilesPagination(projectId, page, pageSize, fileName);

    return NextResponse.json(files);
  } catch (error) {
    console.error('Error obtaining file list:', String(error));
    return NextResponse.json({ error: error.message || 'Error obtaining file list' }, { status: 500 });
  }
});

// 删除文件
export const DELETE = withAuth(async function (request, { params }) {
  try {
    const user = request.user;
    const { projectId } = params;
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const domainTreeAction = searchParams.get('domainTreeAction') || 'keep';

    // 从请求体中获取模型信息和语言环境
    const requestData = await request.json();
    const model = requestData.model;
    const language = requestData.language || 'en';

    // 验证项目ID和文件名
    if (!projectId) {
      return NextResponse.json({ error: 'The project ID cannot be empty' }, { status: 400 });
    }

    if (!fileId) {
      return NextResponse.json({ error: 'The file name cannot be empty' }, { status: 400 });
    }

    // 获取项目信息
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'The project does not exist' }, { status: 404 });
    }

    // 删除文件及其相关的文本块、问题和数据集
    const { stats, fileName, fileInfo } = await delUploadFileInfoById(fileId);
    const deleteToc = await getProjectTocByName(projectId, fileName);
    try {
      const projectRoot = await getProjectRoot();
      const projectPath = path.join(projectRoot, projectId);
      const tocDir = path.join(projectPath, 'toc');
      const baseName = path.basename(fileInfo.fileName, path.extname(fileInfo.fileName));
      const tocPath = path.join(tocDir, `${baseName}-toc.json`);

      // 检查文件是否存在再删除
      await fs.unlink(tocPath);
      console.log(`成功删除 TOC 文件: ${tocPath}`);
    } catch (error) {
      console.error(`删除 TOC 文件失败:`, String(error));
      // 即使 TOC 文件删除失败，不影响整体结果
    }

    // 如果选择了保持领域树不变，直接返回删除结果
    if (domainTreeAction === 'keep') {
      return NextResponse.json({
        message: '文件删除成功',
        stats: stats,
        domainTreeAction: 'keep',
        cascadeDelete: true
      });
    }

    // 处理领域树更新
    try {
      // 获取项目的所有文件
      const { chunks, toc } = await getProjectChunks(projectId);

      // 如果不存在文本块，说明项目已经没有文件了
      if (!chunks || chunks.length === 0) {
        // 清空领域树
        await batchSaveTags(projectId, []);
        return NextResponse.json({
          message: '文件删除成功，领域树已清空',
          stats: stats,
          domainTreeAction,
          cascadeDelete: true
        });
      }

      // 调用领域树处理模块
      await handleDomainTree({
        projectId,
        action: domainTreeAction,
        allToc: toc,
        model,
        language,
        deleteToc,
        project
      });
    } catch (error) {
      console.error('Error updating domain tree after file deletion:', String(error));
      // 即使领域树更新失败，也不影响文件删除的结果
    }

    return NextResponse.json({
      message: '文件删除成功',
      stats: stats,
      domainTreeAction,
      cascadeDelete: true
    });
  } catch (error) {
    console.error('Error deleting file:', String(error));
    return NextResponse.json({ error: error.message || 'Error deleting file' }, { status: 500 });
  }
}, { minProjectRole: 'editor' });

// 上传文件
export const POST = withAuth(async function (request, { params }) {
  const user = request.user;
  console.log('File upload request processing, parameters:', params);
  const { projectId } = params;

  // 验证项目ID
  if (!projectId) {
    return NextResponse.json({ error: 'The project ID cannot be empty' }, { status: 400 });
  }

  // 获取项目信息（withAuth 已校验权限，这里仅取 project 用于日志/路径）
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: 'The project does not exist' }, { status: 404 });
  }

  try {
    // 1. Content-Length 早期校验（避免读完整 buffer 才发现超大）
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: `文件大小超过限制（${MAX_UPLOAD_SIZE / 1024 / 1024} MB）` },
        { status: 413 }
      );
    }

    // 2. 文件名提取与安全化
    const encodedFileName = request.headers.get('x-file-name');
    let rawName;
    try {
      rawName = encodedFileName ? decodeURIComponent(encodedFileName) : null;
    } catch (e) {
      return NextResponse.json({ error: '文件名编码无效' }, { status: 400 });
    }
    if (!rawName) {
      return NextResponse.json(
        { error: 'The request header does not contain a file name (x-file-name)' },
        { status: 400 }
      );
    }

    const fileName = sanitizeFileName(rawName);
    if (!fileName) {
      return NextResponse.json({ error: '文件名包含非法字符或过长' }, { status: 400 });
    }

    // 3. 扩展名白名单（与提示文案对齐）
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: `仅支持以下格式：${ALLOWED_EXTS.join(', ')}（前端已将 docx/epub/txt 转换为 md）` },
        { status: 400 }
      );
    }

    // 4. 读取 body 并做最终大小校验（防止 Content-Length 撒谎）
    const arrayBuffer = await request.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: `文件大小超过限制（${MAX_UPLOAD_SIZE / 1024 / 1024} MB）` },
        { status: 413 }
      );
    }
    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json({ error: '上传内容为空' }, { status: 400 });
    }
    const fileBuffer = Buffer.from(arrayBuffer);

    // 5. 解析最终路径，并防御性校验未越过 filesDir
    const projectRoot = await getProjectRoot();
    const projectPath = path.join(projectRoot, projectId);
    const filesDir = path.join(projectPath, 'files');
    await ensureDir(filesDir);

    const filePath = path.join(filesDir, fileName);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(filesDir) + path.sep)) {
      return NextResponse.json({ error: '文件路径非法' }, { status: 400 });
    }

    await fs.writeFile(filePath, fileBuffer);
    const stats = await fs.stat(filePath);
    const md5 = await getFileMD5(filePath);

    // 6. MD5 去重：同项目内同 hash 文件直接拒绝
    const existing = await checkUploadFileInfoByMD5(projectId, md5);
    if (existing) {
      // 删除刚写入的重复文件
      await fs.unlink(filePath).catch(() => {});
      return NextResponse.json(
        { error: `文件已存在于此项目（同 MD5）：${existing.fileName}` },
        { status: 409 }
      );
    }

    let fileInfo = await createUploadFileInfo({
      projectId,
      fileName,
      size: stats.size,
      md5,
      fileExt: ext,
      path: filesDir
    });

    // 7. 操作日志 + 项目最终操作人
    await logOperation({
      operatorId: user.id,
      operatorName: user.displayName,
      action: 'upload_file',
      targetType: 'file',
      targetId: fileInfo.id,
      projectId,
      afterSnapshot: { fileName, size: stats.size }
    }).catch(e => console.warn('Audit log failed:', String(e)));
    await updateProjectLastOperator(projectId, user.id, 'upload_file').catch(() => {});

    return NextResponse.json({
      message: 'File uploaded successfully',
      fileName,
      filePath,
      fileId: fileInfo.id
    });
  } catch (error) {
    console.error('Error processing file upload:', String(error));
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      {
        error: 'File upload failed: ' + (error.message || 'Unknown error')
      },
      { status: 500 }
    );
  }
}, { minProjectRole: 'editor' });
