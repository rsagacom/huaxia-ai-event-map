// 华夏AI线下活动地图 — 前端筛选工具函数
import dayjs from 'dayjs';
import type { AIEvent, CityNode } from './types';

// 通用日期范围筛选
export function filterByDateRange(
  events: AIEvent[],
  startDate: string,
  endDate: string,
): AIEvent[] {
  return events.filter((evt) => {
    const d = dayjs(evt.date);
    return (
      d.isAfter(dayjs(startDate).subtract(1, 'day')) &&
      d.isBefore(dayjs(endDate).add(1, 'day'))
    );
  });
}

// 获取每个城市的活动数量
export function getCityEventCount(events: AIEvent[]): Record<string, number> {
  const count: Record<string, number> = {};
  events.forEach((evt) => {
    count[evt.city] = (count[evt.city] || 0) + 1;
  });
  return count;
}

// 获取指定城市的活动
export function getEventsByCity(events: AIEvent[], cityName: string): AIEvent[] {
  return events.filter((e) => e.city === cityName);
}

// SWR fetcher
export const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  });

// 规范化城市名用于模糊匹配：去空格、去"市/市辖区/省"等后缀
function normalizeCity(raw: string): string {
  return raw
    .trim()
    .replace(/(市辖区|省|市|自治区|自治州)$/g, '')
    .trim();
}

// 把 AI 抽取的原始城市名匹配到 cities 列表里的标准名；匹配不上返回 null
export function matchCity(raw: string, cities: CityNode[]): string | null {
  const target = normalizeCity(raw);
  if (!target) return null;

  // 1. 精确匹配（规范化后）
  for (const c of cities) {
    if (normalizeCity(c.name) === target) return c.name;
  }
  // 2. 包含匹配（如"北京市朝阳区"含"北京"）
  for (const c of cities) {
    const cn = normalizeCity(c.name);
    if (cn && (target.includes(cn) || cn.includes(target))) return c.name;
  }
  return null;
}

