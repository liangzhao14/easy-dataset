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

# Docker 部署（本 fork 增强，详见 docs/deploy-docker.md）
pnpm docker                     # docker build -t easy-dataset .
docker compose up -d            # 用 docker-compose.yml 起服务，需先设置 JWT_SECRET
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
Users / Teams / TeamMembers / ProjectMembers   ← 账号与协作层（本 fork 新增）
        │（owner / 成员 / teamId）
        ▼
Projects ──► UploadFiles → Chunks（文本块）→ Questions → Datasets
                                                   ↘ DatasetConversations（多轮）
                                                   ↘ ImageDatasets（图片问答）
                                                   ↘ EvalDatasets/EvalResults（评估）
        每次写操作 → OperationLogs（审计）＋ LlmUsageLogs（用量）→ 监控看板
```
所有领域实体都挂在 `Projects` 之下，`prisma/schema.prisma` 是真相之源（不要靠 `ARCHITECTURE.md`，那份文档写于早期 fs-DB 时代，已过时）。一个项目就是一份 LLM 微调数据集的端到端 pipeline。

> **本 fork 与上游的差异**：上游是单机/桌面的纯数据集工具；这个 fork 在其上叠加了**账号认证、团队协作、权限隔离、操作审计、监控看板与 Docker 部署**（详见 `docs/prd/` 的 PRD 一~四期与下方「协作、认证与审计」一节）。涉及多用户/权限/部署的逻辑都是本 fork 引入的，上游没有。

### 三层目录的职责划分
- **`app/`** — Next.js 14 App Router。`app/api/**/route.js` 是后端 API；`app/projects/[projectId]/<feature>/page.js` 是各功能页面（text-split / questions / datasets / multi-turn / images / eval-* / playground / settings / tasks）。
- **`lib/`** — 业务核心，**所有跨端共享的逻辑都在这里**：
  - `lib/db/index.js` — 只导出单例 Prisma 客户端 `db`（开发环境挂在 `globalThis` 上避免热重载重复实例化）。`lib/db/*.js` 其余模块各自顶部带 `'use server'`，封装某张表的 CRUD（Server Actions），由页面/接口直接 import；它们内部 `import { db } from '@/lib/db/index'` 复用同一客户端。新增表时加一个模块即可，不需要在 index 里再导出。`lib/auth/*`、`lib/audit/*` 同样复用这个 `db`（但**不是** Server Action，没有 `'use server'`，因为要在 API route 里同步调用）。
  - `lib/llm/core/index.js` — `LLMClient` 统一入口；`lib/llm/core/providers/` 下每个文件是一个 provider 适配器（openai / ollama / zhipu / openrouter / alibailian / minimax）。**新增 provider 的标准做法**：在 `providers/` 下加文件，在 `core/index.js` 的 require 列表加一行，并在 `_handleEndpoint` / 构造函数里映射 providerId。
  - `lib/llm/prompts/*.js` — 提示词模板，每个文件按场景导出多语言常量（如 `QUESTION_PROMPT`、`QUESTION_PROMPT_EN`）。运行时可被 `CustomPrompts` 表覆盖：用户在 UI 里编辑后写入 DB，调用时优先取 DB 内容、缺失才回落到代码里的默认值。
  - `lib/services/` — 业务编排层；`lib/services/tasks/<taskType>.js` 与 `Task.taskType` 字段一一对应（`file-processing`、`question-generation`、`answer-generation`、`data-distillation`、`multi-turn-generation`、`image-question-generation`、`image-dataset-generation`、`dataset-evaluation`、`model-evaluation`、`eval-generation`、`data-cleaning`）。新增长任务类型时三处要同步：services 文件、`Task.taskType` 约定、前端任务中心。
  - `lib/file/file-process/` — 各文件格式解析；`lib/file/split-markdown/` — 文本分割算法。
  - `lib/auth/` — 账号认证与鉴权（本 fork 新增）。`index.js` 封装 JWT 签发/校验（`jose`，HS256）与密码哈希（`bcryptjs`）；`middleware.js` 导出 **`withAuth(handler, options)`** 高阶函数，是所有受保护 API 的统一入口；`constants.js` 定义 `ROLES`(admin/user)、`PROJECT_ROLES`(owner/editor/annotator/viewer)、`PROJECT_TYPES`(personal/team/demo)。
  - `lib/audit/logger.js` — 操作审计（本 fork 新增）。`logOperation(...)` 把动作写入 `OperationLogs`（含前后快照、IP、UA，写失败不阻断业务）；`updateProjectLastOperator(...)` 维护项目"最终操作人"字段。
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

### 协作、认证与审计（本 fork 增强）
- **认证入口**：前端登录拿到 JWT 后，请求带 `Authorization: Bearer <token>`。后端 API 用 `withAuth(handler, { requireAdmin, minProjectRole })` 包裹：它先 `getCurrentUser()` 校验 token 并查 `Users`（要求 `status === 1`），再做管理员 / 项目角色检查，最后把 `user` 注入 `request.user` 传给 handler。**新增受保护接口的标准做法**：`export const POST = withAuth(async (request, { params }) => {...}, { minProjectRole: 'editor' })`。
- **权限模型两层**：
  - 全局角色 `Users.role`：`admin` / `user`，admin 绕过所有项目检查。
  - 项目角色（`ProjectMembers.role`）：`owner > editor > annotator > viewer`（数值 4/3/2/1，`minProjectRole` 按此比较）。项目可见性还看 `Projects.projectType`：`demo` 对所有人只读、`personal`/`team` 按归属。若用户不是直接成员但属于项目所在 `Team`（`Projects.teamId`），自动按 `editor` 放行。
  - 管理后台接口在 `app/api/admin/**`（users / teams / operation-logs），页面在 `app/admin/{users,teams,logs}`。
- **审计**：写操作调用 `lib/audit/logger.js::logOperation(...)` 落到 `OperationLogs`，并用 `updateProjectLastOperator(...)` 更新项目最终操作人。**这是约定不是强制**——新增写接口时记得手动埋点（目前仅少量接口接入）。
- **认证相关接口**：`app/api/auth/{login,logout,me,init,change-password}`；首次启动初始化管理员见 `app/init` 页面与 `INITIALIZATION.md`。
- **坑**：`JWT_SECRET` 默认值仅用于开发（见 `lib/auth/constants.js` 的告警），**生产/Docker 必须通过环境变量设置**，否则 token 可被伪造。`docker-entrypoint.sh` 已对此做校验。

### 监控看板
- 数据来源：`LlmUsageLogs`（LLM 用量，由 `lib/llm/usageLogger.js::logLlmUsage` 上报）+ `OperationLogs`（操作/标注归属）+ 各表统计。
- 接口在 `app/api/monitoring/{stats,logs,summary}`，页面在 `app/projects/[projectId]/monitoring/`（项目总览/标注排行/阶段进度）。改动 LLM 调用链时务必保留 `logLlmUsage` 上报，否则看板数据断档。

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
- 新增任何项目级 API route 默认要用 `withAuth` 包裹并指定 `minProjectRole`，否则会绕过本 fork 的权限隔离。只读接口至少 `viewer`，写接口至少 `editor`。
- 生产/Docker 环境必须设置 `JWT_SECRET` 环境变量；缺省值只在开发用且会打告警。
- 部署产物（`deploy-bundle/`、`deploy-bundle.tgz`、`easy-dataset.tar`，体积可达 GB 级）不要提交到 Git——已在 `.gitignore` 忽略。
