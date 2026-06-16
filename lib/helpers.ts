// 华夏AI线下活动地图 — 前端筛选工具函数
import dayjs from 'dayjs';
import type { AIEvent } from './types';

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
