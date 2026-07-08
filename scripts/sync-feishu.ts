// 从飞书《兔子洞·周末AI活动盘点》拉取全量活动，增量导入华夏AI活动地图
//
// 数据源：lark-cli base +record-list（官方 API，非 Playwright 抓页面）
// 用法：
//   npx tsx scripts/sync-feishu.ts --dry          # 预览，不写库
//   npx tsx scripts/sync-feishu.ts                 # 真实写库
//   npx tsx scripts/sync-feishu.ts --sql-only      # 仅输出增量 SQL，不写库（用于生产导入）
//
// 前置条件：lark-cli 已配置且有 base:record:read 权限
// 生产导入：scp 增量 SQL 到 EC2，docker exec sqlite3 执行
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const SQL_ONLY = args.includes('--sql-only');

// 飞书配置（从 wiki JszMwRcz6isiOek6mDrcoPH2nmc 解析）
const BASE_TOKEN = 'Bqe3byRYoaCHX0sE2M9cDvHBnbf';
const TABLE_ID = 'tbl2WNtVYgiH90Sk';

// 飞书字段 → 输出列顺序（与 --field-id 顺序一致）
const FIELD_IDS = [
  'fldKL4B5rF', // 0: 活动名称 → title
  'fldBZU3yGo', // 1: 开始日期📅 → date (datetime)
  'fldENIXlYK', // 2: 日期 → date_fallback (text)
  'fldXLrQVjy', // 3: 城市 → city (multi-select)
  'fldIsIlJE1', // 4: 地点/场地 → venue
  'fldc2SNO7N', // 5: 详情&报名入口 → registration (url)
  'fldmvaBp02', // 6: 是否免费 → free
  'fldyvltsOo', // 7: 主办方 → org
  'fldpCOC3G7', // 8: 时长 → dur
  'fldLeu04L1', // 9: 活动简介 → desc
  'fldwQXOy2k', // 10: 活动信息 → info
  'fldZgRpoFb', // 11: 具体时间 → time (datetime)
  'fldSMDLf2P', // 12: 进程 → status
  'fld9cZoGKE', // 13: 备注 → notes
  'fldMqyKGx7', // 14: 是否需要报名 → need_registration
];

// 城市映射：飞书城市(带emoji/特殊) → 标准名。null 表示跳过(海外等)
const CITY_MAP: Record<string, string | null> = {
  '全国': '北京',
  '线上': '线上',
  '线上,香港': '香港',
  '线上；香港': '香港',
  '新加坡': null,
  '🌍 海外全球': null,
  'Santa Clara': null,
  '丹佛（美国）': null,
  '波士顿（美国）': null,
  '西雅图（美国）': null,
  '芝加哥（美国）': null,
  '伦敦（英国）': null,
};

// 多城市优先级：上海 > 北京 > 广州 > 深圳
const CITY_PRIORITY = ['上海', '北京', '广州', '深圳'];

function _pickCity(s: string): string | null {
  // 尝试从多城市字符串中按优先级匹配
  for (const city of CITY_PRIORITY) {
    if (s.includes(city)) return city;
  }
  return null;
}

function normCity(raw: string | string[] | null): string | null {
  if (!raw) return null;
  const s = (Array.isArray(raw) ? raw.join('；') : raw)
    .replace(/[🔴🟡🟢🔵🟣⚪️🇸🇬🇭🇰🌍]/gu, '')
    .trim();
  if (s in CITY_MAP) return CITY_MAP[s];
  // 多城市时按优先级选择
  if (s.includes('；') || s.includes(';')) {
    const picked = _pickCity(s);
    if (picked) return picked;
  }
  return s || null;
}

// 去掉 URL 的 markdown 包装和空格
function cleanUrl(raw: string | null): string {
  if (!raw) return '';
  // 处理 [text](url) 或纯 url
  const m = raw.match(/\]\(([^)]+)\)/);
  if (m) return m[1].trim();
  return raw.trim();
}

