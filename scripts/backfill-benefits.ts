// 将审核后的福利/联系方式/费用主办方回填到 dev.db
//
// 输入：/tmp/hx_benefits_extract.json（extract-benefits.ts 产出，人工审核后的版本）
// 按 title 匹配 Event，只回填非空字段（空值不覆盖库中已有内容）。
//
// 用法：
//   npx tsx scripts/backfill-benefits.ts --dry     # 预览将更新哪些行/字段
//   npx tsx scripts/backfill-benefits.ts           # 真实写库
//   npx tsx scripts/backfill-benefits.ts <json>    # 指定审核文件
//
// 默认只回填 benefits；--include-contact 同时回填 contact/requirements/registration。
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith('--')) || '/tmp/hx_benefits_extract.json';
const DRY = args.includes('--dry');
const INCLUDE_ALL = args.includes('--include-contact');

type Extract = {
  title: string;
  benefits: string;
  contact: string;
  requirements: string;
  registration: string;
};

async function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`审核文件不存在: ${inputPath}`);
    process.exit(1);
  }
  const rows: Extract[] = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  console.log(`读取 ${rows.length} 条审核结果 | DRY=${DRY} | INCLUDE_ALL=${INCLUDE_ALL}`);

  let updated = 0, skipped = 0, notFound = 0;
  for (const r of rows) {
    const ev = await prisma.event.findFirst({ where: { title: r.title } });
    if (!ev) {
      notFound++;
      console.log(`NOT FOUND: ${r.title}`);
      continue;
    }
    // 只收集非空字段
    const patch: Record<string, string> = {};
    if (r.benefits && r.benefits !== '待定') patch.benefits = r.benefits;
    if (INCLUDE_ALL) {
      if (r.contact && r.contact !== '待定') patch.contact = r.contact;
      // requirements 仅在库中为默认占位值时才覆盖，避免冲掉已有的好数据
      if (r.requirements && (ev.requirements === '无特殊要求' || !ev.requirements)) {
        patch.requirements = r.requirements;
      }
      // registration 仅在库中为"待定"时才补
      if (r.registration && ev.registration === '待定') {
        patch.registration = r.registration;
      }
    }
    if (Object.keys(patch).length === 0) {
      skipped++;
      continue;
    }
    if (DRY) {
      console.log(`[DRY] ${r.title.slice(0, 28)} ← ${JSON.stringify(patch)}`);
    } else {
      await prisma.event.update({ where: { id: ev.id }, data: patch });
      console.log(`UPDATE ${r.title.slice(0, 28)} ← ${Object.keys(patch).join(',')}`);
    }
    updated++;
  }
  console.log(`\n=== 结果：更新 ${updated} | 无可补跳过 ${skipped} | 未匹配 ${notFound} ===`);
  if (DRY) console.log('(dry-run 未写库，去掉 --dry 真实写入)');
}

main()
  .catch((err) => { console.error('回填失败:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
