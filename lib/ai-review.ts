// 华夏AI线下活动地图 — AI 审核：多 Provider adapter + 降级 + 端侧兼容

import type { EventFormData } from './types';

export interface ReviewResult {
  approved: boolean;
  reason: string;
  provider: string;
}

export interface ExtractResult {
  fields: EventFormData;
  provider: string;
}

interface AIProvider {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
  multimodal: boolean;
}

// 多 Provider 配置 — 全部兼容 OpenAI Chat Completions 格式
export function getProviders(): Record<string, AIProvider> {
  return {
    deepseek: {
      name: 'DeepSeek',
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: 'deepseek-chat',
      multimodal: false,
    },
    glm: {
      name: 'GLM (智谱)',
      baseURL: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: process.env.GLM_API_KEY || '',
      model: 'glm-4-flash',
      multimodal: false,
    },
    minicpm: {
      name: 'MiniCPM',
      baseURL: process.env.MINICPM_BASE_URL || 'https://api.modelbest.cn/v1',
      apiKey: process.env.MINICPM_API_KEY || '',
      model: 'MiniCPM-V-4.6-Instruct',
      multimodal: true,
    },
    step: {
      name: 'Step (阶跃)',
      baseURL: process.env.STEP_BASE_URL || 'https://api.stepfun.com/v1',
      apiKey: process.env.STEP_API_KEY || '',
      model: 'step-1-8k',
      multimodal: false,
    },
  };
}

// 审核用的系统 Prompt
const REVIEW_SYSTEM_PROMPT = `你是一个内容审核员，负责审核用户提交的"线下活动"信息是否适合收录到一个面向技术开发者的活动地图。

## 核心原则（最重要）
**从宽放行**：只要活动涉及 AI 或互联网/软件/IT 技术，就通过。宁可放行让后台人工复核，也绝不误拒正经的技术活动。判断时综合"标题 + 内容介绍"整体看，不要只盯标题有没有写"AI"二字。

## 必须通过的活动领域（出现以下任一方向即通过）

### AI 相关
- 大模型 / LLM / 基础模型 / GPT / 预训练 / 微调 / 推理优化 / 蒸馏
- AIGC：文生文、文生图、文生音/视频、数字人、AI 创作
- 机器学习、深度学习、神经网络、Transformer
- 计算机视觉(CV)、自然语言处理(NLP)、语音、多模态
- 知识图谱、RAG、Agent / 智能体、提示词工程、工作流编排
- 强化学习、具身智能、机器人、自动驾驶
- AI 芯片、算力、AI Infra、AI for Science、AI 应用落地

### 互联网 / 软件开发 / IT 技术
- 云计算、云原生、容器、Kubernetes、Serverless
- 大数据、数据治理、数据库、数据工程
- 区块链、Web3、元宇宙、数字藏品
- 物联网(IoT)、边缘计算、5G、智能硬件
- SaaS、DevOps、微服务、可观测性、架构设计
- 前端、后端、全栈、移动开发、小程序
- 开源技术、编程语言(Python/Go/Rust/Java/JavaScript/C++/C#/TypeScript 等)、开发者工具
- 网络安全、信息安全、合规
- 量子计算、芯片、半导体、嵌入式、操作系统

以上技术的研究、开源、产品、应用，以及相关的大会、峰会、论坛、沙龙、Meetup、研讨会、座谈会、读书会、黑客松、工坊、招聘会、培训等，均通过。

## 判断依据（重要）
- 标题或正文出现上述任一技术名词（含英文缩写，如 LLM、AIGC、GPT、RAG、CV、NLP、IoT、SaaS、Web3、DevOps、K8s 等）→ 通过
- 即使标题只写"LLM 线下研讨会""开发者 Meetup""云原生峰会""Web3 大会"，完全没有"AI"字样，也**必须通过**
- 仅因标题字面不出现"AI"就拒绝 → 这是错误判断

## 仅以下情况拒绝
1. 与 AI / 互联网 / 软件技术完全无关（如纯传统行业：建材、服装、餐饮、家装、农资、美业、招商加盟等，且无任何技术成分）
2. 明显的广告、刷单、推销、引流、违法违规、色情赌博
3. 纯线上带货直播（线下技术活动中的线上直播/转播环节不算）

## 示例
通过（approved=true）：
- "LLM 线下技术研讨会" / "大模型推理优化 Meetup" / "AIGC 创作工坊" / "RAG 落地分享会" / "机器学习实战训练营" / "具身智能机器人论坛" / "云原生开发者大会" / "Web3 & 区块链峰会" / "Python 技术沙龙" / "前端架构演进 Meetup" / "DevOps 实践研讨会" / "物联网创新论坛" / "数据库技术大会"
拒绝（approved=false）：
- "传统建材博览会" / "纯线上带货直播" / "刷单广告" / "美业招商加盟会"

## 输出（严格遵守）
只返回下面这一行 JSON，不要任何前后缀，不要 markdown 代码块，不要解释：
{"approved": true, "reason": "一句话理由"}`;

