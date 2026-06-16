# 多阶段构建：deps → builder（含预填数据库）→ runner（standalone 输出）

# --- Stage 1: 安装依赖 ---
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# --- Stage 2: 构建 Next.js + 预填充数据库 ---
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 用临时 DATABASE_URL 创建并填充数据库
ENV DATABASE_URL=file:/app/prisma/seed.db
RUN npx prisma generate
RUN npx prisma migrate deploy
RUN npx tsx prisma/seed.ts
RUN npm run build

# --- Stage 3: 运行时 ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Next.js standalone 产物 + 静态资源 + Prisma 引擎
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# 预填充的种子数据库（启动时若 volume 为空则复制为运行库）
COPY --from=builder /app/prisma/seed.db /app/prisma/seed.db

# 启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3100
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
