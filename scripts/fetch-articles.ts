// 批量抓取飞书导入活动的公众号文章正文（CDP proxy，绕微信反爬）
//
// 输入：/tmp/hx_feishu_events.json（dev.db 导出的飞书活动，含 registration 公众号链接）
// 输出：/tmp/hx_articles.json  [{title,url,text,error?},...]
//
// 用法：npx tsx scripts/fetch-articles.ts [events.json]
//
// 前置：web-access CDP proxy 已启动（node ~/.claude/skills/web-access/scripts/check-deps.mjs）
// 注意：localhost 请求必须绕过代理(NO_PROXY=localhost)，否则 ALL_PROXY 会 502。
//       本脚本内 fetch 已设 {proxy:false} 直连 127.0.0.1。
import fs from 'fs';

const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith('--')) || '/tmp/hx_feishu_events.json';
const outputPath = '/tmp/hx_articles.json';
const PROXY = 'http://127.0.0.1:3456';

type FeishuEvent = { id: string; title: string; registration: string };
type Article = { title: string; url: string; text: string; error?: string };

// 直连 CDP proxy，不走 ALL_PROXY
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
  const r = await cdp(`/new?url=${encodeURIComponent(url)}`, { method: 'GET' }, 60000);
  return r.targetId;
}

async function extractText(targetId: string): Promise<{ text: string; imgHeavy: boolean }> {
  // 微信正文容器多样：#js_content / .rich_media_content / #page-content。
  // 取这些候选里 innerText 最长的一个；若都很短(图片型文章)，标记 imgHeavy 提示需识图。
  const js = `(() => {
    const sels = ["#js_content",".rich_media_content","#page-content",".rich_media_area_primary"];
    let best = "", bestLen = 0;
    for (const s of sels) {
      const el = document.querySelector(s);
      const t = el ? (el.innerText || "").trim() : "";
      if (t.length > bestLen) { bestLen = t.length; best = t; }
    }
    const imgs = document.querySelectorAll("#js_content img, .rich_media_content img, #page-content img");
    return JSON.stringify({ text: best, imgCount: imgs.length });
  })()`;
  const r = await cdp(`/eval?target=${targetId}`, { method: 'POST', body: js }, 15000);
  const v = r && r.value ? JSON.parse(r.value) : { text: '', imgCount: 0 };
  return { text: v.text || '', imgHeavy: v.text.length < 80 && v.imgCount > 0 };
}

async function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`输入文件不存在: ${inputPath}`);
    process.exit(1);
  }
  const events: FeishuEvent[] = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  // 只抓有公众号链接的
  const targets = events.filter((e) => (e.registration || '').startsWith('http'));
  console.log(`共 ${events.length} 条，有公众号链接 ${targets.length} 条（其余跳过）`);

  // 增量：若已有输出，跳过已成功抓取的
  let existing: Record<string, Article> = {};
  if (fs.existsSync(outputPath)) {
    try {
      const prev: Article[] = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      prev.forEach((a) => { if (a.text) existing[a.title] = a; });
      console.log(`增量模式：已抓取 ${Object.keys(existing).length} 篇，将跳过`);
    } catch { /* 忽略损坏文件 */ }
  }

  const results: Article[] = [];
  let done = 0;
  for (const e of targets) {
    if (existing[e.title]) {
      results.push(existing[e.title]);
      continue;
    }
    process.stdout.write(`[${++done}/${targets.length}] ${e.title.slice(0, 28)}... `);
    let targetId = '';
    try {
      targetId = await newTab(e.registration);
      await new Promise((r) => setTimeout(r, 2500)); // 等渲染
      let { text, imgHeavy } = await extractText(targetId);
      if (!text || text.length < 30) {
        // 可能页面还在加载，再等一次
        await new Promise((r) => setTimeout(r, 2000));
        const r2 = await extractText(targetId);
        text = r2.text || text;
        imgHeavy = r2.imgHeavy;
      }
      if (!text) throw new Error('正文为空');
      if (imgHeavy) {
        results.push({ title: e.title, url: e.registration, text, error: '图片型文章，正文过短，福利可能在图片中，建议识图' });
        console.log(`⚠ ${text.length}字 (图片型,建议识图)`);
      } else {
        results.push({ title: e.title, url: e.registration, text });
        console.log(`✓ ${text.length}字`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ title: e.title, url: e.registration, text: '', error: msg });
      console.log(`✗ ${msg.slice(0, 60)}`);
    } finally {
      if (targetId) {
        try { await cdp(`/close?target=${targetId}`, { method: 'GET' }, 5000); } catch { /* 忽略 */ }
      }
      // 节流，避免微信风控
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  const ok = results.filter((r) => r.text).length;
  console.log(`\n=== 完成：成功 ${ok}/${targets.length} → ${outputPath}`);
  console.log(`失败 ${results.length - ok} 条（见各条 error 字段，可重跑增量补抓）`);
}

main().catch((err) => {
  console.error('抓取失败:', err);
  process.exit(1);
});
