// GET /api/admin/events — 列出 pending + rejected 活动
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

  const events = await prisma.event.findMany({
    where: { status: { in: ['pending', 'rejected'] } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ events });
}
