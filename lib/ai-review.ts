// 华夏AI线下活动地图 — AI 审核：多 Provider adapter + 降级 + 端侧兼容

export interface ReviewResult {
  approved: boolean;
  reason: string;
  provider: string;
}

interface AIProvider {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

// 多 Provider 配置 — 全部兼容 OpenAI Chat Completions 格式
function getProviders(): Record<string, AIProvider> {
  return {
    deepseek: {
      name: 'DeepSeek',
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: 'deepseek-chat',
    },
    glm: {
      name: 'GLM (智谱)',
      baseURL: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: process.env.GLM_API_KEY || '',
      model: 'glm-4-flash',
    },
    minicpm: {
      name: 'MiniCPM',
      baseURL: process.env.MINICPM_BASE_URL || 'https://api.modelbest.cn/v1',
      apiKey: process.env.MINICPM_API_KEY || '',
      model: 'MiniCPM-V-4.6-Instruct',
    },
    step: {
      name: 'Step (阶跃)',
      baseURL: process.env.STEP_BASE_URL || 'https://api.stepfun.com/v1',
      apiKey: process.env.STEP_API_KEY || '',
      model: 'step-1-8k',
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
        max_tokens: 350,
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
