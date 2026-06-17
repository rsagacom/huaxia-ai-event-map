// DELETE /api/admin/events/[id] — 删除活动（复用 admin 鉴权）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/admin-auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = await checkAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  try {
    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: '活动不存在或已删除' }, { status: 404 });
  }
}
