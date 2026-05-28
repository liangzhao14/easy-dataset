# 创建包含pnpm的基础镜像
FROM node:20-alpine AS pnpm-base
RUN npm install -g pnpm@9

# 构建阶段
FROM pnpm-base AS builder
WORKDIR /app

# 添加构建参数，用于识别目标平台
ARG TARGETPLATFORM

# 安装构建依赖
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    build-base \
    pixman-dev \
    pkgconfig

# 复制依赖文件和npm配置并安装(.npmrc中可配置国内源加速)
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install

# 复制源代码
COPY . .

# 构建期占位 DATABASE_URL（指向临时 SQLite，仅供 prisma db push 通过）
# 运行时 entrypoint 会用真实路径覆盖（/app/prisma/db.sqlite）
ENV DATABASE_URL="file:/tmp/build-placeholder.db"

# 根据目标平台设置Prisma二进制目标并构建应用
RUN if [ "$TARGETPLATFORM" = "linux/arm64" ]; then \
        echo "Configuring for ARM64 platform"; \
        sed -i 's/binaryTargets = \[.*\]/binaryTargets = \["linux-musl-arm64-openssl-3.0.x"\]/' prisma/schema.prisma; \
        PRISMA_CLI_BINARY_TARGETS="linux-musl-arm64-openssl-3.0.x" pnpm build; \
    else \
        echo "Configuring for AMD64 platform (default)"; \
        sed -i 's/binaryTargets = \[.*\]/binaryTargets = \["linux-musl-openssl-3.0.x"\]/' prisma/schema.prisma; \
        PRISMA_CLI_BINARY_TARGETS="linux-musl-openssl-3.0.x" pnpm build; \
    fi \
    && rm -f /tmp/build-placeholder.db

# 构建完成后移除开发依赖，只保留生产依赖
RUN pnpm prune --prod

# 运行阶段
FROM pnpm-base AS runner
WORKDIR /app

# 只安装运行时依赖
RUN apk add --no-cache \
    cairo \
    pango \
    jpeg \
    giflib \
    librsvg \
    pixman

# 复制 package.json（不复制 .env：JWT_SECRET 等敏感信息通过运行时 env 注入）
COPY package.json ./

# 从构建阶段复制精简后的node_modules（只包含生产依赖）
COPY --from=builder /app/node_modules ./node_modules

# entrypoint 需要 prisma CLI 跑 db push（schema 升级 / 首次建表）
# devDependency 已被 prune，这里独立安装到全局
RUN npm install -g prisma@6.6.0 --omit=optional 2>&1 | tail -5 || \
    npm install -g prisma@6 --omit=optional

# 从构建阶段复制构建产物
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/electron ./electron

# 复制 prisma 到模板目录（用于自动初始化）
COPY --from=builder /app/prisma /app/prisma-template

# 复制并设置 entrypoint 脚本（sed 去除 Windows 换行符 \r，防止 CRLF 导致 "no such file or directory"）
COPY docker-entrypoint.sh /usr/local/bin/
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# 设置生产环境
ENV NODE_ENV=production

EXPOSE 1717

# 使用 entrypoint 脚本
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["pnpm", "start"]
