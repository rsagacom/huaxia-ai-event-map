// GET /api/cities
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const cities = await prisma.city.findMany({ orderBy: { id: 'asc' } });

  // 转换为前端需要的 { name, coord: [lng, lat], level } 格式
  const result = cities.map((c) => ({
    name: c.name,
    coord: [c.longitude, c.latitude] as [number, number],
    level: c.level,
  }));

  return NextResponse.json({ cities: result });
}
