# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
# 开发：自动跑 prisma db push 再启动 Next.js（端口 1717）
pnpm dev            # 或 npm run dev

# 构建：同样会先 prisma db push
pnpm build && pnpm start

# 数据库
pnpm db:push        # 应用 prisma/schema.prisma 到 SQLite
pnpm db:studio      # 启动 Prisma Studio 查看数据
pnpm db:template    # 生成 prisma/template.sqlite（Electron 打包用）

# 代码质量
pnpm lint           # next lint
pnpm prettier       # 全量格式化

# Electron
pnpm electron-dev               # 并行启动 next dev + Electron（开发）
pnpm electron-build-mac         # 打包 macOS
pnpm electron-build-win         # 打包 Windows
pnpm electron-build-linux       # 打包 Linux
```

注意事项：
- 端口固定 **1717**，`next.config.js` 与 Electron 主进程都依赖这个端口。
- 仓库**没有测试套件**，`package.json` 也没有 test 脚本。如需新增，与维护者确认框架。
- pnpm 与 npm lockfile 都在仓库中，但 `electron-build` 脚本系列都用 pnpm，开发优先用 pnpm。
- 提交流程：husky + lint-staged 会自动跑 prettier；commit message 走 conventional commits（`commitlint.config.mjs`）。
- PR **默认提到 `dev` 分支**（不是 main），见 README 贡献章节。

## 架构大图

### 数据流主轴
```
UploadFiles → Chunks（文本块）→ Questions → Datasets
                                       ↘ DatasetConversations（多轮）
                                       ↘ ImageDatasets（图片问答）
                                       ↘ EvalDatasets/EvalResults（评估）
```
所有领域实体都挂在 `Projects` 之下，`prisma/schema.prisma` 是真相之源（不要靠 `ARCHITECTURE.md`，那份文档写于早期 fs-DB 时代，已过时）。一个项目就是一份 LLM 微调数据集的端到端 pipeline。

### 三层目录的职责划分
- **`app/`** — Next.js 14 App Router。`app/api/**/route.js` 是后端 API；`app/projects/[projectId]/<feature>/page.js` 是各功能页面（text-split / questions / datasets / multi-turn / images / eval-* / playground / settings / tasks）。
- **`lib/`** — 业务核心，**所有跨端共享的逻辑都在这里**：
  - `lib/db/*.js` — 用 `'use server'` 声明的 Server Actions，封装 Prisma 操作。新增表的 CRUD 在这里加一个模块，对外通过 `lib/db/index.js` 重新导出。
  - `lib/llm/core/index.js` — `LLMClient` 统一入口；`lib/llm/core/providers/` 下每个文件是一个 provider 适配器（openai / ollama / zhipu / openrouter / alibailian / minimax）。**新增 provider 的标准做法**：在 `providers/` 下加文件，在 `core/index.js` 的 require 列表加一行，并在 `_handleEndpoint` / 构造函数里映射 providerId。
  - `lib/llm/prompts/*.js` — 提示词模板，每个文件按场景导出多语言常量（如 `QUESTION_PROMPT`、`QUESTION_PROMPT_EN`）。运行时可被 `CustomPrompts` 表覆盖：用户在 UI 里编辑后写入 DB，调用时优先取 DB 内容、缺失才回落到代码里的默认值。
  - `lib/services/` — 业务编排层；`lib/services/tasks/<taskType>.js` 与 `Task.taskType` 字段一一对应（`file-processing`、`question-generation`、`answer-generation`、`data-distillation`、`multi-turn-generation`、`image-question-generation`、`image-dataset-generation`、`dataset-evaluation`、`model-evaluation`、`eval-generation`、`data-cleaning`）。新增长任务类型时三处要同步：services 文件、`Task.taskType` 约定、前端任务中心。
  - `lib/file/file-process/` — 各文件格式解析；`lib/file/split-markdown/` — 文本分割算法。
- **`electron/`** — 桌面端壳。`electron/main.js` 只做编排，逻辑拆到 `electron/modules/`（window-manager、server、database、updater、ipc-handlers、cache、logger、menu）。生产环境会**内嵌启动 Next.js 服务器**（`startNextServer`）而不是请求远端。

### Web ↔ Electron 双模运行
`lib/db/base.js::getDbDirectory()` 是关键的环境分支点：
- 浏览器开发模式：`./local-db`
- Electron 渲染进程：通过 `preload.js` 暴露的 `window.electron.getUserDataPath()` 拿到用户数据目录
- Electron 主进程：`app.getPath('userData') + /local-db`
- 打包后通过 `process.resourcesPath/root-path.txt` 读取

任何涉及文件路径或数据库位置的新代码，**必须走 `getProjectRoot()` / `getProjectPath()`**，不要硬编码 `./local-db`，否则桌面端会丢数据。

### 任务系统
长时间运行的任务（生成问题、答案、清洗、评估等）都写入 `Task` 表，`status` 用 0/1/2/3（处理中/完成/失败/已中断），`completedCount/totalCount` 驱动前端进度。`lib/services/tasks/recovery.js` 在启动时把残留的"处理中"任务标记为中断。修改 LLM 调用相关逻辑时记得调用 `lib/llm/usageLogger.js::logLlmUsage` 上报到 `LlmUsageLogs`，监控看板（`app/api/monitoring/`、`app/projects/[projectId]/monitoring/`）依赖它。

### 国际化
- `lib/i18n.js` 配置 i18next；翻译资源在 `locales/{en,zh-CN,pt-BR}/translation.json`。
- 提示词同时维护多语言键（`*_EN` 后缀）。`CustomPrompts.language` 字段用来区分用户自定义版本。

### 导出格式
`components/export/` 下每个文件实现一种导出格式（Alpaca、ShareGPT、Multilingual-Thinking 等）。新增格式：加组件 + 在 `ExportDatasetDialog.js` 注册即可，数据转换逻辑保持在组件内。

## 修改时易踩的坑

- 改了 `prisma/schema.prisma` 后必须跑 `pnpm db:push`，否则 dev 启动会迁移失败。
- `lib/db/*.js` 顶部的 `'use server'` 不能去掉——这些是 Next.js Server Actions，去掉会让 Client Components 直接 import 失败。
- Electron 打包会从 `prisma/template.sqlite` 拷贝一份初始数据库给用户。schema 改动后需要 `pnpm db:template` 重新生成模板。
- `next.config.js` 里关掉了 ESLint 构建期检查，CI 不会拦住 lint 错误，**别依赖构建来发现 lint 问题**，先手动跑 `pnpm lint`。
- 新加 Prisma 关系字段记得加上 `onDelete: Cascade`（项目级删除时要清理干净），现有模型基本都这么做。
