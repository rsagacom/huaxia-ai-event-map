// 共享 admin 认证工具 — 所有 admin API 路由复用
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function checkAuth(request: NextRequest): Promise<NextResponse | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const row = await prisma.adminConfig.findUnique({ where: { key: 'password_hash' } });
  if (!row || token !== row.value) return NextResponse.json({ error: '认证失败' }, { status: 401 });
  return null;
}
