# 🗺️ 华夏AI线下活动地图 | HUAXIA AI Offline Event Map

> 全国 AI 线下活动一图尽览 — 会议、论坛、沙龙、工坊，实时标注，在线提交

> A nationwide interactive map for AI offline events in China — conferences, forums, meetups & workshops, with real-time markers and online submission.

---

## ✨ 功能特性 | Features

### 🗺️ 科技感中国地图 | Interactive China Map
- 基于百度 ECharts 的深色科技风中国地图
- 56 座大中小城市精确标注（一线/二线/三线分级）
- 有活动的城市自动显示**涟漪脉冲动画**，活动越多光点越大
- 鼠标悬停显示城市活动详情
- 支持地图缩放和拖拽

### 📋 活动列表 | Event List
- 右侧面板实时显示活动卡片
- 每条活动包含：**主题、时间、城市/场馆、报名方式、活动福利、参加要求**
- 点击地图城市可**筛选**该城市的活动
- 支持清除筛选回到全部活动

### ⏱️ 时间轴 | Timeline
- 年度时间轴可视化进度条
- 可选择起止日期精确筛选
- 快捷按钮：**近1月 / 近3月 / 近6月 / 全年**
- 地图和列表联动过滤

### 📝 在线提交活动 | Submit Event
- 点击「＋ 提交活动」打开表单弹窗
- 必填字段：活动主题、时间（精确到时分）、城市、详细地址
- 可选字段：报名方式、活动福利、参加要求、联系方式
- 提交后实时更新地图和列表

### 🤖 智能识别填表 | AI Auto-Fill
- 提交活动时支持**上传活动海报图片**或**粘贴活动文本**
- AI 自动识别并填入：主题、时间（精确到时分）、城市、详细地址、报名方式等
- 多模态识别（MiniCPM-V）+ 多 Provider 降级，识别结果可手动修改后再提交

### 🤖 AI 智能审核 | AI Content Review
- 用户提交的活动自动经过 AI 审核才显示
- 支持 4 个 AI Provider（按需配置，至少配一个即可）：

| Provider | 模型 | 特点 |
|----------|------|------|
| **MiniCPM** | MiniCPM-V-4.6-Instruct | 免费/低成本，速度快（推荐） |
| **Step（阶跃）** | step-1-8k | 中文理解强 |
| **DeepSeek** | deepseek-chat | 推理能力强 |
| **GLM（智谱）** | glm-4-flash | 响应快，免费额度 |

- 审核流程：提交 → AI 判断是否为「AI线下活动」→ **通过**则显示 / **拒绝**则进后台人工审核
- AI 审核失败时自动**降级**到下一个 Provider
- 支持端侧模型（Ollama 等），只需覆盖 `*_BASE_URL` 环境变量

### 🔐 人工审核后台 | Admin Panel
- 访问 `/admin` 进入审核后台（密码保护）
- 查看 AI 拒绝的 + 待审核的活动
- 一键**通过**或**拒绝**
- 查看审核配置和 Provider 可用状态

### 📊 顶部统计 | Dashboard Stats
- 实时显示：活动总数 / 覆盖城市 / 即将举办

---

## 🛠️ 技术栈 | Tech Stack

| 层 | 技术 |
|----|------|
| 前端 | Next.js 15 (App Router) + React 19 + TypeScript |
| 地图 | ECharts 6 (effectScatter + geo) |
| 数据获取 | SWR |
| 后端 | Next.js API Routes |
| 数据库 | Prisma + SQLite（可迁移 PostgreSQL） |
| AI 审核 | OpenAI 兼容格式统一调用 |
| 部署 | Docker Compose + Nginx |

---

## 🚀 快速开始 | Quick Start

### 本地开发 | Development

```bash
# 克隆项目
git clone https://github.com/rsagacom/huaxia-ai-event-map.git
cd huaxia-ai-event-map

# 安装依赖
npm install

# 初始化数据库 + 种子数据
npx prisma migrate dev
npx prisma db seed

# 配置环境变量
cp .env .env.local
# 编辑 .env.local 填写 API Key 和审核配置

# 启动开发服务器
npm run dev
# 打开 http://localhost:3000
```

