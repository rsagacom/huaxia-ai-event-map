// POST /api/admin/events/[id]/approve
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
  const event = await prisma.event.update({
    where: { id },
    data: { status: 'approved', reviewedAt: new Date(), reviewedBy: 'manual', reviewReason: '人工审核通过' },
  });
  return NextResponse.json({ event });
}
