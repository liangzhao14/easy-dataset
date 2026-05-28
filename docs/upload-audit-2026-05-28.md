# 文件上传 - 大小限制与格式要求清单

> 审计时间：2026-05-28
> 范围：项目内所有上传入口（含文件 / 图片 / 评估集 / 数据集导入）

## 一、上传入口一览

| 入口（前端） | API 路径 | 用途 |
|------|---------|------|
| 文本分块上传（主入口） | `POST /api/projects/[id]/files` | 上传原始文档（核电法规等） |
| 图片导入（PDF→图） | `POST /api/projects/[id]/images/pdf-convert` | PDF 拆页转图 |
| 图片导入（ZIP） | `POST /api/projects/[id]/images/zip-import` | 批量导入图片压缩包 |
| 评估集导入 | `POST /api/projects/[id]/eval-datasets/import` | 导入题目（true_false/选择题/QA） |
| 数据集导入 | `POST /api/projects/[id]/datasets/import` | JSON 数组导入问答对（**非文件上传**） |
| Playground 图片 | 内嵌 base64 | 模型对话临时图片 |

## 二、格式要求

### 2.1 主入口（文本文件上传）

| 层级 | 允许的格式 | 来源 |
|------|-----------|------|
| 前端 `<input accept=>` | `.md / .txt / .docx / .pdf / .epub` | `components/text-split/components/UploadArea.js:142` |
| 客户端校验 `checkInvalidFiles` | `.md / .txt / .docx / .pdf / .epub` | `lib/file/file-process/check-file.js:33` |
| 客户端转换 `getContent` | `.docx → .md`（mammoth+turndown）<br>`.epub → .md`（jszip）<br>`.txt → .md`（仅改扩展名）<br>`.pdf` 不转换<br>`.md` 不变 | `lib/file/file-process/get-content.js` |
| **服务端校验** | **`.md / .pdf`** （比前端少 3 种） | `app/api/projects/[id]/files/route.js:189` |

⚠️ **不一致风险**：
- 服务端错误提示是 `"Only Markdown files are supported"`，但代码同时允许 `.pdf` — 提示与实现不一致
- 服务端**只允许 `.md/.pdf`**。前端 `.docx/.txt/.epub` 之所以能上传成功，是因为客户端先转换为 `.md` 后再发请求。如果绕过前端直接 `curl` 上传 `.docx`，会被服务端拒绝。
- `.txt` 在客户端只是把扩展名改成 `.md`，**不是真转换**，原始字节直接当 markdown 存。

### 2.2 图片 PDF 转换

- 服务端只允许 `.pdf`
- 输出图片格式：依赖 `lib/util/file::savePdfAsImages` 实现，默认 3 倍缩放

### 2.3 图片 ZIP 导入

- 服务端只允许 `.zip`
- 解压时仅提取这些扩展名：`.jpg / .jpeg / .png / .gif / .bmp / .webp / .svg`
- 跳过：目录、`__MACOSX/` 元数据、隐藏文件（`.开头`）

### 2.4 评估集导入

- 服务端允许 `.json / .xls / .xlsx`
- 必须同时携带 `questionType`，5 类：`true_false / single_choice / multiple_choice / short_answer / open_ended`
- 每种类型有独立 schema 校验（题目、答案、选项）

### 2.5 数据集导入

- **不是文件上传**，是 JSON body 请求
- 前端 `<input accept=".json,.jsonl,.csv">` 在客户端解析后转 JSON 数组发送
- 服务端只校验 `Array.isArray(datasets)` 和 question/answer 必填

## 三、大小限制

| 位置 | 限制值 | 文件 |
|------|-------|------|
| 客户端 `checkMaxSize` | **300 MB** | `constant/index.js` + `check-file.js` |
| Next.js 服务端 | **未配置**（依赖 `bodyParser = false` + `request.arrayBuffer()`，理论无限） | `app/api/projects/[id]/files/route.js:20` |
| Docker 资源 | 1 GB 内存软限 | `docker-compose.yml` |
| Nginx 反代（推荐） | 200 MB | `docs/deploy-docker.md` 示例 |

⚠️ **风险**：
- 服务端**没有任何大小检查**。直接 POST 一个 10 GB 文件，服务器内存会被 buffer 吃光（`request.arrayBuffer()` 把整个 body 读进内存）
- 客户端 300 MB 可被任意绕过（直接 curl 或脚本上传）

## 四、安全问题清单

### 🔴 严重 - 上传接口完全没有 `withAuth`

以下 6 个上传接口**全部缺少认证中间件**，未登录用户可直接调用：

