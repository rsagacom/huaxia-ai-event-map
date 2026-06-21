// 从飞书《兔子洞·周末AI活动盘点》抓取结果批量导入华夏AI活动地图
//
// 数据源：Playwright 抓取飞书 bitable 后解码出的 /tmp/feishu-future-events.json
// 用法：
//   npx tsx scripts/import-feishu.ts <json路径> --dry     # 预览，不写库
//   npx tsx scripts/import-feishu.ts <json路径>           # 真实写库（status=approved）
//
// 字段映射（飞书 → Event）：
//   活动名称→title  开始日期→date  城市→city(去emoji+归并)  地点/场地→venue
//   详情&报名入口(公众号链接)→registration  是否免费/主办方→requirements  其余→默认
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const jsonPath = args.find((a) => !a.startsWith('--')) || '/tmp/feishu-future-events.json';
const DRY = args.includes('--dry');

// 飞书城市(带emoji/特殊) → City 表标准名。value 为 null 表示跳过(海外等不收)
const CITY_MAP: Record<string, string | null> = {
  全国: '北京', // 多城巡回 → 取首都
  线上: '线上',
  '线上,香港': '香港',
  新加坡: null, // 海外，跳过
};

function normCity(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.replace(/[🔴🟡🟢🔵🟣⚪️🇸🇬🇭🇰]/gu, '').trim();
  return s in CITY_MAP ? CITY_MAP[s] : s || null;
}

// 需要新增到 City 表的城市（中国地区真实城市/虚拟点）
const NEW_CITIES = [
  { name: '香港', longitude: 114.169, latitude: 22.319, level: 'tier1' },
  { name: '线上', longitude: 104.0, latitude: 35.0, level: 'online' },
];

type FeishuEvent = {
  rid: string;
  title: string;
  date: string;
  time?: string | null;
  city: string | null;
  venue?: string | null;
  desc?: string | null;
  info?: string | null;
  link?: string | null;
  free?: string | null;
  org?: string | null;
  dur?: string | null;
};

async function main() {
  const events: FeishuEvent[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`读取 ${events.length} 条飞书活动 | DRY=${DRY}`);

  if (!DRY) {
    for (const c of NEW_CITIES) {
      await prisma.city.upsert({
        where: { name: c.name },
        update: {},
        create: c,
      });
    }
    console.log(`确保城市存在: ${NEW_CITIES.map((c) => c.name).join(', ')}`);
  }

  let inserted = 0,
    skipped = 0,
    dup = 0;
  for (const e of events) {
    const city = normCity(e.city);
    if (!city) {
      skipped++;
      console.log(`SKIP海外/无效: [${e.city}] ${e.title}`);
      continue;
    }
    // 去重：按 title（已存在则跳过）
    const exists = await prisma.event.findFirst({ where: { title: e.title } });
    if (exists) {
      dup++;
      console.log(`DUP已存在: ${e.title}`);
      continue;
    }
    const venue = (e.venue && e.venue.trim()) || city;
    // requirements 把 是否免费+主办方 拼进去（schema 无独立列，借位存放有用信息）
    const reqParts = [e.free && e.free !== '未知' ? `费用:${e.free}` : '', e.org ? `主办:${e.org}` : '']
      .filter(Boolean)
      .join('；');
    const data = {
      id: `evt-fs-${e.rid}`,
      title: e.title,
      date: e.date,
      city,
      venue,
      registration: e.link || '待定',
      benefits: '待定',
      requirements: reqParts || '无特殊要求',
      contact: '',
      status: 'approved',
      reviewReason: '飞书《兔子洞·周末AI活动盘点》导入',
      reviewedBy: 'feishu-import',
      reviewedAt: new Date(),
    };
    if (DRY) {
      console.log(`DRY [${city}] ${e.date} ${e.title}`);
    } else {
      await prisma.event.create({ data });
    }
    inserted++;
  }
  console.log(`\n=== 结果：入库 ${inserted} | 去重跳过 ${dup} | 海外/无效跳过 ${skipped} ===`);
  if (DRY) console.log('(dry-run 未写库)');
}

main()
  .catch((err) => {
    console.error('导入失败:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
