// GET /api/site-config — 站点运行时配置
// banner 由环境变量 SITE_BANNER 注入；开源部署默认为空（不显示横幅）。
// 这样运营文案只存在于生产环境变量，不会进入开源代码仓库。
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    banner: process.env.SITE_BANNER || '',
  });
}
