import { NextResponse } from 'next/server';
import { getProjectPath } from '@/lib/db/base';
import { importImagesFromDirectories } from '@/lib/services/images';
import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import { withAuth } from '@/lib/auth/middleware';

// ZIP 防 bomb 限制
const MAX_ZIP_SIZE = 200 * 1024 * 1024; // 单个 ZIP 上限 200MB
const MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024; // 解压后总大小上限 500MB
const MAX_FILES_IN_ZIP = 1000; // 解压文件数量上限
const MAX_SINGLE_FILE_SIZE = 50 * 1024 * 1024; // 单个解压文件上限 50MB

// 压缩包解压并导入图片
export const POST = withAuth(async function (request, { params }) {
  let tempZipPath = null;
  let tempExtractDir = null;

  try {
    const { projectId } = params;
    const formData = await request.formData();
    const zipFile = formData.get('file');

    if (!zipFile) {
      return NextResponse.json({ error: '请选择压缩包文件' }, { status: 400 });
    }

    if (!zipFile.name || !zipFile.name.toLowerCase().endsWith('.zip')) {
      return NextResponse.json({ error: '只支持 ZIP 格式的压缩包' }, { status: 400 });
    }

    if (zipFile.size && zipFile.size > MAX_ZIP_SIZE) {
      return NextResponse.json(
        { error: `ZIP 文件大小超过限制（${MAX_ZIP_SIZE / 1024 / 1024} MB）` },
        { status: 413 }
      );
    }

    // 安全文件名
    const safeName = path.basename(zipFile.name).replace(/[\x00-\x1f/\\]/g, '_');
    if (!safeName) {
      return NextResponse.json({ error: '文件名非法' }, { status: 400 });
    }

    const projectPath = await getProjectPath(projectId);
    const tempDir = path.join(projectPath, 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    // 1. 保存压缩包到临时目录
    tempZipPath = path.join(tempDir, `temp_${Date.now()}_${safeName}`);
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
    if (zipBuffer.byteLength > MAX_ZIP_SIZE) {
      return NextResponse.json(
        { error: `ZIP 文件大小超过限制（${MAX_ZIP_SIZE / 1024 / 1024} MB）` },
        { status: 413 }
      );
    }
    await fs.writeFile(tempZipPath, zipBuffer);

    // 2. 创建临时解压目录
    tempExtractDir = path.join(tempDir, `zip_extract_${Date.now()}`);
    await fs.mkdir(tempExtractDir, { recursive: true });

    // 3. 使用 adm-zip 解压文件
    console.log('开始解压压缩包...');
    const zip = new AdmZip(tempZipPath);
    const zipEntries = zip.getEntries();

    // 防 bomb：先扫一遍 entries，校验数量与解压总大小
    if (zipEntries.length > MAX_FILES_IN_ZIP * 2) {
      // 即使大部分是目录/非图片，>2x 也明显异常
      throw new Error(`压缩包条目过多（>${MAX_FILES_IN_ZIP * 2}）`);
    }
    let totalUncompressed = 0;
    for (const e of zipEntries) {
      if (!e.isDirectory) {
        totalUncompressed += e.header.size || 0;
        if (e.header.size > MAX_SINGLE_FILE_SIZE) {
          throw new Error(`压缩包内单个文件过大（${e.entryName}, ${(e.header.size / 1024 / 1024).toFixed(1)}MB）`);
        }
      }
    }
    if (totalUncompressed > MAX_UNCOMPRESSED_SIZE) {
      throw new Error(`压缩包解压后总大小超过限制（${MAX_UNCOMPRESSED_SIZE / 1024 / 1024} MB）`);
    }

    // 支持的图片扩展名
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    let extractedCount = 0;

    // 遍历压缩包中的所有文件
    for (const entry of zipEntries) {
      // 跳过目录和隐藏文件
      if (
        entry.isDirectory ||
        entry.entryName.startsWith('__MACOSX') ||
        path.basename(entry.entryName).startsWith('.')
      ) {
        continue;
      }

      const ext = path.extname(entry.entryName).toLowerCase();
      if (imageExtensions.includes(ext)) {
        if (extractedCount >= MAX_FILES_IN_ZIP) {
          console.warn(`已达到最大解压文件数 ${MAX_FILES_IN_ZIP}，停止解压`);
          break;
        }
        // 提取文件名（不包含路径）
        const fileName = path.basename(entry.entryName);
        // 防 zip slip：basename 已剔除路径，再做一次安全化
        const safeEntryName = fileName.replace(/[\x00-\x1f/\\]/g, '_');
        if (!safeEntryName || safeEntryName === '.' || safeEntryName === '..') continue;

        // 解压文件（强制不使用 entry 内部路径）
        zip.extractEntryTo(entry, tempExtractDir, false, true, false, safeEntryName);
        extractedCount++;
      }
    }

    console.log(`压缩包解压完成，提取图片数量: ${extractedCount}`);

    if (extractedCount === 0) {
      throw new Error('压缩包中没有找到支持的图片文件');
    }

    // 4. 调用服务层导入图片
    const importResult = await importImagesFromDirectories(projectId, [tempExtractDir]);

    // 5. 清理临时文件
    try {
      if (tempZipPath) {
        await fs.unlink(tempZipPath);
      }
      if (tempExtractDir) {
        const tempImages = await fs.readdir(tempExtractDir);
        for (const img of tempImages) {
          await fs.unlink(path.join(tempExtractDir, img));
        }
        await fs.rmdir(tempExtractDir);
      }
      const tempDirContents = await fs.readdir(tempDir);
      if (tempDirContents.length === 0) {
        await fs.rmdir(tempDir);
      }
    } catch (cleanupErr) {
      console.warn('清理临时文件失败:', cleanupErr);
    }

    return NextResponse.json({
      success: true,
      count: importResult.count,
      images: importResult.images,
      zipName: zipFile.name
    });
  } catch (error) {
    console.error('Failed to import ZIP:', error);

    // 清理临时文件
    try {
      if (tempZipPath) {
        await fs.unlink(tempZipPath).catch(() => {});
      }
      if (tempExtractDir) {
        const tempImages = await fs.readdir(tempExtractDir).catch(() => []);
        for (const img of tempImages) {
          await fs.unlink(path.join(tempExtractDir, img)).catch(() => {});
        }
        await fs.rmdir(tempExtractDir).catch(() => {});
      }
    } catch (cleanupErr) {
      console.warn('清理临时文件失败:', cleanupErr);
    }

    return NextResponse.json({ error: error.message || 'Failed to import ZIP' }, { status: 500 });
  }
}, { minProjectRole: 'editor' });
