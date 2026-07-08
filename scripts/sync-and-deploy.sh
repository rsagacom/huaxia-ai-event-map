#!/bin/bash
# 飞书 AI 活动 → map.ajw.cn 自动同步
#
# 用法：bash scripts/sync-and-deploy.sh
# 定期：cron 每天凌晨 2:00
#
# 通知：通过 lark-cli → 飞书会话 oc_aea7a0f0bfe06fb063200870e71c8205
#
# 前置条件：
#   - lark-cli 已登录（lark-cli auth login）
#   - SSH 密钥可访问 EC2
set -euo pipefail

# === 环境加固：cron 环境下 PATH 可能缺失 Homebrew ===
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

PROJECT_DIR="/Volumes/AJW-Data/Projects/huaxia-ai-event-map"
EC2_HOST="ec2-user@71.136.99.134"
EC2_DB="~/huaxia-ai-event-map/prisma/dev.db"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SQL_FILE="/tmp/huaxia-feishu-sync-${TIMESTAMP}.sql"
LOG_FILE="/tmp/huaxia-sync-${TIMESTAMP}.log"
NOTIFY_CHAT="oc_aea7a0f0bfe06fb063200870e71c8205"

# SSH 密钥：自动探测可用密钥
if [ -f "$HOME/.ssh/rsaga.pem" ]; then
  EC2_KEY="$HOME/.ssh/rsaga.pem"
elif [ -f "$HOME/Downloads/rsaga.pem" ]; then
  EC2_KEY="$HOME/Downloads/rsaga.pem"
else
  echo "❌ 错误: SSH 密钥未找到"
  exit 1
fi

# === 飞书通知（通过 lark-cli） ===
feishu_notify() {
  local text="$1"
  echo "[notify] $text" | tee -a "$LOG_FILE"
  lark-cli im +messages-send --chat-id "$NOTIFY_CHAT" --text "$text" > /dev/null 2>&1 || echo "[notify] 发送失败" | tee -a "$LOG_FILE"
}

# 全局错误捕获
trap 'feishu_notify "❌ 华夏AI同步失败 — $(date "+%m/%d %H:%M")"' ERR

echo "=== 飞书 AI 活动同步 $(date '+%Y-%m-%d %H:%M') === 目标: map.ajw.cn" | tee "$LOG_FILE"

# 1. 从飞书拉取 AI 活动 → 本地 DB
echo "[1/4] 从飞书拉取 AI 活动..." | tee -a "$LOG_FILE"
cd "$PROJECT_DIR"
SYNC_OUTPUT=$(npx tsx scripts/sync-feishu.ts 2>&1)
echo "$SYNC_OUTPUT" | tail -10 | tee -a "$LOG_FILE"

# 2. 对比本地与 EC2 生产，找增量
echo "[2/4] 对比生产库，找出增量..." | tee -a "$LOG_FILE"
LOCAL_IDS=$(sqlite3 prisma/dev.db "SELECT quote(id) FROM Event WHERE date >= date('now') AND reviewReason LIKE '%自动同步%' AND (id LIKE 'evt-fs-row-%' OR id LIKE 'evt-fs-rec%');")
if [ -z "$LOCAL_IDS" ]; then
  echo "  本地无飞书未来活动" | tee -a "$LOG_FILE"
  feishu_notify "✅ 华夏AI同步完成 — 无新增活动（$(date '+%m/%d %H:%M')）map.ajw.cn"
  exit 0
fi

PROD_IDS=$(ssh -i "$EC2_KEY" "$EC2_HOST" "sqlite3 ${EC2_DB} 'SELECT quote(id) FROM Event WHERE id LIKE \"evt-fs-row-%\" OR id LIKE \"evt-fs-rec%\";'" 2>/dev/null || echo "")

# 找出仅在本地存在、不在生产的 ID
NEW_IDS=$(comm -23 <(echo "$LOCAL_IDS" | sort) <(echo "$PROD_IDS" | sort))
NEW_COUNT=$(echo "$NEW_IDS" | sed '/^$/d' | wc -l | tr -d ' ')

if [ "$NEW_COUNT" -eq 0 ]; then
  echo "✅ 没有新增活动，生产已是最新" | tee -a "$LOG_FILE"
  feishu_notify "✅ 华夏AI同步完成 — 生产已是最新（$(date '+%m/%d %H:%M')）map.ajw.cn"
  exit 0
fi

echo "  增量: ${NEW_COUNT} 条 AI 活动" | tee -a "$LOG_FILE"

# 3. 导出增量 SQL → 备份 EC2 → 上传 → 导入
echo "[3/4] 导出 SQL + 部署到 EC2..." | tee -a "$LOG_FILE"
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

ssh -i "$EC2_KEY" "$EC2_HOST" "cp ${EC2_DB} ${EC2_DB}.bak-${TIMESTAMP} && echo '  备份完成'" | tee -a "$LOG_FILE"
scp -i "$EC2_KEY" "$SQL_FILE" "${EC2_HOST}:/tmp/" 2>&1 | tee -a "$LOG_FILE"
ssh -i "$EC2_KEY" "$EC2_HOST" "sqlite3 ${EC2_DB} < /tmp/huaxia-feishu-sync-${TIMESTAMP}.sql && echo '  导入完成'" | tee -a "$LOG_FILE"

# 4. 验证生产 API
echo "[4/4] 验证..." | tee -a "$LOG_FILE"
VERIFY=$(ssh -i "$EC2_KEY" "$EC2_HOST" "curl -s http://localhost:3100/api/events | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d[\"events\"]))'" 2>/dev/null || echo "?")
echo "  map.ajw.cn API 返回: ${VERIFY} 条活动" | tee -a "$LOG_FILE"

# 提取新增活动标题用于通知
NEW_TITLES=$(sqlite3 prisma/dev.db "SELECT '- ' || title FROM Event WHERE id IN (${IN_CLAUSE}) LIMIT 5;")
TITLE_PREVIEW=$(echo "$NEW_TITLES" | sed 's/"/\\"/g' | paste -sd '\n' -)
[ "$NEW_COUNT" -gt 5 ] && TITLE_PREVIEW="${TITLE_PREVIEW}\n- ... 等共 ${NEW_COUNT} 条"

echo "=== 同步完成：新增 ${NEW_COUNT} 条 AI 活动 → map.ajw.cn ===" | tee -a "$LOG_FILE"

feishu_notify "✅ 华夏AI同步成功 — 新增 ${NEW_COUNT} 条活动 → map.ajw.cn（${VERIFY} 条）"

rm "$SQL_FILE"