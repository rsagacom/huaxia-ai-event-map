// 诊断 minicpm 端点：看 key/endpoint/model 是否能调通
import { readFileSync } from 'node:fs';
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
} catch (e) { console.warn('读 .env 失败', e); }

const base = process.env.MINICPM_BASE_URL || 'https://api.modelbest.cn/v1';
const key = process.env.MINICPM_API_KEY || '';
console.log('MINICPM_BASE_URL :', base);
console.log('MINICPM_API_KEY  :', key ? `${key.slice(0, 6)}…(共${key.length}字符)` : '❌ 未设置');
console.log('model            : MiniCPM-V-4.6-Instruct\n');

try {
  const t0 = Date.now();
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'MiniCPM-V-4.6-Instruct',
      messages: [{ role: 'user', content: '只回复两个字：你好' }],
      max_tokens: 20,
    }),
  });
  const ms = Date.now() - t0;
  console.log(`HTTP ${res.status}  (${ms}ms)`);
  const text = await res.text();
  console.log('body:', text.slice(0, 600));
} catch (e) {
  console.log('❌ fetch 异常:', e instanceof Error ? e.message : e);
  console.log('   → 可能是 DNS/网络/endpoint 问题，或端点不可达');
}
