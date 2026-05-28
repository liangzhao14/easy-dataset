# Easy Dataset 初始化指南

本文档面向首次接手或重新部署 Easy Dataset 的开发者，帮助你从空环境完成依赖安装、数据库初始化、启动验证和常见配置。

## 1. 环境要求

- Node.js 18 或更高版本
- npm 或 pnpm
- Git
- Docker 与 Docker Compose，可选，仅 Docker 部署需要
- 可访问目标 LLM 服务的网络环境，例如 OpenAI、OpenRouter、Ollama 或智谱 AI

建议优先使用仓库锁文件对应的包管理器。如果使用 npm，请保留 `package-lock.json`；如果团队统一使用 pnpm，请保留 `pnpm-lock.yaml` 并避免混用锁文件。

## 2. 获取代码

```bash
git clone https://github.com/ConardLi/easy-dataset.git
cd easy-dataset
```

如果是在已有仓库中初始化本地环境，先确认工作区状态：

```bash
git status
```

## 3. 安装依赖

使用 npm：

```bash
npm install
```

或使用 pnpm：

```bash
pnpm install
```

## 4. 配置环境变量

项目默认使用 SQLite 与本地数据库目录。根目录 `.env` 中通常包含：

```dotenv
DATABASE_URL="file:./db.sqlite"
LOCAL_DB_PATH=./local-db
```

说明：

- `DATABASE_URL` 供 Prisma 使用，默认指向 `prisma/db.sqlite`。
- `LOCAL_DB_PATH` 供应用运行时保存本地数据库与相关数据，默认使用项目根目录下的 `local-db`。
- LLM API Key 通常在应用设置页中配置，不建议直接提交到仓库。

如果需要为不同环境配置不同模型服务，请使用本地未提交的环境变量文件或应用内设置完成。

## 5. 初始化数据库

执行 Prisma schema 同步：

```bash
npm run db:push
```

pnpm 用户可执行：

```bash
pnpm db:push
```

如需检查数据库内容，可以打开 Prisma Studio：

```bash
npm run db:studio
```

## 6. 本地开发启动

启动开发服务：

```bash
npm run dev
```

服务默认监听：

```text
http://localhost:1717
```

`npm run dev` 会先执行 `prisma db push`，再启动 Next.js 开发服务。

## 7. 生产模式启动

先构建：

```bash
npm run build
```

再启动：

```bash
npm run start
```

访问地址仍为：

```text
http://localhost:1717
```

## 8. Docker 初始化

使用官方镜像：

```bash
docker compose up -d
```

默认 `docker-compose.yml` 会挂载：

```yaml
volumes:
  - ./local-db:/app/local-db
  - ./prisma:/app/prisma
```

首次启动时会自动初始化数据库。启动后访问：

```text
http://localhost:1717
```

如需本地构建镜像：

```bash
npm run docker
docker run -d \
  --name easy-dataset \
  -p 1717:1717 \
  -v ./local-db:/app/local-db \
  -v ./prisma:/app/prisma \
  easy-dataset
```

## 9. Electron 桌面端初始化

开发模式：

```bash
npm run electron-dev
```

构建当前平台安装包：

```bash
npm run electron-build
```

按平台构建：

```bash
npm run electron-build-mac
npm run electron-build-win
npm run electron-build-linux
```

Electron 构建前会执行数据库模板生成、Prisma 同步与 Next.js 构建，请确保依赖安装完整。

## 10. 首次使用检查

启动应用后建议按以下顺序检查：

1. 打开 `http://localhost:1717`，确认首页正常加载。
2. 进入设置页，配置至少一个 LLM Provider 与模型。
3. 创建测试项目。
4. 上传一份小型 TXT 或 Markdown 文件。
5. 执行文本分割，确认 Chunk 正常生成。
6. 生成少量问题与答案，确认模型调用正常。
7. 导出 JSON 或 JSONL 数据集，确认文件格式符合预期。

## 11. 常见问题

### 端口 1717 被占用

先查找占用进程并结束，或调整启动脚本中的端口：

```bash
lsof -i :1717
```

### Prisma 数据库同步失败

确认 `.env` 存在且 `DATABASE_URL` 有效，然后重新执行：

```bash
npm run db:push
```

### LLM 调用失败

检查以下配置：

- Provider 类型是否正确
- API Key 是否有效
- Base URL 是否可访问
- 模型名称是否与服务端一致
- 本地 Ollama 模型是否已拉取并运行

### Docker 数据未持久化

确认启动命令或 `docker-compose.yml` 中挂载了 `local-db` 与 `prisma` 目录。删除容器不会删除宿主机挂载目录，但删除挂载目录会导致本地数据丢失。

## 12. 初始化完成标准

满足以下条件即可认为环境初始化完成：

- 依赖安装成功
- `npm run db:push` 执行成功
- Web 服务可通过 `http://localhost:1717` 访问
- 能创建项目并上传测试文档
- 至少一个 LLM Provider 可正常生成内容
- 数据集可成功导出
