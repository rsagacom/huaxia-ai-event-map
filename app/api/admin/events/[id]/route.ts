// DELETE /api/admin/events/[id] — 删除活动（复用 admin 鉴权）
// PATCH  /api/admin/events/[id] — 人工编辑已发布活动字段（补充/修正信息）
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAuth } from '@/lib/admin-auth';

// 允许人工编辑的字段（与 EventFormData 对齐）
const EDITABLE_FIELDS = [
  'title',
  'date',
  'city',
  'venue',
  'registration',
  'benefits',
  'requirements',
  'contact',
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

const REQUIRED_FIELDS: EditableField[] = ['title', 'date', 'city', 'venue'];

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = await checkAuth(request);
  if (authErr) return authErr;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  // 仅拾取白名单字段，忽略其余
  const data: Record<string, string> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) {
      const v = body[key];
      if (typeof v !== 'string') {
        return NextResponse.json({ error: `字段 ${key} 必须是字符串` }, { status: 400 });
      }
      data[key] = v;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 });
  }

  // 必填字段若本次提交则不能为空
  for (const key of REQUIRED_FIELDS) {
    if (key in data && !data[key].trim()) {
      return NextResponse.json({ error: `${key} 不能为空` }, { status: 400 });
    }
  }

  try {
    const event = await prisma.event.update({
      where: { id },
      data,
    });
    return NextResponse.json({ ok: true, event });
  } catch {
    // 常见失败：city 不在 City 表中（外键约束）
    return NextResponse.json(
      { error: '更新失败：城市不在列表中，或活动不存在' },
      { status: 400 },
    );
  }
}
