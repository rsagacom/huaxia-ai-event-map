// POST /api/admin/events/[id]/reject
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function checkAuth(request: NextRequest): NextResponse | null {
  const auth = request.headers.get('authorization');
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return NextResponse.json({ error: '未配置 ADMIN_PASSWORD' }, { status: 500 });
  if (auth !== `Bearer ${password}`) return NextResponse.json({ error: '认证失败' }, { status: 401 });
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = checkAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = body.reason || '人工审核拒绝';

  const event = await prisma.event.update({
    where: { id },
    data: {
      status: 'rejected',
      reviewedAt: new Date(),
      reviewedBy: 'manual',
      reviewReason: reason,
    },
  });

  return NextResponse.json({ event });
}
