// 从公众号文章正文抽取福利/联系方式/费用/主办方，补全飞书导入活动缺失的字段
//
// 分两阶段（正文抓取与 LLM 抽取分离，便于重跑/审核）：
//   阶段1 抓正文：scripts/fetch-articles.ts → /tmp/hx_articles.json  [{title,url,text},...]
//   阶段2 抽取（本脚本）：读 /tmp/hx_articles.json → 调 AI provider → /tmp/hx_benefits_extract.json
//
// 用法：
//   npx tsx scripts/extract-benefits.ts                  # 默认读 /tmp/hx_articles.json
//   npx tsx scripts/extract-benefits.ts <articles.json>  # 指定正文文件
//
// 输出 /tmp/hx_benefits_extract.json：每条含 title + 抽取出的 benefits/contact/requirements/registration，
// 供人工审核；审核通过后用 backfill-benefits.ts 回填 dev.db。
import { getProviders } from '../lib/ai-review';
import fs from 'fs';
import 'dotenv/config'; // 显式加载 .env（tsx 默认不加载）

// 清洗各 API key：去掉所有 CRLF/空格/制表符（STEP key 在 zsh profile 导出时常带换行和内嵌空格，导致 401）
for (const k of ['DEEPSEEK_API_KEY', 'GLM_API_KEY', 'MINICPM_API_KEY', 'STEP_API_KEY']) {
  const v = (process.env[k] || '').replace(/\s+/g, '');
  if (v) process.env[k] = v;
}
// STEP 用 step-1o-turbo-vision（1.8万亿参数多模态大模型，文本理解强）；可被 STEP_MODEL 覆盖
if (process.env.STEP_API_KEY && !process.env.STEP_MODEL) process.env.STEP_MODEL = 'step-1o-turbo-vision';

const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith('--')) || '/tmp/hx_articles.json';
const outputPath = '/tmp/hx_benefits_extract.json';

type Article = { title: string; url: string; text: string; error?: string };

const SYSTEM_PROMPT = `你是活动信息抽取助手。从用户提供的活动公众号文章正文中，抽取以下字段。
只返回一行 JSON，不要 markdown 代码块，不要任何前后缀和解释。

【硬约束】文章中确实写明的字段才填；没写的必须返回空字符串 ""。
严禁返回"未提供""暂无""不详""无""待定""扫码报名""点击阅读原文"这类无信息量的占位词或动作描述——宁缺毋滥，宁可留空。
benefits 只收"实质福利"（奖品/伴手礼/餐饮茶歇/学分/证书/免费票/抽奖/周边赠品/交通补贴/免费住宿等），不要把"分享经验""交流""名额有限""免费参加"当作福利。
若文章正文极短(疑似图片型预告)、或确实没有任何实质福利/联系方式，则对应字段全部返回 ""。

字段：
{
  "benefits": "实质福利点，顿号分隔；无则空字符串",
  "contact": "具体邮箱/电话/微信号(如 service@x.com / 138xxxx / 微信号xxx)；只是写"客服""联系我们"无具体方式则空字符串",
  "requirements": "费用+主办方，格式\"费用:免费；主办:XX\"；正文未提及则空字符串",
  "registration": "正文里出现的具体报名链接(URL)；只是说"扫码报名"无链接则空字符串"
}`;

function parseJSON(content: string): Record<string, string> {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`无法解析: ${content.slice(0, 120)}`);
  let frag = content.slice(start, end + 1);
  try {
    return JSON.parse(frag);
  } catch {
    frag = frag.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(frag);
  }
}

const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();

