#!/bin/bash
# 飞书活动 → 华夏AI活动地图 自动同步脚本
#
# 用法：bash scripts/sync-and-deploy.sh
# 定期：建议每周一早上 9 点执行（cron: 0 9 * * 1）
#
# 前置条件：
#   - lark-cli 已配置并有 base:record:read 权限
#   - SSH 密钥 ~/Downloads/rsaga.pem 可访问 EC2
#   - 本地项目路径: /Volumes/AJW-Data/Projects/huaxia-ai-event-map
set -euo pipefail

PROJECT_DIR="/Volumes/AJW-Data/Projects/huaxia-ai-event-map"
EC2_HOST="ec2-user@71.136.99.134"
EC2_KEY="$HOME/Downloads/rsaga.pem"
EC2_DB="~/huaxia-ai-event-map/prisma/dev.db"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SQL_FILE="/tmp/huaxia-feishu-sync-${TIMESTAMP}.sql"

echo "=== 飞书活动同步 $(date '+%Y-%m-%d %H:%M') ==="

# 1. 同步到本地 DB
cd "$PROJECT_DIR"
echo "[1/4] 从飞书拉取增量..."
npx tsx scripts/sync-feishu.ts 2>&1 | tail -5

# 2. 导出本地未来活动 ID，对比生产库找出真正增量
echo "[2/4] 对比生产库，找出增量..."
LOCAL_IDS=$(sqlite3 prisma/dev.db "SELECT quote(id) FROM Event WHERE date >= date('now') AND reviewReason LIKE '%自动同步%' AND id LIKE 'evt-fs-row-%';")
if [ -z "$LOCAL_IDS" ]; then
  echo "  本地无飞书未来活动"
  exit 0
fi

PROD_IDS=$(ssh -i "$EC2_KEY" "$EC2_HOST" "sqlite3 ${EC2_DB} 'SELECT quote(id) FROM Event WHERE id LIKE \"evt-fs-row-%\";'" 2>/dev/null || echo "")

# 找出仅在本地存在、不在生产的 ID
NEW_IDS=$(comm -23 <(echo "$LOCAL_IDS" | sort) <(echo "$PROD_IDS" | sort))
NEW_COUNT=$(echo "$NEW_IDS" | sed '/^$/d' | wc -l | tr -d ' ')

if [ "$NEW_COUNT" -eq 0 ]; then
  echo "✅ 没有新增活动，生产已是最新"
  exit 0
fi

echo "  增量: ${NEW_COUNT} 条"

# 3. 导出增量 SQL
echo "[3/4] 导出 SQL + 部署..."
# 构建 IN 子句
IN_CLAUSE=$(echo "$NEW_IDS" | paste -sd ',' -)
sqlite3 prisma/dev.db "
SELECT 'INSERT OR IGNORE INTO Event (id, title, date, city, venue, registration, benefits, requirements, contact, status, reviewReason, reviewedAt, reviewedBy, createdAt) VALUES (' ||
  quote(id) || ', ' ||
  quote(title) || ', ' ||
  quote(date) || ', ' ||
  quote(city) || ', ' ||
  quote(venue) || ', ' ||
  quote(registration) || ', ' ||
  quote(benefits) || ', ' ||
  quote(requirements) || ', ' ||
  quote(contact) || ', ' ||
  quote(status) || ', ' ||
  quote(reviewReason) || ', ' ||
  CAST(reviewedAt AS INTEGER) || ', ' ||
  quote(reviewedBy) || ', ' ||
  CAST(createdAt AS INTEGER) || ');'
FROM Event
WHERE id IN (${IN_CLAUSE});
" > "$SQL_FILE"

# 备份 + 上传 + 执行
ssh -i "$EC2_KEY" "$EC2_HOST" "cp ${EC2_DB} ${EC2_DB}.bak-${TIMESTAMP} && echo '  备份完成'"
scp -i "$EC2_KEY" "$SQL_FILE" "${EC2_HOST}:/tmp/"
ssh -i "$EC2_KEY" "$EC2_HOST" "sqlite3 ${EC2_DB} < /tmp/huaxia-feishu-sync-${TIMESTAMP}.sql && echo '  导入完成'"

# 4. 验证
echo "[4/4] 验证..."
ssh -i "$EC2_KEY" "$EC2_HOST" "curl -s http://localhost:3100/api/events | python3 -c 'import sys,json; d=json.load(sys.stdin); print(f\"  API 返回: {len(d[\"events\"])} 条活动\")'"

echo "=== 同步完成：新增 ${NEW_COUNT} 条 ==="
rm "$SQL_FILE"