const REVIEW_USER_PROMPT = (event: {
  title: string;
  date: string;
  city: string;
  venue: string;
  registration?: string;
  benefits?: string;
  requirements?: string;
  contact?: string;
}) => `请审核以下活动提交：

活动主题：${event.title}
时间：${event.date}
城市：${event.city}
场馆：${event.venue}
报名方式：${event.registration || '未提供'}
活动福利：${event.benefits || '未提供'}
参加要求：${event.requirements || '未提供'}
联系方式：${event.contact || '未提供'}

请综合以上内容判断这是否是一个合规的"AI线下活动"，只返回 JSON。`;

// 调用单个 Provider 进行审核
async function reviewWithProvider(
  provider: AIProvider,
  providerKey: string,
  event: Parameters<typeof REVIEW_USER_PROMPT>[0],
  timeout: number,
): Promise<ReviewResult> {
  if (!provider.apiKey) {
    throw new Error(`Provider ${provider.name} 未配置 API Key`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${provider.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: REVIEW_SYSTEM_PROMPT },
          { role: 'user', content: REVIEW_USER_PROMPT(event) },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 解析 JSON 返回（容错：取第一个 { 到最后一个 }，端侧模型输出常带前后缀/换行）
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    let parsed: { approved?: unknown; reason?: unknown };
    if (start !== -1 && end > start) {
      let frag = content.slice(start, end + 1);
      try {
        parsed = JSON.parse(frag);
      } catch {
        // 清理尾随逗号等常见残缺后再试
        frag = frag.replace(/,\s*([}\]])/g, '$1');
        try {
          parsed = JSON.parse(frag);
        } catch {
          throw new Error(`无法解析审核结果: ${content.slice(0, 120)}`);
        }
      }
    } else {
      throw new Error(`无法解析审核结果: ${content.slice(0, 120)}`);
    }
    return {
      approved: Boolean(parsed.approved),
      reason: String(parsed.reason ?? ''),
      provider: `ai:${providerKey}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

// 主审核入口：按 Provider 优先级尝试，支持降级
export async function reviewEvent(event: {
  title: string;
  date: string;
  city: string;
  venue: string;
  registration?: string;
  benefits?: string;
  requirements?: string;
  contact?: string;
}): Promise<ReviewResult> {
  // AI 审核开关
  if (process.env.AI_REVIEW_ENABLED !== 'true') {
    return { approved: true, reason: 'AI审核已关闭，自动通过', provider: 'auto' };
  }

  const providers = getProviders();
  const preferredProvider = process.env.AI_REVIEW_PROVIDER || 'minicpm';
  const timeout = parseInt(process.env.AI_REVIEW_TIMEOUT || '10000', 10);

  // 优先级列表：首选 → 其他可用 Provider
  const order = [preferredProvider];
  for (const key of Object.keys(providers)) {
    if (key !== preferredProvider && providers[key].apiKey) {
      order.push(key);
    }
  }

  let lastError = '';
  for (const key of order) {
    const provider = providers[key];
    if (!provider?.apiKey) continue;

    try {
      const result = await reviewWithProvider(provider, key, event, timeout);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ AI审核 Provider ${provider.name} 失败: ${msg}`);
      lastError = msg;
      continue; // 降级到下一个 Provider
    }
  }

  // 所有 Provider 都失败 → 宽松放行（宁可人工复核，不误拒正经技术活动）
  return {
    approved: true,
    reason: `AI审核服务暂不可用，已默认放行待人工复核: ${lastError.slice(0, 80)}`,
    provider: 'fallback',
  };
}

