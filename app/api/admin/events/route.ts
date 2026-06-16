// GET /api/admin/events — 列出 pending + rejected 活动
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const authErr = await checkAuth(request);
  if (authErr) return authErr;

  const events = await prisma.event.findMany({
    where: { status: { in: ['pending', 'rejected'] } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ events });
}
