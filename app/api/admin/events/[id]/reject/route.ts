// POST /api/admin/events/[id]/reject
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/admin-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = await checkAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason = body.reason || '人工审核拒绝';

  const event = await prisma.event.update({
    where: { id },
    data: { status: 'rejected', reviewedAt: new Date(), reviewedBy: 'manual', reviewReason: reason },
  });
  return NextResponse.json({ event });
}
