// GET  /api/admin/auth/status — 检查密码是否已设置
// POST /api/admin/auth/setup  — 首次设置密码
// POST /api/admin/auth/login  — 验证密码
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

function hashPassword(pwd: string): string {
  return createHash('sha256').update(pwd + '_huaxia_salt_2026').digest('hex');
}

async function getPasswordHash(): Promise<string | null> {
  const row = await prisma.adminConfig.findUnique({ where: { key: 'password_hash' } });
  return row?.value ?? null;
}

// GET: 检查是否已设置密码
export async function GET() {
  const hash = await getPasswordHash();
  return NextResponse.json({ passwordSet: !!hash });
}

// POST: 设置密码（仅首次）或验证密码
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, password } = body;

  if (!password || password.length < 4) {
    return NextResponse.json({ error: '密码至少4位' }, { status: 400 });
  }

  if (action === 'setup') {
    // 首次设置——只有在还没设密码时才能用
    const existing = await getPasswordHash();
    if (existing) {
      return NextResponse.json({ error: '密码已设置，请使用登录功能' }, { status: 400 });
    }
    await prisma.adminConfig.upsert({
      where: { key: 'password_hash' },
      update: { value: hashPassword(password) },
      create: { key: 'password_hash', value: hashPassword(password) },
    });
    return NextResponse.json({ success: true, token: hashPassword(password) });

  } else if (action === 'login') {
    // 验证密码
    const existing = await getPasswordHash();
    if (!existing) {
      return NextResponse.json({ error: '请先设置密码' }, { status: 400 });
    }
    if (hashPassword(password) !== existing) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }
    return NextResponse.json({ success: true, token: hashPassword(password) });

  } else {
    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  }
}
