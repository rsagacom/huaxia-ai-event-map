// 对图片型/无正文公众号文章：CDP 滚屏拼接全页长图 → step-1o-turbo-vision 识图抽取福利
//
// 输入：/tmp/hx_articles.json 中 provider='pending-vision' 或正文过短/无的条目
//       （extract-benefits.ts 已把这类标记为 pending-vision 写入 /tmp/hx_benefits_extract.json）
// 输出：合并回 /tmp/hx_benefits_extract.json（更新 pending-vision 条目的字段）
//
// 用法：npx tsx scripts/extract-benefits-vision.ts
// 前置：CDP proxy 已启动；shell 有 STEP_API_KEY
import fs from 'fs';

const PROXY = 'http://127.0.0.1:3456';
const EXTRACT_JSON = '/tmp/hx_benefits_extract.json';
const SHOT_DIR = '/tmp/hx_shots';

const SYSTEM_PROMPT = `你是活动信息抽取助手。从用户提供的活动公众号文章长截图中，抽取以下字段。
只返回一行 JSON，不要 markdown 代码块，不要任何前后缀和解释。

【硬约束】图中确实写明的字段才填；没写的必须返回空字符串 ""。
严禁返回"未提供""暂无""不详""待定"等占位词——宁缺毋滥，宁可留空。
benefits 只收实质福利（奖品/伴手礼/餐饮茶歇/学分/证书/免费票/抽奖/周边赠品/交通补贴/免费住宿等）。
不要把"名额有限""免费参加""分享交流"当作福利。

字段：
{
  "benefits": "实质福利点，顿号分隔；无则空字符串",
  "contact": "具体邮箱/电话/微信号；只是写'客服'无具体方式则空字符串",
  "requirements": "费用+主办方，格式'费用:免费；主办:XX'；图中未提及则空字符串",
  "registration": "图中出现的具体报名链接(URL)；只是'扫码报名'无链接则空字符串"
}`;

async function cdp(path: string, init?: RequestInit, timeoutMs = 30000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${PROXY}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function newTab(url: string): Promise<string> {
  const r = await cdp(`/new?url=${encodeURIComponent(url)}`, undefined, 60000);
  return r.targetId;
}

// 用 file 方式分段截图，返回临时文件路径列表
async function captureSegments(targetId: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  await cdp(`/scroll?target=${targetId}&direction=bottom`, undefined, 10000);
  await new Promise((r) => setTimeout(r, 1500));
  await cdp(`/eval?target=${targetId}`, { method: 'POST', body: 'window.scrollTo(0,0)' }, 5000);
  await new Promise((r) => setTimeout(r, 800));

  const dim = await cdp(`/eval?target=${targetId}`, {
    method: 'POST',
    body: 'JSON.stringify({sh: document.documentElement.scrollHeight, vh: window.innerHeight})',
  }, 5000);
  const { sh, vh } = JSON.parse(dim.value || '{"sh":0,"vh":800}');
  const step = Math.max(vh - 40, 600); // 重叠 40px 防截断
  let y = 0; let i = 0;
  while (y < sh && i < 8) { // 最多 8 段防超长
    await cdp(`/eval?target=${targetId}`, { method: 'POST', body: `window.scrollTo(0,${y})` }, 5000);
    await new Promise((r) => setTimeout(r, 600));
    const f = `${prefix}_seg${i}.jpeg`;
    await cdp(`/screenshot?target=${targetId}&format=jpeg&file=${encodeURIComponent(f)}`, undefined, 15000);
    if (fs.existsSync(f) && fs.statSync(f).size > 0) files.push(f);
    y += step; i++;
  }
  return files;
}

const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();

function parseJSON(content: string): Record<string, string> {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error(`无法解析: ${content.slice(0, 120)}`);
  let frag = content.slice(start, end + 1);
  try { return JSON.parse(frag); } catch {
    frag = frag.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(frag);
  }
}

async function visionExtract(imagePaths: string[]): Promise<Record<string, string>> {
  const apiKey = (process.env.STEP_API_KEY || '').replace(/\s+/g, '');
  if (!apiKey) throw new Error('STEP_API_KEY 未配置');
  const content: any[] = [];
  content.push({ type: 'text', text: `请从以下活动文章截图中抽取字段。\n\n${SYSTEM_PROMPT}` });
  for (const p of imagePaths) {
    const b64 = fs.readFileSync(p).toString('base64');
    content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } });
  }
  const res = await fetch('https://api.stepfun.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.STEP_MODEL || 'step-1o-turbo-vision',
      messages: [{ role: 'user', content }],
      temperature: 0.1,
      max_tokens: 600,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text().catch(() => '')).slice(0, 150)}`);
  const data = await res.json();
  const txt = data.choices?.[0]?.message?.content || '';
  const parsed = parseJSON(txt);
  return {
    benefits: s(parsed.benefits), contact: s(parsed.contact),
    requirements: s(parsed.requirements), registration: s(parsed.registration),
  };
}

async function main() {
  if (!fs.existsSync(EXTRACT_JSON)) {
    console.error(`缺少 ${EXTRACT_JSON}，请先运行 extract-benefits.ts`);
    process.exit(1);
  }
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const results: any[] = JSON.parse(fs.readFileSync(EXTRACT_JSON, 'utf8'));
  const pending = results.filter((r) => r.provider === 'pending-vision');
  console.log(`待识图 ${pending.length} 篇`);

  for (const r of pending) {
    process.stdout.write(`识图: ${r.title.slice(0, 28)}... `);
    let targetId = '';
    try {
      targetId = await newTab(r.url);
      await new Promise((res) => setTimeout(res, 2500));
      const prefix = `${SHOT_DIR}/${r.title.replace(/[^\w一-龥]/g, '').slice(0, 20)}`;
      const segs = await captureSegments(targetId, prefix);
      if (segs.length === 0) throw new Error('截图失败');
      const fields = await visionExtract(segs);
      Object.assign(r, fields, { provider: 'vision:step', note: `${segs.length}段截图识图` });
      console.log(`✓ ${segs.length}段 | ${fields.benefits || fields.requirements ? '有补充' : '无补充'}`);
      // 清理临时截图
      segs.forEach((f) => { try { fs.unlinkSync(f); } catch { /* */ } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      r.note = `识图失败: ${msg.slice(0, 80)}`;
      r.provider = 'vision-failed';
      console.log(`✗ ${msg.slice(0, 60)}`);
    } finally {
      if (targetId) { try { await cdp(`/close?target=${targetId}`, undefined, 5000); } catch { /* */ } }
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  fs.writeFileSync(EXTRACT_JSON, JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.provider.startsWith('vision:')).length;
  console.log(`\n=== 识图完成：成功 ${ok}/${pending.length}，已合并回 ${EXTRACT_JSON} ===`);
}

main().catch((err) => { console.error('识图失败:', err); process.exit(1); });
