'use client';
// 华夏AI线下活动地图 — 人工审核后台
import { useState, useCallback } from 'react';
import useSWR from 'swr';
import type { AIEvent } from '@/lib/types';

type Tab = 'review' | 'published';

// ISO 时间 → 可读
function fmtTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [token, setToken] = useState('');   // SHA256 哈希，存本地做后续请求凭证
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('review');

  // 检查密码是否已设置
  const { data: statusData } = useSWR('/api/admin/auth', (url: string) =>
    fetch(url).then((r) => r.json()),
  );
  const passwordSet = statusData?.passwordSet ?? null; // null = 加载中

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 首次设置密码
  const handleSetup = async () => {
    setError('');
    if (!password || password.length < 4) { setError('密码至少4位'); return; }
    if (password !== confirmPwd) { setError('两次输入不一致'); return; }
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup', password }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setLoggedIn(true);
      } else {
        setError(data.error || '设置失败');
      }
    } catch { setError('网络错误'); }
  };

  // 登录
  const handleLogin = async () => {
    setError('');
    if (!password) { setError('请输入密码'); return; }
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password }),
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setLoggedIn(true);
      } else {
        setError(data.error || '登录失败');
      }
    } catch { setError('网络错误'); }
  };

  const fetcher = (url: string) =>
    fetch(url, { headers: authHeaders }).then((r) => {
      if (r.status === 401) { setLoggedIn(false); setToken(''); throw new Error('认证失败'); }
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    });

  // SWR: 待审核列表（pending + rejected）
  const { data, mutate } = useSWR(loggedIn ? '/api/admin/events' : null, fetcher, { refreshInterval: 10000 });
  // SWR: 已发布列表（approved，按 createdAt desc）
  const { data: pubData, mutate: mutatePub } = useSWR(loggedIn ? '/api/admin/events?status=approved' : null, fetcher, { refreshInterval: 15000 });
  // SWR: 配置
  const { data: config } = useSWR(loggedIn ? '/api/admin/review-config' : null, fetcher);

  const reviewEvents: AIEvent[] = data?.events ?? [];
  const publishedEvents: AIEvent[] = pubData?.events ?? [];

  const flash = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleAction = useCallback(async (id: string, action: 'approve' | 'reject') => {
    const res = await fetch(`/api/admin/events/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: action === 'reject' ? JSON.stringify({ reason: '人工审核拒绝' }) : undefined,
    });
    if (res.status === 401) { setLoggedIn(false); setToken(''); return; }
    if (res.ok) {
      mutate();
      mutatePub();
      flash(`✅ 已${action === 'approve' ? '通过' : '拒绝'}`);
    } else { alert('操作失败'); }
  }, [token, mutate, mutatePub, flash]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('确认删除这条活动？此操作不可恢复。')) return;
    const res = await fetch(`/api/admin/events/${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.status === 401) { setLoggedIn(false); setToken(''); return; }
    if (res.ok) {
      mutate();
      mutatePub();
      flash('🗑️ 已删除');
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || '删除失败');
    }
  }, [token, mutate, mutatePub, flash]);

  // 加载中
  if (passwordSet === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a', color: '#00e5ff' }}>
        加载中...
      </div>
    );
  }

  // 未登录：显示设置密码 或 登录
  if (!loggedIn) {
    const isSetup = !passwordSet; // 首次：设置密码；否则：登录
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e1a' }}>
        <div style={{ background: '#111827', border: '1px solid #1e3a5f', borderRadius: 12, padding: 32, width: 380, textAlign: 'center' }}>
          <h2 style={{ color: '#00e5ff', marginBottom: 8, fontSize: 18 }}>🔐 审核后台</h2>
          <p style={{ color: '#8899b0', fontSize: 13, marginBottom: 20 }}>
            {isSetup ? '首次使用，请设置管理密码' : '请输入管理密码登录'}
          </p>

          <input type="password" placeholder={isSetup ? '设置密码（至少4位）' : '输入密码'}
            value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && (isSetup ? handleSetup() : handleLogin())}
            style={{ background: '#0f1628', border: '1px solid #1e3a5f', color: '#e0e6f0', padding: '10px 14px', borderRadius: 6, width: '100%', fontSize: 14, outline: 'none', marginBottom: 8 }} />

          {isSetup && (
            <input type="password" placeholder="确认密码"
              value={confirmPwd} onChange={(e) => { setConfirmPwd(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
              style={{ background: '#0f1628', border: '1px solid #1e3a5f', color: '#e0e6f0', padding: '10px 14px', borderRadius: 6, width: '100%', fontSize: 14, outline: 'none', marginBottom: 8 }} />
          )}

          {error && <div style={{ color: '#ff5252', fontSize: 12, marginBottom: 12 }}>{error}</div>}

          <button onClick={isSetup ? handleSetup : handleLogin}
            style={{ background: 'linear-gradient(135deg, #00e5ff, #2196f3)', color: '#000', border: 'none', padding: '10px 24px', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' }}>
            {isSetup ? '🔑 设置密码' : '🚪 登录'}
          </button>
        </div>
      </div>
    );
  }

  // 已登录：后台
  return (
    <div style={{ background: '#0a0e1a', minHeight: '100vh', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ color: '#00e5ff', fontSize: 20 }}>📋 审核后台</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {config && (
            <span style={{ color: '#8899b0', fontSize: 12 }}>
              AI审核: {config.enabled ? '✅ 开启' : '❌ 关闭'} · Provider: {config.provider}
            </span>
          )}
          <button onClick={() => { setLoggedIn(false); setToken(''); setPassword(''); }}
            style={{ background: '#111827', border: '1px solid #1e3a5f', color: '#8899b0', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
            退出
          </button>
        </div>
      </div>

      {message && <div style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid #00e676', color: '#00e676', padding: '10px 20px', borderRadius: 6, marginBottom: 16, textAlign: 'center' }}>{message}</div>}

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['review', 'published'] as Tab[]).map((t) => {
          const active = tab === t;
          const count = t === 'review' ? reviewEvents.length : publishedEvents.length;
          return (
            <button key={t} onClick={() => setTab(t)}
              style={{
                background: active ? 'rgba(0,229,255,0.12)' : '#111827',
                border: `1px solid ${active ? '#00e5ff' : '#1e3a5f'}`,
                color: active ? '#00e5ff' : '#8899b0',
                padding: '8px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
              {t === 'review' ? '📋 待审核' : '📢 已发布管理'}{count > 0 && ` (${count})`}
            </button>
          );
        })}
      </div>

      {/* 待审核 */}
      {tab === 'review' && (
        reviewEvents.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#556680', padding: '60px 0', fontSize: 14 }}>
            🎉 暂无待审核活动
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reviewEvents.map((evt) => (
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
                    <button onClick={() => handleDelete(evt.id)} title="彻底删除" style={{ background: 'rgba(120,120,130,0.12)', border: '1px solid #3a3f4d', color: '#8899b0', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 已发布管理：按发布时间由新到旧 */}
      {tab === 'published' && (
        publishedEvents.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#556680', padding: '60px 0', fontSize: 14 }}>
            📭 暂无已发布活动
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {publishedEvents.map((evt) => (
              <div key={evt.id} style={{ background: '#111827', border: '1px solid #1e3a5f', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ color: '#e0e6f0', fontWeight: 600, fontSize: 14 }}>{evt.title}</span>
                      <span style={{ background: 'rgba(0,230,118,0.15)', color: '#00e676', padding: '2px 8px', borderRadius: 3, fontSize: 11 }}>✅ 已发布</span>
                    </div>
                    <div style={{ color: '#8899b0', fontSize: 12, marginBottom: 4 }}>📅 {evt.date} · 📍 {evt.city} · {evt.venue}</div>
                    {evt.contact && <div style={{ color: '#00e5ff', fontSize: 11, marginTop: 4, wordBreak: 'break-all' }}>🔗 {evt.contact}</div>}
                    <div style={{ color: '#556680', fontSize: 11, marginTop: 4 }}>发布时间: {fmtTime(evt.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
                    <button onClick={() => handleAction(evt.id, 'reject')} title="撤下（改回已拒绝）" style={{ background: 'rgba(255,152,0,0.15)', border: '1px solid #ff9800', color: '#ff9800', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                      ⏸️ 撤下
                    </button>
                    <button onClick={() => handleDelete(evt.id)} title="彻底删除" style={{ background: 'rgba(255,82,82,0.15)', border: '1px solid #ff5252', color: '#ff5252', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                      🗑️ 删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
