// GET /api/admin/review-config — 审核配置
import { NextRequest, NextResponse } from 'next/server';
import { checkAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authErr = await checkAuth(request);
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
