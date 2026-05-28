#!/bin/sh
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Define paths
PRISMA_DIR="/app/prisma"
PRISMA_TEMPLATE_DIR="/app/prisma-template"
DB_FILE="$PRISMA_DIR/db.sqlite"
LOCAL_DB_DIR="/app/local-db"

# ===== 1. JWT_SECRET 安全校验（生产必须） =====
DEFAULT_SECRET="easy-dataset-dev-secret-change-in-production"
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "$DEFAULT_SECRET" ]; then
    echo "${RED}=== ❌ JWT_SECRET 未设置或仍为默认值，拒绝启动 ===${NC}"
    echo "${YELLOW}请在 .env 或 docker-compose.yml 中设置 JWT_SECRET${NC}"
    echo "${YELLOW}生成方式：${NC}  openssl rand -hex 32"
    exit 1
fi
if [ "${#JWT_SECRET}" -lt 32 ]; then
    echo "${YELLOW}⚠️  JWT_SECRET 长度 < 32，建议至少 32 位${NC}"
fi

echo "${GREEN}=== Easy Dataset Database Initialization ===${NC}"

# 容器内 DATABASE_URL 固定指向持久化卷里的 SQLite（与 entrypoint 路径一致）
# 这会覆盖镜像构建时的占位 DATABASE_URL，并被 next.js / prisma 运行时使用
export DATABASE_URL="file:${DB_FILE}"
echo "[entrypoint] DATABASE_URL=${DATABASE_URL}"

# Create prisma directory if it doesn't exist
if [ ! -d "$PRISMA_DIR" ]; then
    echo "${YELLOW}Creating prisma directory...${NC}"
    mkdir -p "$PRISMA_DIR"
fi

# Check if database file exists
if [ ! -f "$DB_FILE" ]; then
    echo "${YELLOW}Database file not found at: $DB_FILE${NC}"

    # Check if local-db has files (possible configuration issue)
    if [ -d "$LOCAL_DB_DIR" ] && [ -n "$(ls -A $LOCAL_DB_DIR 2>/dev/null | grep -v 'empty.txt')" ]; then
        echo "${YELLOW}Note: local-db contains files but database is missing.${NC}"
        echo "${YELLOW}If you have existing data, ensure prisma volume is mounted.${NC}"
    fi

    # Safety check: 仅当 prisma 目录存在 *.sqlite 文件（旧 DB 残留）时才报错。
    # 仓库 schema.prisma / sql.json / generate-template.js 都是源码，不算"已有数据"。
    if ls "$PRISMA_DIR"/*.sqlite >/dev/null 2>&1; then
        echo "${RED}ERROR: prisma 目录已有 .sqlite 文件但与目标 $DB_FILE 不一致！${NC}"
        echo "${YELLOW}Files in $PRISMA_DIR:${NC}"
        ls -lh "$PRISMA_DIR"
        exit 1
    fi

    # 初始化：从模板复制 schema 等，再 db push 创建表
    echo "${GREEN}Prisma directory has no DB. Initializing...${NC}"
    if [ -d "$PRISMA_TEMPLATE_DIR" ]; then
        # 仅复制缺失的辅助文件，不覆盖已存在的（因为 schema.prisma 已通过 volume 挂载）
        for f in "$PRISMA_TEMPLATE_DIR"/*; do
            name=$(basename "$f")
            if [ ! -e "$PRISMA_DIR/$name" ]; then
                cp -r "$f" "$PRISMA_DIR/"
            fi
        done
    fi
    echo "${YELLOW}Running prisma db push to create database...${NC}"
    cd /app
    prisma db push --skip-generate --accept-data-loss
    echo "${GREEN}Database created successfully!${NC}"
else
    echo "${GREEN}Database file exists: $DB_FILE${NC}"
    # 已有 DB：执行 db push 以应用 schema 升级（新增字段/索引等）
    # --skip-generate 跳过 client 生成（构建时已生成）
    echo "${YELLOW}Applying schema migrations (idempotent)...${NC}"
    cd /app
    prisma db push --skip-generate --accept-data-loss 2>&1 | grep -vE "^(Environment|Datasource|Prisma)" || true
fi

# ===== 上传/分块目录确保存在 =====
if [ ! -d "$LOCAL_DB_DIR" ]; then
    mkdir -p "$LOCAL_DB_DIR"
fi

echo "${GREEN}=== Database Ready! Starting application... ===${NC}"
echo ""

# Execute the command passed to the container
exec "$@"
