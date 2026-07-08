#!/bin/bash
# 每天早上 9:00 把 sync 脚本写入的通知发送到飞书
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

NOTIFY_FILE="/tmp/huaxia-sync-notify.txt"
NOTIFY_CHAT="oc_aea7a0f0bfe06fb063200870e71c8205"

if [ ! -f "$NOTIFY_FILE" ] || [ ! -s "$NOTIFY_FILE" ]; then
  echo "[$(date '+%m/%d %H:%M')] 无待发通知，跳过"
  exit 0
fi

echo "[$(date '+%m/%d %H:%M')] 发送飞书通知..."
while IFS= read -r line; do
  [ -z "$line" ] && continue
  lark-cli im +messages-send --chat-id "$NOTIFY_CHAT" --text "$line" > /dev/null 2>&1 || echo "  发送失败: $line"
  echo "  ✅ $line"
done < "$NOTIFY_FILE"

# 清空通知文件
> "$NOTIFY_FILE"
echo "通知已发送完毕"
