// GET /api/site-config — 站点运行时配置
// banner 由环境变量 SITE_BANNER 注入；开源部署默认为空（不显示横幅）。
// 这样运营文案只存在于生产环境变量，不会进入开源代码仓库。
// wechatId 由 SITE_WECHAT_ID 注入；非空时前端会把 banner 中出现的该微信号
// 渲染成「点击复制」胶囊，便于访客一键复制群主微信。
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    banner: process.env.SITE_BANNER || '',
    wechatId: process.env.SITE_WECHAT_ID || '',
  });
}
