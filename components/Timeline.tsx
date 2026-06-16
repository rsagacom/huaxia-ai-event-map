'use client';
// 华夏AI线下活动地图 — 时间轴组件
import { useState } from 'react';
import dayjs from 'dayjs';

interface TimelineProps {
  startDate: string;
  endDate: string;
  onDateRangeChange: (start: string, end: string) => void;
}

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

export default function Timeline({ startDate, endDate, onDateRangeChange }: TimelineProps) {
  const [quickRange, setQuickRange] = useState<string>('all');

  const startMonth = dayjs(startDate).month();
  const endMonth = dayjs(endDate).month();

  const handleQuickRange = (range: string) => {
    setQuickRange(range);
    const now = dayjs();
    let start: dayjs.Dayjs;
    let end: dayjs.Dayjs;
    switch (range) {
      case '1m': start = now; end = now.add(1, 'month'); break;
      case '3m': start = now; end = now.add(3, 'month'); break;
      case '6m': start = now; end = now.add(6, 'month'); break;
      default: start = dayjs('2026-01-01'); end = dayjs('2026-12-31'); break;
    }
    onDateRangeChange(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
  };

  const yearStart = dayjs('2026-01-01').valueOf();
  const yearEnd = dayjs('2026-12-31').valueOf();
  const totalSpan = yearEnd - yearStart;
  const rangeStart = dayjs(startDate).valueOf();
  const rangeEnd = dayjs(endDate).valueOf();
  const leftPercent = ((rangeStart - yearStart) / totalSpan) * 100;
  const widthPercent = ((rangeEnd - rangeStart) / totalSpan) * 100;

  return (
    <div className="timeline-section">
      <div className="timeline-header">
        <div className="timeline-title">时间轴</div>
      </div>
      <div className="timeline-controls">
        <div className="date-input-group">
          <span className="date-label">起</span>
          <input type="date" className="date-input" value={startDate}
            onChange={(e) => { setQuickRange(''); onDateRangeChange(e.target.value, endDate); }} />
        </div>
        <div className="date-input-group">
          <span className="date-label">止</span>
          <input type="date" className="date-input" value={endDate}
            onChange={(e) => { setQuickRange(''); onDateRangeChange(startDate, e.target.value); }} />
        </div>
      </div>
      <div className="timeline-range-bar">
        <div className="timeline-range-fill" style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }} />
      </div>
      <div className="timeline-months">
        {MONTHS.map((m, i) => (
          <span key={m} className={`timeline-month ${i >= startMonth && i <= endMonth ? 'active' : ''}`}>{m}</span>
        ))}
      </div>
      <div className="quick-range-btns">
        {['1m', '3m', '6m', 'all'].map((r) => (
          <button key={r} className={`quick-range-btn ${quickRange === r ? 'active' : ''}`}
            onClick={() => handleQuickRange(r)}>
            {{ '1m': '近1月', '3m': '近3月', '6m': '近6月', 'all': '全年' }[r]}
          </button>
        ))}
      </div>
    </div>
  );
}
