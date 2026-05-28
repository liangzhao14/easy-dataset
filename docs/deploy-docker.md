# Easy Dataset Docker 部署指南

适用于 ≤20 人小团队，单机 SQLite 部署。

## 一、前提

- Docker Engine 20.10+ 或 Docker Desktop
- Docker Compose v2（`docker compose` 命令）
- 服务器至少 2 GB 内存、10 GB 磁盘

## 二、首次部署

### 1. 拉取代码

```bash
git clone https://github.com/liangzhao14/easy-dataset.git
cd easy-dataset
git checkout main
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 生成强随机密钥
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
# 编辑其他可选项（端口等）
vim .env
```

> ⚠️ **JWT_SECRET 必须设置**，否则容器启动时会退出。建议至少 32 位随机字符串。

### 3. 构建并启动

```bash
docker compose up -d --build
```

首次构建约 3-8 分钟（取决于网络）。完成后：

```bash
docker compose ps        # 应该看到 healthy 状态
docker compose logs -f   # 查看启动日志
```

### 4. 浏览器访问

打开 `http://<server-ip>:1717`

- 首次访问会跳到 `/init` 页面，引导创建初始管理员账号
- 设置好账号密码后即可登录使用

### 5. 验证关键功能

- 登录后能看到首页项目列表（首次为空）
- 访问 `/admin/users` 能创建普通用户
- 访问 `/monitoring` 能看到监控看板

## 三、日常运维

### 查看日志

```bash
docker compose logs -f easy-dataset
```

### 停止 / 重启

```bash
docker compose stop                    # 停止
docker compose start                   # 启动
docker compose restart easy-dataset    # 重启
docker compose down                    # 停止并移除容器（保留数据卷）
```

### 备份数据（关键）

所有用户数据都在 `./prisma/db.sqlite` 和 `./local-db/` 目录。

```bash
# 推荐：每天凌晨备份
mkdir -p backups
tar -czf "backups/easy-dataset-$(date +%Y%m%d).tar.gz" prisma/db.sqlite local-db/
# 保留 30 天
find backups/ -name "easy-dataset-*.tar.gz" -mtime +30 -delete
```

加到 crontab：

```cron
0 3 * * * cd /path/to/easy-dataset && tar -czf "backups/easy-dataset-$(date +\%Y\%m\%d).tar.gz" prisma/db.sqlite local-db/ && find backups/ -name "easy-dataset-*.tar.gz" -mtime +30 -delete
```

### 从备份恢复

```bash
docker compose stop
tar -xzf backups/easy-dataset-20260528.tar.gz
docker compose start
```

## 四、升级新版本

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建并启动
docker compose up -d --build

# 3. 容器启动时会自动跑 prisma db push 应用 schema 升级（新增字段/索引等）
docker compose logs -f easy-dataset
```

schema 升级是 **idempotent** 的——已有数据不会丢失，只追加新字段/索引。

## 五、常见问题

### Q1：容器启动后立即退出，日志显示 "JWT_SECRET 未设置或仍为默认值"

**原因**：`.env` 没设置 `JWT_SECRET` 或仍是 `easy-dataset-dev-secret-change-in-production`。

**解决**：

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
docker compose restart easy-dataset
```

### Q2：忘记初始管理员密码

如果还没创建任何用户：直接重新访问 `http://<server-ip>:1717` 走 `/init` 流程。

如果已经有用户但管理员忘记密码：

```bash
docker compose exec easy-dataset sh
cd /app
# 用 Prisma Studio
pnpm prisma studio --hostname 0.0.0.0 --port 5555 &
# 浏览器访问 http://<server-ip>:5555 修改 Users 表
```

或更简单——直接进 SQLite 改密码：

```bash
# 在容器外，用临时 bcrypt 容器算 hash
docker run --rm node:20-alpine sh -c "npm i bcryptjs >/dev/null 2>&1 && node -e 'console.log(require(\"bcryptjs\").hashSync(\"NEW_PASSWORD\", 10))'"
# 假设输出 hash = $2a$10$xxx

# 改 DB
docker compose exec easy-dataset sh -c "apk add --no-cache sqlite >/dev/null 2>&1; sqlite3 /app/prisma/db.sqlite \"UPDATE Users SET passwordHash='\$2a\$10\$xxx' WHERE username='admin';\""
```

### Q3：端口冲突

修改 `.env`：

```bash
HOST_PORT=8080  # 改成你想要的端口
```

然后 `docker compose up -d`。容器内部仍是 1717，只是对外端口变了。

### Q4：磁盘空间问题

```bash
# 看占用
du -sh prisma/ local-db/

# 老操作日志清理（保留最近 90 天）
docker compose exec easy-dataset sh -c "sqlite3 /app/prisma/db.sqlite \"DELETE FROM OperationLogs WHERE createAt < datetime('now', '-90 days');\""
```

### Q5：要不要装 Nginx 反代 + HTTPS？

强烈建议（生产环境）。最简单：

```nginx
server {
    listen 443 ssl http2;
    server_name dataset.example.com;
    ssl_certificate /etc/letsencrypt/live/dataset.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dataset.example.com/privkey.pem;

    client_max_body_size 200M;  # 文件上传

    location / {
        proxy_pass http://127.0.0.1:1717;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }
}
```

并把 `docker-compose.yml` 的端口改成只监听 127.0.0.1：

```yaml
ports:
  - '127.0.0.1:1717:1717'
```

## 六、监控与告警建议

容器自带 healthcheck（30 秒一次访问 `/api/auth/init`）。可以接：

- **Uptime Kuma** / **Healthchecks.io** 监控 `https://your-domain/api/auth/init`
- **磁盘空间告警**：当 `/var/lib/docker` 或备份目录 > 80% 时告警
- **登录失败激增**：定期查 OperationLogs 表里 `login_failed` action

## 七、性能参考

本仓库在以下硬件 + 数据规模实测：

- 硬件：MacBook Pro M2（≈2c4G 等效）
- 数据：15 项目 / 200 datasets / 17,289 操作日志
- 结论：
  - 50 并发标注 0 失败、p95 = 224ms
  - 60 秒持续 10 并发压测 15,828 请求 0 失败
  - 单机 SQLite 在 ≤20 人协作场景**完全够用，不会卡死**

详细测试报告：`docs/full-test-report-2026-05-28.md`

## 八、扩展到多实例？

如果将来用户超过 50 人，单机 SQLite 会成为瓶颈。届时需要：

1. 把 SQLite 迁移到 PostgreSQL（修改 `prisma/schema.prisma` 的 datasource provider）
2. 把 `app/api/auth/login/route.js` 里的内存级 loginAttempts Map 替换为 Redis
3. `local-db/` 目录改成对象存储（S3 / MinIO）
4. 多实例部署 + Nginx 负载均衡

第一阶段不必担心。