// 解析日期：优先用 datetime 字段，回退到 text 字段
function parseDate(datetimeVal: string | null, textVal: string | null): string {
  if (datetimeVal && datetimeVal.length >= 10) {
    return datetimeVal.slice(0, 10); // "2026-03-13 00:00:00" → "2026-03-13"
  }
  if (textVal) {
    // 尝试提取 YYYY年M月D日 格式
    const m = textVal.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (m) {
      return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    }
  }
  return '日期待定';
}

// 提取 link 文本（去掉 markdown URL 包装）
function extractLinkText(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^\[([^\]]+)\]/);
  return m ? m[1] : raw;
}

type FeishuRow = (string | string[] | null)[];

interface FeishuEvent {
  rid: string;
  title: string;
  date: string;
  time: string | null;
  city: string | null;
  venue: string | null;
  desc: string | null;
  info: string | null;
  link: string | null;
  free: string | null;
  org: string | null;
  dur: string | null;
}

async function fetchAllFromFeishu(): Promise<{ records: FeishuRow[]; recordIds: string[] }> {
  const allRows: FeishuRow[] = [];
  const allIds: string[] = [];
  let offset = 0;
  const limit = 200;
  let page = 0;

  while (true) {
    page++;
    const fieldArgs = FIELD_IDS.map((id) => `--field-id ${id}`).join(' ');
    const cmd = `lark-cli base +record-list --base-token ${BASE_TOKEN} --table-id ${TABLE_ID} --format json ${fieldArgs} --limit ${limit} --offset ${offset}`;

    console.error(`[fetch] 第 ${page} 页 (offset=${offset})...`);
    const raw = execSync(cmd, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB
      timeout: 30000,
    });

    const resp = JSON.parse(raw);
    if (!resp.ok) {
      throw new Error(`lark-cli 错误: ${JSON.stringify(resp.error)}`);
    }

    const { data, has_more, records: recObjs } = resp.data;
    // --format json 返回 { data: [[...], ...], has_more, records: [{record_id},...] }
    if (data && Array.isArray(data)) {
      allRows.push(...data);
      if (recObjs && Array.isArray(recObjs)) {
        for (const r of recObjs) {
          allIds.push(r.record_id);
        }
      }
      console.error(`[fetch] 获取 ${data.length} 条，累计 ${allRows.length} 条`);
    }

    if (!has_more) break;
    offset += limit;
  }

  console.error(`[fetch] 完成：共 ${allRows.length} 条记录`);
  return { records: allRows, recordIds: allIds };
}

function transformRow(row: FeishuRow, recordId: string): FeishuEvent | null {
  const title = (row[0] as string) || '';
  if (!title) return null;

  const dateVal = (row[1] as string) || null;
  const dateText = (row[2] as string) || null;
  const date = parseDate(dateVal, dateText);

  const city = normCity(row[3] as string | string[] | null);
  if (!city) return null; // 跳过海外

  const venue = (row[4] as string) || null;
  const linkRaw = (row[5] as string) || null;
  const link = linkRaw ? cleanUrl(linkRaw) : null;
  const free = Array.isArray(row[6]) ? (row[6] as string[])[0] || null : (row[6] as string) || null;
  const org = (row[7] as string) || null;
  const dur = (row[8] as string) || null;
  const desc = (row[9] as string) || null;
  const info = (row[10] as string) || null;
  const timeVal = (row[11] as string) || null;
  const time = timeVal && timeVal.length >= 16 ? timeVal.slice(11, 16) : null;

  return {
    rid: recordId,
    title,
    date,
    time,
    city,
    venue,
    desc,
    info,
    link,
    free,
    org,
    dur,
  };
}