// ===== 信息抽取（多模态自动填表）=====
// 复用审核的 provider 体系与降级链，从图片或文本中结构化提取活动字段。

const EMPTY_FIELDS: EventFormData = {
  title: '', date: '', city: '', venue: '',
  registration: '', benefits: '', requirements: '', contact: '',
};

const EXTRACT_SYSTEM_PROMPT = `你是活动信息抽取助手。从用户提供的活动海报图片或活动介绍文本中，提取结构化字段。
只返回一行 JSON，不要 markdown 代码块，不要任何前后缀和解释。缺失的字段必须返回空字符串 ""（严禁填"未提供""暂无""不详"等任何占位描述，宁缺毋滥）。
字段如下：
{
  "title": "活动主题/名称",
  "date": "活动日期+开始时间，合并到这一个字段，格式 YYYY-MM-DDTHH:mm（24小时制，如 2026-05-20T09:00）。规则：①务必读出具体开始时刻（几点几分），多日范围取起始日的开始时间；②海报只写月日（如\"6.20\"）没写年份时，按 2026 年补全；③所有时间信息必须并入 date，禁止单独输出 time 字段；④无法确定具体时间则只填日期 YYYY-MM-DD；无法确定日期则空字符串",
  "city": "举办城市，仅中文城市名（如"北京"），不带"市"；无法确定则空字符串",
  "venue": "详细地址（场馆/楼宇名+区+路名+门牌号；若活动仅公布到区/商圈级如"罗湖区"或"定西路"，就填到已知的最细粒度；具体地点未公开则填已公开部分，可附简短括注）",
  "registration": "报名方式（如官网链接、报名入口、是否免费等）",
  "benefits": "活动福利（参会证书、资料等）",
  "requirements": "参加要求/面向人群",
  "contact": "联系方式（邮箱/电话/微信等）"
}
注意：city 只要城市名本身，例如文本写"北京市朝阳区"则提取"北京"。venue 尽量完整（场馆名+区+路名+门牌号，如海报可见）。所有时间信息一律并入 date 字段，不要输出 time/timestamp 等其它时间字段。`;

