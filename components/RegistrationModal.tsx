'use client';
// 华夏AI线下活动地图 — 提交活动弹窗（手填 + AI 智能识别填表）
import { useState } from 'react';
import type { CityNode } from '@/lib/types';
import type { EventFormData } from '@/lib/types';
import { matchCity } from '@/lib/helpers';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: EventFormData) => Promise<{ status: string; reason?: string }>;
  cities: CityNode[];
}

const EMPTY_FORM: EventFormData = {
  title: '', date: '', city: '', venue: '',
  registration: '', benefits: '', requirements: '', contact: '',
};

type ExtractTab = 'image' | 'text';

// 用 canvas 压缩图片并转 base64 data URL，控制体积便于上传
function compressImage(file: File, maxEdge = 1568, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('加载图片失败'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxEdge || height > maxEdge) {
          const scale = maxEdge / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas 不可用'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function RegistrationModal({ isOpen, onClose, onSubmit, cities }: RegistrationModalProps) {
  const [form, setForm] = useState<EventFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // 智能识别相关状态
  const [extractTab, setExtractTab] = useState<ExtractTab>('image');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);
  // 自动审核结果：rejected 时保留弹窗并展示原因，供用户修改后重提
  const [reviewResult, setReviewResult] = useState<{ status: string; reason: string } | null>(null);

  const handleChange = (field: keyof EventFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setImageDataUrl(dataUrl);
      setExtractStatus(null);
    } catch {
      setExtractStatus({ text: '图片处理失败，请换一张', kind: 'error' });
    }
  };

  const handleExtract = async () => {
    setExtracting(true);
    setExtractStatus({ text: '正在识别…', kind: 'ok' });
    try {
      const payload: { image?: string; text?: string } = {};
      if (extractTab === 'image') {
        if (!imageDataUrl) {
          setExtractStatus({ text: '请先上传活动海报图片', kind: 'error' });
          setExtracting(false);
          return;
        }
        payload.image = imageDataUrl;
      } else {
        if (!pasteText.trim()) {
          setExtractStatus({ text: '请先粘贴活动介绍文本', kind: 'error' });
          setExtracting(false);
          return;
        }
        payload.text = pasteText.trim();
      }

      const res = await fetch('/api/extract-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `识别失败 (${res.status})`);
      }

      const fields = data.fields as EventFormData;
      // 城市模糊匹配到 cities 列表的标准名
      let matchedCity = '';
      let cityHint = '';
      if (fields.city) {
        const m = matchCity(fields.city, cities);
        if (m) {
          matchedCity = m;
        } else {
          cityHint = `（识别城市「${fields.city}」不在列表，请手选）`;
        }
      }

      // AI 抽取的时间：若只识别到日期（无 T），补 T00:00 以便 datetime-local 正常回填，
      // 用户可继续手动调整具体时间。
      const rawDate = fields.date;
      const dateValue = rawDate && rawDate.length === 10 ? `${rawDate}T00:00` : rawDate;
      setForm({
        ...EMPTY_FORM,
        ...fields,
        city: matchedCity,
        date: dateValue,
      });
      setExtractStatus({
        text: `✓ 已识别填入表单，请核对后提交${cityHint}`,
        kind: 'ok',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setExtractStatus({ text: `识别失败：${msg}，可手动填写`, kind: 'error' });
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.city || !form.venue) {
      alert('请填写必填字段（活动主题、时间、城市、详细地址）');
      return;
    }
    setSubmitting(true);
    setReviewResult(null);
    try {
      const result = await onSubmit(form);
      if (result?.status === 'approved') {
        // 已通过：父组件会关闭弹窗，这里重置内部状态
        setForm(EMPTY_FORM);
        setImageDataUrl(null);
        setPasteText('');
        setExtractStatus(null);
      } else if (result?.status === 'rejected') {
        // 未通过自动审核：保留弹窗与已填内容，展示原因供用户修改后重提
        setReviewResult({ status: 'rejected', reason: result.reason || '未说明原因' });
      }
      // error：父组件已 alert，保持弹窗与内容不重置
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">📝 提交AI活动</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* 智能识别面板 — 识别结果自动填入下方表单，可继续手动编辑 */}
          <div className="extract-panel">
            <div className="extract-panel-title">🤖 智能识别填表（可选）</div>
            <div className="extract-tabs">
              <button
                type="button"
                className={`extract-tab${extractTab === 'image' ? ' active' : ''}`}
                onClick={() => { setExtractTab('image'); setExtractStatus(null); }}
              >
                📷 上传海报/截图
              </button>
              <button
                type="button"
                className={`extract-tab${extractTab === 'text' ? ' active' : ''}`}
                onClick={() => { setExtractTab('text'); setExtractStatus(null); }}
              >
                📋 粘贴文本
              </button>
            </div>

            {extractTab === 'image' ? (
              <>
                <label className="extract-file-label">
                  <input
                    type="file"
                    accept="image/*"
                    className="extract-file-input"
                    onChange={handleFileChange}
                  />
                  {imageDataUrl ? '✓ 已选择图片，点击可更换' : '点击上传活动海报/截图'}
                </label>
                {imageDataUrl && (
                  <div className="extract-preview">
                    <img src={imageDataUrl} alt="活动海报预览" />
                    <button
                      type="button"
                      className="extract-preview-clear"
                      onClick={() => setImageDataUrl(null)}
                    >✕</button>
                  </div>
                )}
              </>
            ) : (
              <textarea
                className="form-textarea"
                placeholder="粘贴活动介绍文本（含主题/时间/地点/报名方式等）…"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                style={{ minHeight: 90 }}
              />
            )}

            <div className="extract-hint">
              识别后字段自动填入下方表单，可继续手动修改。支持端侧多模态模型。
            </div>
            <div className="extract-actions">
              <button
                type="button"
                className="btn-extract"
                onClick={handleExtract}
                disabled={extracting}
              >
                {extracting ? '识别中…' : '🔍 智能识别'}
              </button>
              {extractStatus && (
                <span className={`extract-status ${extractStatus.kind}`}>{extractStatus.text}</span>
              )}
            </div>
          </div>

          <form className="registration-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">活动主题 <span className="required">*</span></label>
              <input className="form-input" type="text" placeholder="例如：2026全球人工智能技术大会" value={form.title} onChange={(e) => handleChange('title', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">活动时间（日期+具体时间）<span className="required">*</span></label>
              <input className="form-input" type="datetime-local" value={form.date} onChange={(e) => handleChange('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">城市 <span className="required">*</span></label>
              <select className="form-select" value={form.city} onChange={(e) => handleChange('city', e.target.value)}>
                <option value="">选择城市</option>
                {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">详细地址 <span className="required">*</span></label>
              <input className="form-input" type="text" placeholder="例如：北京市朝阳区望京 SOHO / 深圳市罗湖区" value={form.venue} onChange={(e) => handleChange('venue', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">报名方式</label>
              <input className="form-input" type="text" placeholder="例如：官网在线注册" value={form.registration} onChange={(e) => handleChange('registration', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">活动福利</label>
              <textarea className="form-textarea" placeholder="例如：参会证书、技术白皮书" value={form.benefits} onChange={(e) => handleChange('benefits', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">参加要求</label>
              <textarea className="form-textarea" placeholder="例如：AI相关领域从业者" value={form.requirements} onChange={(e) => handleChange('requirements', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">联系方式</label>
              <input className="form-input" type="text" placeholder="邮箱或电话" value={form.contact} onChange={(e) => handleChange('contact', e.target.value)} />
            </div>
            {reviewResult?.status === 'rejected' && (
              <div className="review-result review-rejected">
                <div className="review-result-title">⚠️ 未通过自动审核</div>
                <div className="review-result-reason">原因：{reviewResult.reason}</div>
                <div className="review-result-hint">已转入人工复核。可修改信息后重新提交，或等待人工审核结果。</div>
              </div>
            )}
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? '提交中...' : '🚀 提交活动'}
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>取消</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
