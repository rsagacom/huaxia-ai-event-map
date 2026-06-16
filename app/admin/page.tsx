'use client';
// 华夏AI线下活动地图 — 人工审核后台
import { useState, useCallback } from 'react';
import useSWR from 'swr';
import type { AIEvent } from '@/lib/types';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const authHeaders = { Authorization: `Bearer ${password}` };

  // 先验证密码，成功后才 setLoggedIn
  const handleLogin = async () => {
    if (!password) { setLoginError('请输入密码'); return; }
    setLoginError('');
    try {
      const res = await fetch('/api/admin/review-config', { headers: authHeaders });
      if (res.ok) {
        setLoggedIn(true);
      } else {
        setLoginError('密码错误');
      }
    } catch {
      setLoginError('网络错误');
    }
  };

  // SWR：只在登录后才请求
  const { data, mutate } = useSWR(
    loggedIn ? '/api/admin/events' : null,
    (url: string) => fetch(url, { headers: authHeaders }).then((r) => {
      if (r.status === 401) { setLoggedIn(false); throw new Error('认证失败'); }
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    }),
    { refreshInterval: 10000, onError: () => setLoggedIn(false) },
  );

  const { data: config } = useSWR(
    loggedIn ? '/api/admin/review-config' : null,
    (url: string) => fetch(url, { headers: authHeaders }).then((r) => {
      if (r.status === 401) { setLoggedIn(false); throw new Error('认证失败'); }
      return r.json();
    }),
  );

  const events: AIEvent[] = data?.events ?? [];

  const handleAction = useCallback(async (id: string, action: 'approve' | 'reject') => {
    const res = await fetch(`/api/admin/events/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: action === 'reject' ? JSON.stringify({ reason: '人工审核拒绝' }) : undefined,
    });
    if (res.status === 401) { setLoggedIn(false); return; }
    if (res.ok) {
      mutate();
      setMessage(`✅ 已${action === 'approve' ? '通过' : '拒绝'}`);
      setTimeout(() => setMessage(null), 3000);
    } else {
      alert('操作失败');
    }
  }, [password, mutate]);

  if (!loggedIn) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a' }}>
        <div style={{ background: '#111827', border: '1px solid #1e3a5f', borderRadius: 12, padding: 32, width: 360, textAlign: 'center' }}>
          <h2 style={{ color: '#00e5ff', marginBottom: 20, fontSize: 18 }}>🔐 审核后台</h2>
          <input type="password" placeholder="输入管理密码" value={password}
            onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{ background: '#0f1628', border: '1px solid #1e3a5f', color: '#e0e6f0', padding: '10px 14px', borderRadius: 6, width: '100%', fontSize: 14, outline: 'none', marginBottom: 8 }} />
          {loginError && <div style={{ color: '#ff5252', fontSize: 12, marginBottom: 12 }}>{loginError}</div>}
          <button onClick={handleLogin} style={{ background: 'linear-gradient(135deg, #00e5ff, #2196f3)', color: '#000', border: 'none', padding: '10px 24px', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
            登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#0a0e1a', minHeight: '100vh', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: '#00e5ff', fontSize: 20 }}>📋 审核后台</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {config && (
            <span style={{ color: '#8899b0', fontSize: 12 }}>
              AI审核: {config.enabled ? '✅ 开启' : '❌ 关闭'} · Provider: {config.provider}
            </span>
          )}
          <button onClick={() => setLoggedIn(false)} style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#8899b0', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
            退出
          </button>
        </div>
      </div>

      {message && <div style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid #00e676', color: '#00e676', padding: '10px 20px', borderRadius: 6, marginBottom: 16, textAlign: 'center' }}>{message}</div>}

      {events.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#556680', padding: '60px 0', fontSize: 14 }}>
          🎉 暂无待审核活动
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.map((evt) => (
            <div key={evt.id} style={{ background: '#111827', border: `1px solid ${evt.status === 'rejected' ? '#ff5252' : '#ff6d00'}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ color: '#e0e6f0', fontWeight: 600, fontSize: 14 }}>{evt.title}</span>
                    <span style={{ background: evt.status === 'pending' ? 'rgba(255,109,0,0.15)' : 'rgba(255,82,82,0.15)', color: evt.status === 'pending' ? '#ff6d00' : '#ff5252', padding: '2px 8px', borderRadius: 3, fontSize: 11 }}>
                      {evt.status === 'pending' ? '⏳ 待审核' : '❌ 已拒绝'}
                    </span>
                  </div>
                  <div style={{ color: '#8899b0', fontSize: 12, marginBottom: 4 }}>📅 {evt.date} · 📍 {evt.city} · {evt.venue}</div>
                  {evt.reviewReason && <div style={{ color: '#556680', fontSize: 11, marginTop: 4 }}>审核理由: {evt.reviewReason}</div>}
                  {evt.reviewedBy && <div style={{ color: '#556680', fontSize: 11 }}>审核方式: {evt.reviewedBy}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                  <button onClick={() => handleAction(evt.id, 'approve')} style={{ background: 'rgba(0,230,118,0.15)', border: '1px solid #00e676', color: '#00e676', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                    ✅ 通过
                  </button>
                  <button onClick={() => handleAction(evt.id, 'reject')} style={{ background: 'rgba(255,82,82,0.15)', border: '1px solid #ff5252', color: '#ff5252', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                    ❌ 拒绝
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