function buildExtractMessages(input: { image?: string; text?: string }) {
  const textPart = {
    type: 'text' as const,
    text: input.text
      ? `请从以下活动介绍文本中提取字段：\n\n${input.text}`
      : '请从提供的活动海报图片中提取字段。',
  };
  if (input.image) {
    const url = input.image.startsWith('data:')
      ? input.image
      : `data:image/jpeg;base64,${input.image}`;
    return [
      { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
      { role: 'user', content: [textPart, { type: 'image_url' as const, image_url: { url } }] },
    ];
  }
  return [
    { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
    { role: 'user', content: [textPart] },
  ];
}

// 规范化日期+时间 → "YYYY-MM-DDTHH:mm"（ISO 无秒）；MiniCPM 指令遵循不严，
// 常返回"2026年5月20日 上午9点"/"2026/5.20 14:00-17:00"/"6.20 周六"等，需清洗。
// 日期部分取日期范围的起始日；无年份时补当前年份（海报常省略年份）；
// 时间部分优先匹配 HH:MM（范围取开始），其次上午/下午 N 点（半）。
// 无法识别日期返回空字符串（前端会提示必填，避免脏值入库）；无具体时间则只返回日期。
function normalizeDateTime(raw: string, nowYear?: number): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const fallbackYear = nowYear ?? new Date().getFullYear();

  // —— 日期部分 ——
  // 有年份：兼容 "2026-05-20" / "2026年5月20日" / "2026/5.20"
  // 无年份（海报常省略，如 "6.20" / "6月20日"）：补当前年份
  let datePart = '';
  const withYear =
    s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/) ||
    s.match(/(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/);
  if (withYear) {
    datePart = `${withYear[1]}-${withYear[2].padStart(2, '0')}-${withYear[3].padStart(2, '0')}`;
  } else {
    const noYear =
      s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/) ||
      s.match(/(\d{1,2})[/.\-](\d{1,2})(?!\d)/);
    if (noYear) {
      datePart = `${fallbackYear}-${noYear[1].padStart(2, '0')}-${noYear[2].padStart(2, '0')}`;
    }
  }
  if (!datePart) return '';

  // —— 时间部分 ——
  let hour: number | null = null;
  let minute = 0;
  // 1) HH:MM（范围如 "09:00-17:00" 取第一个）
  const hm = s.match(/(\d{1,2}):(\d{2})/);
  if (hm) {
    hour = parseInt(hm[1], 10);
    minute = parseInt(hm[2], 10);
  } else {
    // 2) 上午/下午/晚上 N 点（半） / N点30
    const ampm = s.match(/(上午|下午|早上|晚上|凌晨|中午)?\s*(\d{1,2})\s*点(?:半|(\d{1,2}))?/);
    if (ampm) {
      let h = parseInt(ampm[2], 10);
      const period = ampm[1] || '';
      if (/(下午|晚上|中午)/.test(period) && h < 12) h += 12;
      if (/(上午|早上|凌晨)/.test(period) && h === 12) h = 0;
      hour = h;
      minute = ampm[3] ? parseInt(ampm[3], 10) : /半/.test(ampm[0]) ? 30 : 0;
    }
  }

  if (hour === null || hour > 23 || minute > 59) return datePart; // 无有效时间 → 只返回日期
  return `${datePart}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// 容错解析 JSON（复用审核的兜底逻辑）
function parseFields(content: string): EventFormData {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error(`无法解析抽取结果: ${content.slice(0, 120)}`);
  }
  let frag = content.slice(start, end + 1);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(frag);
  } catch {
    frag = frag.replace(/,\s*([}\]])/g, '$1');
    try {
      parsed = JSON.parse(frag);
    } catch {
      throw new Error(`无法解析抽取结果: ${content.slice(0, 120)}`);
    }
  }
  const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();
  // 模型偶尔把时间单独放进 time 字段（尽管 prompt 禁止），这里把 date+time 拼接后一并规范化
  const dateRaw = [s(parsed.date), s(parsed.time)].filter(Boolean).join(' ');
  return {
    title: s(parsed.title),
    date: normalizeDateTime(dateRaw),
    city: s(parsed.city),
    venue: s(parsed.venue),
    registration: s(parsed.registration),
    benefits: s(parsed.benefits),
    requirements: s(parsed.requirements),
    contact: s(parsed.contact),
  };
}

async function extractWithProvider(
  provider: AIProvider,
  providerKey: string,
  input: { image?: string; text?: string },
  timeout: number,
): Promise<ExtractResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${provider.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: buildExtractMessages(input),
        temperature: 0.1,
        max_tokens: 600,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const fields = parseFields(content);
    return { fields, provider: `ai:${providerKey}` };
  } finally {
    clearTimeout(timer);
  }
}

// 抽取主入口：图片走多模态 provider，纯文本所有 provider 均可；带降级
export async function extractEvent(input: {
  image?: string;
  text?: string;
}): Promise<ExtractResult> {
  const providers = getProviders();
  const preferredProvider = process.env.AI_REVIEW_PROVIDER || 'minicpm';
  const timeout = parseInt(process.env.AI_REVIEW_TIMEOUT || '15000', 10);
  const hasImage = Boolean(input.image);

  // 优先级列表：首选 → 其他可用 provider
  const order = [preferredProvider];
  for (const key of Object.keys(providers)) {
    if (key !== preferredProvider && providers[key].apiKey) order.push(key);
  }

  let lastError = '';
  for (const key of order) {
    const provider = providers[key];
    if (!provider?.apiKey) continue;
    // 带图片时跳过非多模态 provider
    if (hasImage && !provider.multimodal) continue;

    try {
      return await extractWithProvider(provider, key, input, timeout);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ 抽取 Provider ${provider.name} 失败: ${msg}`);
      lastError = msg;
      continue;
    }
  }

  // 带图片但没有任何多模态 provider 可用 → 给出明确错误
  if (hasImage) {
    throw new Error(`图片识别需要多模态模型(如 MiniCPM-V)，当前未配置可用多模态 Provider: ${lastError.slice(0, 80)}`);
  }
  throw new Error(`AI 抽取服务暂不可用: ${lastError.slice(0, 80)}`);
}

