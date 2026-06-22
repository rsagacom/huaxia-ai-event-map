'use client';
// 华夏AI线下活动地图 — 主客户端组件（SWR 数据流）
import { useState, useCallback } from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import dynamic from 'next/dynamic';
import Timeline from './Timeline';
import EventList from './EventList';
import RegistrationModal from './RegistrationModal';
import type { AIEvent, CityNode, EventFormData } from '@/lib/types';
import { fetcher, filterByDateRange } from '@/lib/helpers';

// ECharts 必须跳过 SSR
const ChinaMap = dynamic(() => import('./ChinaMap'), { ssr: false });

export default function AppClient() {
  // 时间范围
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');

  // 选中的城市
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // 报名弹窗
  const [showModal, setShowModal] = useState(false);

  // 成功提示
  const [toast, setToast] = useState<string | null>(null);

  // SWR 获取 approved 活动
  const { data: eventsData, mutate: mutateEvents } = useSWR('/api/events', fetcher);
  const { data: citiesData } = useSWR('/api/cities', fetcher);
  // 运营横幅（由环境变量 SITE_BANNER 控制，开源部署默认为空）
  // wechatId（SITE_WECHAT_ID）非空时，banner 中出现的该微信号会渲染为可点击复制胶囊
  const { data: siteConfig } = useSWR<{ banner?: string; wechatId?: string }>('/api/site-config', fetcher);

  const allEvents: AIEvent[] = eventsData?.events ?? [];
  const cities: CityNode[] = citiesData?.cities ?? [];

  // 用日期筛选，按活动日期由近至远排列（距今天最近的在上，远期在下）
  const displayEvents = filterByDateRange(allEvents, startDate, endDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 日期范围变化
  const handleDateRangeChange = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  // 点击城市
  const handleCityClick = useCallback((cityName: string) => {
    setSelectedCity(cityName === selectedCity ? null : cityName);
  }, [selectedCity]);

  // 提交活动 → POST API
  const handleSubmitEvent = useCallback(async (formData: EventFormData): Promise<{ status: string; reason?: string }> => {
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = await res.json();
        const status: string = data.event?.status || 'pending';
        const reason: string | undefined = data.event?.reviewReason;
        mutateEvents();
        if (status === 'approved') {
          setShowModal(false);
          setToast(`✅ 活动「${formData.title}」已通过自动审核`);
          setTimeout(() => setToast(null), 4000);
        } else {
          // rejected：不关弹窗，交由 RegistrationModal 展示原因；这里仅轻提示
          setToast(`⚠️ 活动「${formData.title}」未通过自动审核，已转人工复核`);
          setTimeout(() => setToast(null), 5000);
        }
        return { status, reason };
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`提交失败: ${err.error || res.statusText}`);
        return { status: 'error', reason: err.error || res.statusText };
      }
    } catch {
      alert('网络错误，请稍后重试');
      return { status: 'error', reason: '网络错误' };
    }
  }, [mutateEvents]);

  // 城市筛选
  const cityFilteredEvents = selectedCity
    ? displayEvents.filter((e) => e.city === selectedCity)
    : displayEvents;

  // 点击复制群主微信号
  const handleCopyWechat = useCallback(async () => {
    const id = siteConfig?.wechatId;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // 兼容旧浏览器 / 非安全上下文
      const ta = document.createElement('textarea');
      ta.value = id;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setToast(`✅ 已复制群主微信：${id}`);
    setTimeout(() => setToast(null), 2500);
  }, [siteConfig?.wechatId]);

  // 把 banner 按 wechatId 切片，中间插入可点击复制胶囊
  const renderBanner = useCallback((banner: string, wechatId?: string) => {
    if (!wechatId || !banner.includes(wechatId)) {
      return <>{banner}</>;
    }
    const parts = banner.split(wechatId);
    return (
      <>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <button
                type="button"
                className="promo-wechat"
                onClick={handleCopyWechat}
                title="点击复制微信号"
              >
                {wechatId}
                <span className="promo-wechat-copy" aria-hidden>📋</span>
              </button>
            )}
          </span>
        ))}
      </>
    );
  }, [handleCopyWechat]);

  // 统计
  const totalEvents = displayEvents.length;
  const totalCities = new Set(displayEvents.map((e) => e.city)).size;
  const upcomingEvents = displayEvents.filter((e) => dayjs(e.date).isAfter(dayjs())).length;

  return (
    <div className="app-container">
      {/* 顶部运营横幅（由环境变量 SITE_BANNER 控制，开源部署默认不显示） */}
      {siteConfig?.banner && (
        <div className="promo-banner">
          <span className="promo-icon">📣</span>
          {renderBanner(siteConfig.banner, siteConfig.wechatId)}
        </div>
      )}
      {/* 顶部标题栏 */}
      <header className="app-header">
        <div>
          <div className="app-title">华夏AI线下活动地图</div>
          <div className="app-subtitle">HUAXIA AI OFFLINE EVENT MAP</div>
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <div className="stat-value">{totalEvents}</div>
            <div className="stat-label">活动总数</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{totalCities}</div>
            <div className="stat-label">覆盖城市</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{upcomingEvents}</div>
            <div className="stat-label">即将举办</div>
          </div>
        </div>
        <div className="header-actions">
          {selectedCity && (
            <button
              className="btn-secondary"
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => setSelectedCity(null)}
            >
              ✕ 清除城市筛选: {selectedCity}
            </button>
          )}
          <button className="btn-add-event" onClick={() => setShowModal(true)}>
            ＋ 提交活动
          </button>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="app-main">
        <ChinaMap
          startDate={startDate}
          endDate={endDate}
          onCityClick={handleCityClick}
          events={displayEvents}
          cities={cities}
        />

        <div className="side-panel">
          <Timeline
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={handleDateRangeChange}
          />
          <EventList events={cityFilteredEvents} />
        </div>
      </main>

      <RegistrationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmitEvent}
        cities={cities}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