async function main() {
  console.error('=== 飞书活动增量同步 ===');
  console.error(`模式: ${DRY ? 'DRY-RUN' : SQL_ONLY ? 'SQL-ONLY' : 'WRITE'}`);
  console.error('');

  // 1. 拉取飞书全量
  const { records: rows, recordIds: ids } = await fetchAllFromFeishu();

  // 2. 转换
  const events: FeishuEvent[] = [];
  for (let i = 0; i < rows.length; i++) {
    const evt = transformRow(rows[i], ids[i] || `row-${i}`);
    if (evt) events.push(evt);
  }
  console.error(`[transform] 有效活动 ${events.length} 条（已跳过海外/空标题）`);

  // 3. 去重：按 title 检查本地已有
  console.error('[dedup] 检查本地已有...');
  const existing = new Set(
    (await prisma.event.findMany({ select: { title: true } })).map((e) => e.title)
  );
  const newEvents = events.filter((e) => !existing.has(e.title));
  console.error(`[dedup] 本地已有 ${existing.size} 条，增量 ${newEvents.length} 条`);

  if (newEvents.length === 0) {
    console.error('\n✅ 没有新增活动，无需同步');
    return;
  }

  // 4. 输出增量
  const sqlStatements: string[] = [];
  let skippedCities = 0;
  for (const e of newEvents) {
    const venue = (e.venue && e.venue.trim()) || e.city || '待定';
    const reqParts = [
      e.free && e.free !== '未知' ? `费用:${e.free}` : '',
      e.org ? `主办:${e.org}` : '',
    ]
      .filter(Boolean)
      .join('；');
    const id = `evt-fs-${e.rid}`;
    const now = new Date();

    const data = {
      id,
      title: e.title,
      date: e.date,
      city: e.city,
      venue,
      registration: e.link || '待定',
      benefits: '待定',
      requirements: reqParts || '无特殊要求',
      contact: '',
      status: 'approved',
      reviewReason: '飞书《兔子洞·周末AI活动盘点》自动同步',
      reviewedBy: 'feishu-sync',
      reviewedAt: now,
    };

    // 检查城市是否存在（跳过不存在城市的事件）
    const cityExists = await prisma.city.findUnique({ where: { name: e.city! } });
    if (!cityExists) {
      console.error(`SKIP城市不存在: [${e.city}] ${e.title}`);
      skippedCities++;
      continue;
    }

    if (DRY) {
      console.log(`DRY [${e.city}] ${e.date} ${e.title}`);
    } else if (SQL_ONLY) {
      // 生成 SQLite INSERT（单引号转义）
      const esc = (s: any) => s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
      const sql = `INSERT OR IGNORE INTO Event (id, title, date, city, venue, registration, benefits, requirements, contact, status, reviewReason, reviewedBy, reviewedAt, createdAt) VALUES (${esc(data.id)}, ${esc(data.title)}, ${esc(data.date)}, ${esc(data.city)}, ${esc(data.venue)}, ${esc(data.registration)}, ${esc(data.benefits)}, ${esc(data.requirements)}, ${esc(data.contact)}, ${esc(data.status)}, ${esc(data.reviewReason)}, ${esc(data.reviewedBy)}, ${esc(data.reviewedAt)}, ${esc(data.createdAt)});`;
      sqlStatements.push(sql);
    } else {
      await prisma.event.upsert({
        where: { id: data.id },
        create: data,
        update: data, // 同一条飞书记录再次同步时，用最新数据覆盖
      });
    }
  }

  if (SQL_ONLY) {
    const sqlPath = '/tmp/huaxia-feishu-incremental.sql';
    fs.writeFileSync(sqlPath, sqlStatements.join('\n'));
    console.error(`\n=== 增量 SQL → ${sqlPath} (${sqlStatements.length} 条) ===`);
    // 也输出到 stdout 方便管道
    console.log(sqlStatements.join('\n'));
  } else if (!DRY) {
    console.error(`\n=== 入库 ${newEvents.length} 条 ===`);
  }

  if (skippedCities > 0) console.error(`[skip] 跳过不存在城市 ${skippedCities} 条`);
  if (DRY) console.error('\n(dry-run 未写库)');

  // 5. 输出生产导入提示
  if (!DRY && !SQL_ONLY && newEvents.length > 0) {
    console.error('');
    console.error('💡 生产同步: bash scripts/sync-and-deploy.sh');
  }
}

main()
  .catch((err) => {
    console.error('同步失败:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());