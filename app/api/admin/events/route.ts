// GET /api/admin/events — 列出活动
//   ?status=approved  已发布
//   ?status=pending   待审核
//   ?status=rejected  已拒绝
//   ?status=all       全部
//   不传              待审核 + 已拒绝（默认，审核队列）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authErr = await checkAuth(request);
  if (authErr) return authErr;

  const status = request.nextUrl.searchParams.get('status');
  const where =
    status === 'all'
      ? {}
      : status
        ? { status }
        : { status: { in: ['pending', 'rejected'] } };

  // 按发布时间（createdAt）从新到旧
  const events = await prisma.event.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ events });
}

