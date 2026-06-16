// GET/PUT /api/admin/review-config — 审核配置
import { NextRequest, NextResponse } from 'next/server';

function checkAuth(request: NextRequest): NextResponse | null {
  const auth = request.headers.get('authorization');
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return NextResponse.json({ error: '未配置 ADMIN_PASSWORD' }, { status: 500 });
  if (auth !== `Bearer ${password}`) return NextResponse.json({ error: '认证失败' }, { status: 401 });
  return null;
}

export async function GET(request: NextRequest) {
  const authErr = checkAuth(request);
  if (authErr) return authErr;

  return NextResponse.json({
    provider: process.env.AI_REVIEW_PROVIDER || 'minicpm',
    enabled: process.env.AI_REVIEW_ENABLED === 'true',
    timeout: parseInt(process.env.AI_REVIEW_TIMEOUT || '10000', 10),
    availableProviders: {
      deepseek: !!process.env.DEEPSEEK_API_KEY,
      glm: !!process.env.GLM_API_KEY,
      minicpm: !!process.env.MINICPM_API_KEY,
      step: !!process.env.STEP_API_KEY,
    },
  });
}
