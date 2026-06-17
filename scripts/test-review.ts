// 审核 smoke 测试：直接调 reviewEvent，验证端侧对各类技术活动的判断（不写库）
import { readFileSync } from 'node:fs';
import { reviewEvent } from '../lib/ai-review';

// 手动加载 .env（tsx 不自动读 Next 的 .env）
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
} catch (e) {
  console.warn('读取 .env 失败:', e);
}

const base = { date: '2026-08-01', city: '北京', venue: '测试场馆', registration: '官网报名', benefits: '技术分享', requirements: '开发者', contact: '' };

const cases = [
  { title: 'LLM 线下技术研讨会', expect: true },
  { title: 'AIGC 创作工坊', expect: true },
  { title: '大模型推理优化 Meetup', expect: true },
  { title: 'RAG 落地分享会', expect: true },
  { title: '云原生开发者大会', expect: true },
  { title: 'Web3 & 区块链峰会', expect: true },
  { title: 'Python 技术沙龙', expect: true },
  { title: 'DevOps 实践研讨会', expect: true },
  { title: '物联网创新论坛', expect: true },
  { title: '传统建材装饰博览会', expect: false },
  { title: '纯线上带货直播特训营', expect: false },
];

console.log(`当前审核 Provider: ${process.env.AI_REVIEW_PROVIDER || 'minicpm'}（AI_REVIEW_ENABLED=${process.env.AI_REVIEW_ENABLED}）\n`);

let pass = 0;
let fail = 0;
for (const c of cases) {
  const r = await reviewEvent({ ...base, title: c.title });
  const ok = r.approved === c.expect;
  if (ok) pass++; else fail++;
  const tag = r.approved ? '✅通过' : '❌拒绝';
  const mark = ok ? '  预期相符' : '  ⚠️预期不符';
  console.log(`${tag}${mark} | ${c.title.padEnd(22)} | ${r.provider} | ${(r.reason || '').slice(0, 40)}`);
}
console.log(`\n结果：${pass} 符合预期，${fail} 不符（共 ${cases.length}）`);
process.exit(fail > 0 ? 1 : 0);