| 接口 | 风险 |
|------|------|
| `POST /api/projects/[id]/files` | 任何人可向任意项目写入文件 |
| `POST /api/projects/[id]/images` | 任意目录注入图片 |
| `POST /api/projects/[id]/images/pdf-convert` | 任意 PDF 解析（消耗 CPU） |
| `POST /api/projects/[id]/images/zip-import` | 任意 ZIP 解压（zip bomb 风险） |
| `POST /api/projects/[id]/datasets/import` | 污染任意项目数据 |
| `POST /api/projects/[id]/eval-datasets/import` | 污染任意项目评估集 |

这些是 PRD 一期/三期遗漏的接口 — 一期只给 GET/PUT/DELETE 加了 withAuth，POST 漏了。

### 🔴 严重 - 路径注入

`app/api/projects/[id]/files/route.js:204`：

```js
const filePath = path.join(filesDir, fileName);  // fileName 来自客户端 header
await fs.writeFile(filePath, fileBuffer);
```

如果攻击者发送 `x-file-name: %2E%2E%2F%2E%2E%2Fetc%2Fpasswd`（URL 解码为 `../../etc/passwd`），文件会被写到任意路径。

虽然 Docker 内非 root 用户限制了破坏面，但仍可写到 `/app/.next/`、`/app/local-db/`、`/app/prisma/` 等敏感目录。

### 🟠 高 - 服务端无大小限制

如前所述，可被攻击者用大文件 DoS。即使 Nginx 拦截，反代后端的传输仍可耗尽 socket 缓冲区。

### 🟡 中 - MD5 去重逻辑被注释

`app/api/projects/[id]/files/route.js:213-215`：

```js
// let res = await checkUploadFileInfoByMD5(projectId, md5);
// if (res) {
//   return NextResponse.json({ error: `【${fileName}】该文件已在此项目中存在` }, { status: 400 });
// }
```

重复上传不报错也不去重，浪费磁盘空间，UploadFiles 表里会有重复 md5 记录。

### 🟡 中 - ZIP 解压无大小/数量上限

`zip-import/route.js` 全量遍历解压，无总大小检查：
- Zip bomb 攻击（小 ZIP 解压成几十 GB）会塞满磁盘
- 没有解压文件数量上限

### 🟢 低 - 服务端错误提示与代码不一致

`files/route.js:190` 错误信息：`'Only Markdown files are supported'`
实际代码允许 `.md` 和 `.pdf`。

### 🟢 低 - 文件名编码异常处理缺失

`decodeURIComponent(encodedFileName)` 失败会抛 URIError，直接 500。

## 五、其他实现细节

- 上传文件物理路径：`<getProjectRoot()>/<projectId>/files/<fileName>`
- 容器内：`/app/local-db/<projectId>/files/<fileName>`（由 Docker volume 持久化）
- 文件元数据写入 `UploadFiles` 表：fileName, fileExt, path, size, md5
- 文件解析后存入 `Chunks` 表，删除文件时级联清理 Chunks/Questions/Datasets

## 六、推荐修复优先级

| 优先级 | 项 | 工作量 |
|-------|---|-------|
| P0 | 给 6 个上传接口加 `withAuth({ minProjectRole: 'editor' })` | 30 min |
| P0 | 文件名 sanitize：剥离 `..` / `/` / `\`，只保留 basename | 10 min |
| P1 | 服务端 size 上限校验（建议 100 MB） | 15 min |
| P1 | ZIP 解压加大小/数量上限（建议 200 MB / 1000 files） | 20 min |
| P2 | MD5 去重逻辑恢复 | 5 min |
| P2 | 服务端格式白名单与前端对齐，提示文案修正 | 10 min |

## 七、当前可用格式速查

实际**能成功上传并正确解析**的格式：

| 格式 | 路径 | 备注 |
|------|------|------|
| `.md` | text-split | 原生支持，最稳 |
| `.pdf` | text-split | 走 mineru/default/vision 三种解析路径 |
| `.docx` | text-split | 客户端 mammoth 转 md（公式/复杂表格可能丢失） |
| `.epub` | text-split | 客户端 jszip 转 md |
| `.txt` | text-split | **仅改扩展名为 .md，原样存** |
| `.zip` | images/zip-import | 仅提取图片 |
| `.pdf` | images/pdf-convert | 转图片导入 |
| `.json/.xls/.xlsx` | eval-datasets | 评估题导入 |

**最大单文件**：客户端限制 300 MB，服务端实际无限。生产推荐 Nginx `client_max_body_size 200M`。
