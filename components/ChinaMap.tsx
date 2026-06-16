'use client';
// 华夏AI线下活动地图 — ECharts 中国地图
import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { AIEvent, CityNode } from '@/lib/types';
import { getCityEventCount } from '@/lib/helpers';

interface ChinaMapProps {
  startDate: string;
  endDate: string;
  onCityClick: (cityName: string) => void;
  events: AIEvent[];
  cities: CityNode[];
}

export default function ChinaMap({ onCityClick, events, cities }: ChinaMapProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const mapRegistered = useRef(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current, 'dark');
    chartInstance.current = chart;

    fetch('/china.json')
      .then((res) => res.json())
      .then((chinaJson) => {
        echarts.registerMap('china', chinaJson);
        mapRegistered.current = true;
        setLoading(false);
        updateChart(chart);
      })
      .catch((err) => {
        console.error('地图数据加载失败:', err);
        setLoading(false);
      });

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstance.current = null;
      mapRegistered.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chartInstance.current && mapRegistered.current) {
      updateChart(chartInstance.current);
    }
  }, [events, cities]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateChart = (chart: echarts.ECharts) => {
    const eventCount = getCityEventCount(events);

    const scatterData = cities.map((city) => {
      const count = eventCount[city.name] || 0;
      const cityEvents = events.filter((e) => e.city === city.name);
      return { name: city.name, value: [...city.coord, count], level: city.level, events: cityEvents };
    });

    const effectData = scatterData.filter((d) => (d.value[2] as number) > 0);

    const levelSizeMap: Record<string, number> = { tier1: 14, tier2: 10, tier3: 7 };

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15, 22, 40, 0.95)',
        borderColor: '#1e3a5f',
        borderWidth: 1,
        textStyle: { color: '#e0e6f0', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number[]; data?: { events?: AIEvent[] } };
          if (!p.value || p.value.length < 3) return p.name;
          const count = p.value[2];
          const cityEvents = p.data?.events || [];
          let html = `<div style="font-weight:600;color:#00e5ff;margin-bottom:6px">${p.name}</div>`;
          html += `<div style="color:#8899b0;margin-bottom:4px">AI活动: <span style="color:#00e5ff;font-weight:600">${count}</span> 场</div>`;
          cityEvents.forEach((evt: AIEvent) => {
            html += `<div style="margin-top:4px;padding-top:4px;border-top:1px solid rgba(30,58,95,0.5)">`;
            html += `<div style="color:#e0e6f0;font-size:12px">${evt.title}</div>`;
            html += `<div style="color:#556680;font-size:11px">📅 ${evt.date} · ${evt.venue}</div>`;
            html += `</div>`;
          });
          return html;
        },
      },
      geo: {
        map: 'china',
        roam: true,
        zoom: 1.2,
        center: [104.5, 36],
        label: { show: false },
        emphasis: {
          label: { show: true, color: '#00e5ff', fontSize: 12 },
          itemStyle: { areaColor: 'rgba(0, 229, 255, 0.08)', borderColor: '#00e5ff', borderWidth: 1 },
        },
        itemStyle: {
          areaColor: 'rgba(15, 22, 40, 0.6)',
          borderColor: '#1e3a5f',
          borderWidth: 0.8,
          shadowColor: 'rgba(0, 229, 255, 0.1)',
          shadowBlur: 10,
        },
      },
      series: [
        {
          name: 'AI活动城市',
          type: 'effectScatter',
          coordinateSystem: 'geo',
          data: effectData,
          symbolSize: (val: number[]) => Math.max(12, 8 + (val[2] || 0) * 6),
          showEffectOn: 'render',
          rippleEffect: { brushType: 'stroke', scale: 4, period: 3 },
          label: { show: true, formatter: '{b}', position: 'right', color: '#00e5ff', fontSize: 11, fontWeight: 500, textShadowColor: '#000', textShadowBlur: 4 },
          itemStyle: { color: '#00e5ff', shadowBlur: 15, shadowColor: 'rgba(0, 229, 255, 0.5)' },
          zlevel: 2,
        },
        {
          name: '城市',
          type: 'scatter',
          coordinateSystem: 'geo',
          data: scatterData,
          symbolSize: (val: number[], params: unknown) => {
            const d = (params as { data?: { level?: string } })?.data;
            const base = levelSizeMap[d?.level ?? 'tier2'] || 8;
            const count = val[2] || 0;
            return count > 0 ? base + count * 3 : base;
          },
          label: { show: true, formatter: '{b}', position: 'right', color: '#8899b0', fontSize: 10, textShadowColor: '#000', textShadowBlur: 3 },
          emphasis: {
            label: { show: true, color: '#00e5ff', fontSize: 13, fontWeight: 600 },
            itemStyle: { color: '#00e5ff', shadowBlur: 20, shadowColor: 'rgba(0, 229, 255, 0.6)' },
          },
          itemStyle: { color: '#2196f3', shadowBlur: 5, shadowColor: 'rgba(33, 150, 243, 0.3)' },
          zlevel: 1,
        },
      ],
    };

    chart.setOption(option, true);

    chart.off('click');
    chart.on('click', (params: unknown) => {
      const p = params as { name: string; data?: { events?: AIEvent[] } };
      if (p.data?.events) onCityClick(p.name);
    });
  };

  return (
    <div className="map-section">
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 5,
          color: '#00e5ff', fontSize: 14, letterSpacing: 2,
        }}>
          <span style={{ animation: 'pulse 1.5s infinite' }}>🗺️ 地图加载中...</span>
        </div>
      )}
      <div ref={chartRef} className="map-container" />
    </div>
  );
}
