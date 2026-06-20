'use client';
// 华夏AI线下活动地图 — 活动列表
import { useState, type ReactNode } from 'react';
import dayjs from 'dayjs';
import type { AIEvent } from '@/lib/types';

interface EventListProps {
  events: AIEvent[];
}

// 复制文本到剪贴板：优先 navigator.clipboard，不可用时回退 execCommand
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 落到下面的兜底方案
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// 将文本里的网址（完整 URL 或裸域名）渲染成可点击链接，新标签打开
function renderTextWithLinks(text: string): ReactNode[] {
  const re = /(https?:\/\/[^\s（）()，,。；;、]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s（）()，,。；;、]*)?)/gi;
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const url = m[0];
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    nodes.push(
      <a
        key={`link-${i++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="field-link"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    last = m.index + url.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// 友好展示活动时间：
//   纯日期 "YYYY-MM-DD"        → "2026年5月20日"
//   带时间 "YYYY-MM-DDTHH:mm"  → "2026年5月20日 09:00"（T00:00 视为未指定，只显示日期）
function formatEventDate(raw: string): string {
  if (!raw) return '';
  const d = dayjs(raw);
  if (!d.isValid()) return raw;
  const withTime = raw.includes('T') && !(d.hour() === 0 && d.minute() === 0);
  return withTime ? d.format('YYYY年M月D日 HH:mm') : d.format('YYYY年M月D日');
}

interface Field {
  label: string;
  value: string;
}

function EventCard({ evt }: { evt: AIEvent }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // 展开后显示的 5 个字段（空值显示“暂无”）
  const fields: Field[] = [
    { label: '报名方式', value: evt.registration },
    { label: '活动福利', value: evt.benefits },
    { label: '参加要求', value: evt.requirements },
    { label: '联系方式', value: evt.contact },
    { label: '活动地址', value: `${evt.city} · ${evt.venue}` },
  ];

  const toggle = () => setExpanded((v) => !v);

  // 一键复制全部信息：每字段一行
  const copyAll = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 避免触发卡片展开/收起
    const text = fields
      .map((f) => `${f.label}：${(f.value || '').trim() || '暂无'}`)
      .join('\n');
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      alert('复制失败，请手动选中复制');
    }
  };

  return (
    <div
      className={`event-card${expanded ? ' event-card-expanded' : ''}`}
      onClick={toggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <div className="event-card-head">
        <div className="event-card-title">{evt.title}</div>
        <span className="event-card-arrow">{expanded ? '▴' : '▾'}</span>
      </div>
      <div className="event-card-meta">
        <span className="event-meta-item"><span className="icon">📅</span> {formatEventDate(evt.date)}</span>
        <span className="event-meta-item"><span className="icon">📍</span> {evt.city}</span>
      </div>

      {expanded && (
        <div className="event-card-detail">
          <button
            type="button"
            className={`copy-all-btn${copied ? ' copied' : ''}`}
            onClick={copyAll}
            title="复制全部信息（每字段一行）"
          >
            {copied ? '✓ 已复制全部信息' : '📋 复制全部信息'}
          </button>
          {fields.map((f) => {
            const val = (f.value || '').trim();
            return (
              <div className="event-card-field" key={f.label}>
                <span className="field-label">{f.label}</span>
                <span className="field-value">{val ? renderTextWithLinks(val) : '暂无'}</span>
              </div>
            );
          })}
        </div>
      )}

      {!expanded && (
        <div className="event-card-toggle">展开详情 ▾</div>
      )}
    </div>
  );
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
        events.map((evt) => <EventCard key={evt.id} evt={evt} />)
      )}
    </div>
  );
}
