// POST /api/extract-event — 多模态/文本抽取活动字段，供前端自动填表
// 复用 lib/ai-review.ts 的 provider 体系；不落库，仅返回结构化字段。
import { NextRequest, NextResponse } from 'next/server';
import { extractEvent } from '@/lib/ai-review';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB base64 上限

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, text } = body as { image?: string; text?: string };

    const hasText = typeof text === 'string' && text.trim().length > 0;
    const hasImage = typeof image === 'string' && image.trim().length > 0;

    if (!hasText && !hasImage) {
      return NextResponse.json(
        { error: '请提供活动海报图片或活动介绍文本' },
        { status: 400 },
      );
    }

    // 图片体积校验（base64 字符数约等于字节数，略宽松）
    if (hasImage && image!.length > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: '图片过大（>4MB），请压缩或裁剪后重试' },
        { status: 413 },
      );
    }

    const result = await extractEvent({
      image: hasImage ? image : undefined,
      text: hasText ? text!.trim() : undefined,
    });

    return NextResponse.json({ fields: result.fields, provider: result.provider });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('活动字段抽取失败:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
