<div align="center">

![](./public/imgs/bg2.png)

# Easy Dataset · 企业增强版

**面向大模型微调数据集构建的一体化平台 —— 在上游 [ConardLi/easy-dataset](https://github.com/ConardLi/easy-dataset) 基础上，叠加账号认证、团队协作、权限隔离、操作审计、监控看板与 Docker 部署。**

<img src="https://img.shields.io/badge/license-AGPL--3.0-green.svg" alt="AGPL 3.0 License"/>
<img src="https://img.shields.io/badge/fork%20of-ConardLi%2Feasy--dataset-blue.svg" alt="Fork"/>
<img src="https://img.shields.io/badge/Next.js-14-black.svg" alt="Next.js 14"/>
<img src="https://img.shields.io/badge/Prisma-SQLite-2D3748.svg" alt="Prisma + SQLite"/>

</div>

> **本仓库是一个 fork。** 上游 Easy Dataset 是单机/桌面的纯数据集工具；本 fork 在其完整能力之上，叠加了**多用户账号体系、团队协作、基于角色的权限隔离、操作审计、资源监控看板和 Docker 化部署**，并正在接入**中广核 4A 统一身份认证（SSO）**。涉及多用户 / 权限 / 部署的逻辑均为本 fork 引入，上游没有。

---

## ✨ 本 fork 相比上游新增

| 能力 | 说明 |
|------|------|
| 🔐 **账号认证** | JWT（jose / HS256）+ bcrypt 密码哈希，登录页重设计（分屏浅色科技蓝），所有受保护 API 经统一 `withAuth` 高阶函数门禁 |
| 👥 **团队协作** | `Users / Teams / TeamMembers / ProjectMembers` 账号与协作层，项目可归属个人或团队 |
| 🛡️ **权限隔离（RBAC）** | 系统角色 `admin / user`；项目角色 `owner / editor / annotator / viewer`；项目类型 `personal / team / demo` |
| 📝 **操作审计** | 每次写操作落 `OperationLogs`（含前后快照、IP、UA），并维护项目"最终操作人" |
| 📊 **监控看板** | `LlmUsageLogs` 统计 Token 消耗 / API 调用 / 模型性能 |
| 🐳 **Docker 部署** | 多阶段构建镜像，entrypoint 自动 `prisma db push` 建表，bind mount 持久化，healthcheck 探活 |
| 🏢 **中广核 4A SSO**（进行中） | 登录入口前置 4A OAuth2 授权码认证，认证后仍签发本系统 JWT，下游权限/审计不变。框架已就绪，待测试密钥联调（详见 `docs/4a-sso-integration-design.md`） |

## 📦 基础能力（继承自上游）

- **文档处理 → 数据集**：PDF / Markdown / DOCX / TXT / EPUB 智能解析，多种文本分割算法，自动问题生成，领域标签树，答案 + 思维链（COT）生成，数据清洗
- **多种数据集类型**：单轮问答、多轮对话、图片问答、从领域主题直接蒸馏
- **模型评估系统**：评估集生成、Judge Model 自动评分、人工盲测竞技场（Arena）、AI 质量打分
- **导出与集成**：Alpaca / ShareGPT / Multilingual-Thinking 格式（JSON/JSONL）、LLaMA Factory 配置一键生成、Hugging Face 直传
- **模型支持**：兼容所有 OpenAI 格式 API —— OpenAI、MiniMax、Ollama（本地）、智谱、阿里百炼、OpenRouter；视觉模型支持 PDF 解析与图片问答
- **多语言界面**：中 / 英 / 土 / 葡；**桌面端**：Windows / macOS / Linux（Electron）

## 🧱 技术栈

- **框架**：Next.js 14（App Router）
- **数据库**：Prisma + SQLite（`prisma/schema.prisma` 为真相之源）
- **认证**：jose（JWT, HS256）+ bcryptjs
- **UI**：Material-UI (MUI)
- **桌面端**：Electron
- **国际化**：i18next + react-i18next
- **端口**：固定 **1717**

> ⚠️ 旧的 `ARCHITECTURE.md` 写于早期"fs 文件系统模拟数据库"时代，已过时；架构以 `prisma/schema.prisma` 与 `CLAUDE.md` 为准。

## 🚀 快速开始

### 本地开发

```bash
git clone https://github.com/liangzhao14/easy-dataset.git
cd easy-dataset

# 配置 secret（必需）：至少 32 位随机串
cp .env.example .env.local
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env.local

pnpm install
pnpm dev            # 自动 prisma db push 后启动，访问 http://localhost:1717
```

### Docker 部署（从本仓库源码构建，含本 fork 全部增强）

```bash
git clone https://github.com/liangzhao14/easy-dataset.git
cd easy-dataset

# .env.local 必须包含 JWT_SECRET（≥32 位）
cp .env.example .env.local
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env.local

docker compose up -d            # 从 Dockerfile 构建并启动，端口 1717
docker compose logs -f          # 查看日志
```

- 数据库文件首次启动**自动初始化**（无需手动 `db:push`）。
- `prisma/`（SQLite 库）与 `local-db/`（上传文件、分块、项目数据）通过 volume 持久化。
- 改源码后需 `docker compose up -d --build` 重建（生产镜像不热重载）。

> 💡 关闭多用户/4A 也能用：不配 `CGN_4A_*` 时 `/login` 为普通本地账号密码登录，本地部署不受影响。

## 🔑 角色与权限模型

```
系统角色   admin / user
项目角色   owner / editor / annotator / viewer   （annotator 可打分 / 打标签 / 备注 / 确认）
项目类型   personal / team / demo
```

所有领域实体（UploadFiles → Chunks → Questions → Datasets → 多轮/图片/评估）都挂在 `Projects` 之下；每次写操作进审计日志，LLM 调用进用量日志。

## 📁 目录速查

| 路径 | 职责 |
|------|------|
| `app/api/**/route.js` | 后端 API（受保护接口经 `withAuth`）|
| `app/projects/[projectId]/<feature>/page.js` | 各功能页面 |
| `lib/db/` | Prisma 单例 + 各表 CRUD（Server Actions）|
| `lib/auth/` `lib/audit/` | 认证鉴权 / 操作审计（本 fork 新增）|
| `lib/llm/core/providers/` | LLM provider 适配器 |
| `lib/services/tasks/` | 后台长任务编排 |
| `electron/` | 桌面端壳 |
| `docs/` | 设计文档（含 4A SSO 接入设计）|

## 🙏 致谢与许可

本项目基于 [ConardLi/easy-dataset](https://github.com/ConardLi/easy-dataset)（AGPL-3.0）二次开发，核心数据集构建能力归功于上游作者。文档站：<https://docs.easy-dataset.com>。

本项目遵循 **AGPL-3.0** 许可，详见 [LICENSE](LICENSE)。

```bibtex
@misc{miao2025easydataset,
  title={Easy Dataset: A Unified and Extensible Framework for Synthesizing LLM Fine-Tuning Data from Unstructured Documents},
  author={Ziyang Miao and Qiyu Sun and Jingyuan Wang and Yuchen Gong and Yaowei Zheng and Shiqi Li and Richong Zhang},
  year={2025},
  eprint={2507.04009},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  url={https://arxiv.org/abs/2507.04009}
}
```
