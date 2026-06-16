// GET /api/events — 只返回 approved 的活动
// POST /api/events — 提交新活动，触发 AI 审核
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reviewEvent } from '@/lib/ai-review';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const city = searchParams.get('city');

  const where: Record<string, unknown> = { status: 'approved' };

  if (city) where.city = city;

  if (startDate || endDate) {
    // SQLite 字符串比较可以处理 YYYY-MM-DD
    const dateFilter: Record<string, string> = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;
    where.date = dateFilter;
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: 'asc' },
    take: 200,
  });

  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, date, city, venue, registration, benefits, requirements, contact } = body;

    // 校验必填
    if (!title || !date || !city || !venue) {
      return NextResponse.json(
        { error: '缺少必填字段：title, date, city, venue' },
        { status: 400 },
      );
    }

    // 检查城市是否存在
    const cityExists = await prisma.city.findUnique({ where: { name: city } });
    if (!cityExists) {
      return NextResponse.json({ error: `城市 "${city}" 不在支持列表中` }, { status: 404 });
    }

    const id = `evt-${Date.now()}`;

    // AI 审核
    const review = await reviewEvent({ title, date, city, venue, registration, benefits, requirements });
    const status = review.approved ? 'approved' : 'rejected';

    const event = await prisma.event.create({
      data: {
        id,
        title,
        date,
        city,
        venue,
        registration: registration || '待定',
        benefits: benefits || '待定',
        requirements: requirements || '无特殊要求',
        contact: contact || '',
        status,
        reviewReason: review.reason,
        reviewedAt: new Date(),
        reviewedBy: review.provider,
      },
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (err) {
    console.error('创建活动失败:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
