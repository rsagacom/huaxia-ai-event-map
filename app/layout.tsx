import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '华夏AI线下活动地图',
  description: 'HUAXIA AI Offline Event Map — 全国AI线下活动一览',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
