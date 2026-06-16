'use client';
// 华夏AI线下活动地图 — 活动列表
import type { AIEvent } from '@/lib/types';

interface EventListProps {
  events: AIEvent[];
}

export default function EventList({ events }: EventListProps) {
  return (
    <div className="events-section">
      <div className="events-header">
        <span className="events-title">📋 活动列表</span>
        <span className="events-count">{events.length} 场</span>
      </div>
      {events.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#556680', padding: '40px 0', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          当前时间范围内暂无活动
        </div>
      ) : (
        events.map((evt) => (
          <div key={evt.id} className="event-card">
            <div className="event-card-title">{evt.title}</div>
            <div className="event-card-meta">
              <span className="event-meta-item"><span className="icon">📅</span> {evt.date}</span>
              <span className="event-meta-item"><span className="icon">📍</span> {evt.city} · {evt.venue}</span>
            </div>
            <div className="event-card-benefits">🎁 {evt.benefits}</div>
            <div className="event-card-requirements">⚡ {evt.requirements}</div>
            <span className="event-card-registration">📝 {evt.registration}</span>
          </div>
        ))
      )}
    </div>
  );
}