async function extractWithProvider(
  providerKey: string,
  text: string,
  timeout: number,
): Promise<{ fields: Record<string, string>; provider: string }> {
  const providers = getProviders();
  // 纯文本抽取优先用纯文本模型(STEP/deepseek/glm)，MiniCPM-V 多模态指令遵循弱、易填占位词，放最后
  const preferred = process.env.BENEFITS_PROVIDER || 'step';
  const textFirst = ['step', 'deepseek', 'glm', 'minicpm'];
  const order = textFirst.filter((k) => k in providers);
  let lastErr = '';
  for (const key of order) {
    const p = providers[key];
    if (!p?.apiKey) continue;
    // 429 限流重试：Step RPM≈10，遇 429 等待递增重试，不轻易降级到 minicpm(幻觉)
    for (let attempt = 0; attempt < 4; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(`${p.baseURL}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
          body: JSON.stringify({
            model: key === 'step' ? (process.env.STEP_MODEL || p.model) : p.model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `请从以下活动文章正文中抽取字段：\n\n${text.slice(0, 6000)}` },
            ],
            temperature: 0.1,
            max_tokens: 600,
          }),
          signal: controller.signal,
        });
        if (res.status === 429 && key === 'step') {
          clearTimeout(timer);
          const wait = 8000 * (attempt + 1); // 8s, 16s, 24s, 32s
          console.warn(`  ⏳ step 429 限流，等 ${wait / 1000}s 重试(${attempt + 1}/4)`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 150)}`);
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        const parsed = parseJSON(content);
        return {
          fields: {
            benefits: s(parsed.benefits),
            contact: s(parsed.contact),
            requirements: s(parsed.requirements),
            registration: s(parsed.registration),
          },
          provider: `ai:${key}`,
        };
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
        if (attempt < 3 && key === 'step' && /429|limit|timeout|abort/i.test(lastErr)) {
          clearTimeout(timer);
          continue;
        }
        console.warn(`  ⚠️ provider ${p.name} 失败: ${lastErr.slice(0, 80)}`);
        break; // 换下一个 provider
      } finally {
        clearTimeout(timer);
      }
    }
  }
  throw new Error(`所有 provider 失败: ${lastErr.slice(0, 100)}`);
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`正文文件不存在: ${inputPath}\n请先运行 scripts/fetch-articles.ts 抓取正文`);
    process.exit(1);
  }
  const articles: Article[] = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  // 图片型文章(正文过短,福利在海报图中)和无正文文章跳过，交给 extract-benefits-vision.ts 识图处理
  const IMG_ERR = '图片型';
  const textArticles = articles.filter((a) => a.text && a.text.length >= 80 && !(a.error || '').includes(IMG_ERR));
  const visionArticles = articles.filter((a) => !textArticles.includes(a));
  console.log(`读取 ${articles.length} 篇：文本抽取 ${textArticles.length} 篇 | 识图处理 ${visionArticles.length} 篇(图片型/无正文)`);

  const timeout = parseInt(process.env.AI_REVIEW_TIMEOUT || '20000', 10);
  const results: Array<{
    title: string;
    url: string;
    benefits: string;
    contact: string;
    requirements: string;
    registration: string;
    provider: string;
    note?: string;
  }> = [];

  // 识图类先占位（vision 脚本会单独处理并合并）
  for (const a of visionArticles) {
    results.push({ title: a.title, url: a.url, benefits: '', contact: '', requirements: '', registration: '', provider: 'pending-vision', note: a.error || '无正文/图片型，待识图' });
    console.log(`SKIP 待识图: ${a.title.slice(0, 30)}`);
  }

  for (const a of textArticles) {
    process.stdout.write(`抽取: ${a.title.slice(0, 30)}... `);
    try {
      const { fields, provider } = await extractWithProvider('auto', a.text, timeout);
      results.push({ title: a.title, url: a.url, provider, ...fields });
      const hasAny = fields.benefits || fields.contact || fields.requirements || fields.registration;
      console.log(`✓ [${provider}] ${hasAny ? '有补充' : '无补充(正文可能无福利)'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ title: a.title, url: a.url, benefits: '', contact: '', requirements: '', registration: '', provider: 'failed', note: msg });
      console.log(`✗ ${msg.slice(0, 80)}`);
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  const withBenefits = results.filter((r) => r.benefits).length;
  const withContact = results.filter((r) => r.contact).length;
  console.log(`\n=== 完成：${results.length} 条 → ${outputPath}`);
  console.log(`有福利 ${withBenefits} | 有联系方式 ${withContact}`);
  console.log('请人工审核该 JSON，确认后用 backfill-benefits.ts 回填 dev.db');
}

main().catch((err) => {
  console.error('抽取失败:', err);
  process.exit(1);
});
