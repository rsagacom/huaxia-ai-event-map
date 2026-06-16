#!/bin/sh
# 容器启动脚本
set -e

# DATABASE_URL 应指向 volume 内的 db 文件，例如 file:/data/huaxia.db
DB_FILE="${DATABASE_URL#file:}"

# 首次启动：volume 为空 → 用预填充的 seed.db 初始化运行库
if [ -n "$DB_FILE" ] && [ ! -f "$DB_FILE" ]; then
  echo "📦 First boot: copying seed database to $DB_FILE..."
  mkdir -p "$(dirname "$DB_FILE")"
  cp /app/prisma/seed.db "$DB_FILE"
  echo "✅ Database initialized with 56 cities + 20 events."
fi

# 运行时迁移（兼容老 volume 的 schema 升级）
echo "🔧 Applying any pending Prisma migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>/dev/null || true

echo "🚀 Starting Next.js on port ${PORT:-3100}..."
exec "$@"