### Docker 部署 | Production

```bash
# 构建镜像
docker build -t huaxia-ai-event-map:latest .

# 配置环境变量
cat > .env.production << EOF
DATABASE_URL=file:/data/huaxia.db
MINICPM_API_KEY=your-key-here
AI_REVIEW_PROVIDER=minicpm
AI_REVIEW_ENABLED=true
ADMIN_PASSWORD=your-admin-password
EOF

# 启动
docker compose --env-file .env.production up -d

# 访问 http://your-server:3100
```

---

## ⚙️ 环境变量 | Environment Variables

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | ✅ | `file:./dev.db` | SQLite 数据库路径 |
| `AI_REVIEW_ENABLED` | | `true` | AI 审核开关 |
| `AI_REVIEW_PROVIDER` | | `minicpm` | 默认审核 Provider |
| `AI_REVIEW_TIMEOUT` | | `10000` | 审核超时（毫秒） |
| `DEEPSEEK_API_KEY` | | | DeepSeek API Key |
| `GLM_API_KEY` | | | 智谱 GLM API Key |
| `MINICPM_API_KEY` | | | MiniCPM API Key |
| `STEP_API_KEY` | | | 阶跃 Step API Key |
| `*_BASE_URL` | | | 端侧模型覆盖（如 `MINICPM_BASE_URL=http://localhost:11434/v1`） |
| `ADMIN_PASSWORD` | | | 审核后台密码（不设则无法登录） |
| `SITE_BANNER` | | | 顶部运营公告文案（开源默认空，不显示） |
| `SITE_WECHAT_ID` | | | 公告中渲染为「点击复制」胶囊的微信号 |

---

## 📁 项目结构 | Project Structure

```
├── app/
│   ├── layout.tsx              # 根布局
│   ├── page.tsx                # 首页（客户端渲染）
│   ├── globals.css             # 全局样式（暗色科技风）
│   ├── admin/page.tsx          # 人工审核后台
│   └── api/
│       ├── events/             # GET 活动列表 / POST 提交活动
│       ├── cities/             # GET 城市列表
│       └── admin/              # 审核管理 API
├── components/
│   ├── AppClient.tsx           # 主客户端组件（SWR 状态管理）
│   ├── ChinaMap.tsx            # ECharts 中国地图
│   ├── Timeline.tsx            # 时间轴
│   ├── EventList.tsx           # 活动列表
│   └── RegistrationModal.tsx   # 提交活动弹窗
├── lib/
│   ├── prisma.ts               # Prisma 客户端单例
│   ├── ai-review.ts            # AI 审核（多 Provider 适配器 + 降级）
│   ├── types.ts                # 共享 TypeScript 类型
│   └── helpers.ts              # 筛选工具函数
├── prisma/
│   ├── schema.prisma           # 数据模型
│   └── seed.ts                 # 种子数据（56城市 + 20活动）
├── public/
│   └── china.json              # 中国 GeoJSON
├── Dockerfile                  # 多阶段构建
├── docker-compose.yml          # 编排配置
└── docker-entrypoint.sh        # 启动脚本（自动初始化数据库）
```

---

## 🤝 贡献 | Contributing

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

---

## 📝 更新日志 | Changelog

### 2026-06-20
- **活动时间精确到时分**：表单改用 `datetime-local` 输入，AI 识别具体开始时刻，列表展示「YYYY年M月D日 HH:mm」
- **智能识别填表修复**：海报无年份的日期自动补全年份；模型误拆到 `time` 字段的时间合并回 `date`；禁止 AI 用「未提供」等占位词污染字段
- **「场馆」字段升级为「详细地址」**：支持只公布到区/路级的活动（如「深圳市罗湖区」），更通用
- **UI 优化**：顶部运营公告与微信号胶囊字号整体缩小一号
- 新增 `POST /api/extract-event` 多模态智能识别接口（海报图片 / 文本 → 自动填表）

---

## 📄 许可证 | License

MIT
