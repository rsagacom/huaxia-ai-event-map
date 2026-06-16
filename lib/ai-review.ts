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
const REVIEW_SYSTEM_PROMPT = `你是一个内容审核员，负责审核用户提交的"AI线下活动"信息。

判断标准：
1. 内容必须是关于人工智能(AI)相关的线下活动、会议、论坛、沙龙、展览、工坊等
2. 活动必须在中国境内举办
3. 不能是纯线上活动
4. 不能是广告、推销、无关内容

请只返回以下 JSON 格式，不要返回其他任何文字：
{"approved": true/false, "reason": "简短理由"}`;

const REVIEW_USER_PROMPT = (event: {
  title: string;
  date: string;
  city: string;
  venue: string;
  registration?: string;
  benefits?: string;
  requirements?: string;
}) => `请审核以下活动提交：

活动主题：${event.title}
时间：${event.date}
城市：${event.city}
场馆：${event.venue}
报名方式：${event.registration || '未提供'}
活动福利：${event.benefits || '未提供'}
参加要求：${event.requirements || '未提供'}

判断这是否是一个合规的"AI线下活动"，只返回 JSON。`;

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
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    // 解析 JSON 返回
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      throw new Error(`无法解析审核结果: ${content.slice(0, 100)}`);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      approved: Boolean(parsed.approved),
      reason: String(parsed.reason || ''),
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

  // 所有 Provider 都失败 → 返回 pending，等人工审核
  return {
    approved: false,
    reason: `AI审核服务暂不可用: ${lastError.slice(0, 100)}`,
    provider: 'fallback',
  };
}
