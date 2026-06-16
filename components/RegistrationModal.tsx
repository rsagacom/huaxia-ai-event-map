'use client';
// 华夏AI线下活动地图 — 提交活动弹窗
import { useState } from 'react';
import type { CityNode } from '@/lib/types';

export interface EventFormData {
  title: string;
  date: string;
  city: string;
  venue: string;
  registration: string;
  benefits: string;
  requirements: string;
  contact: string;
}

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: EventFormData) => void;
  cities: CityNode[];
}

export default function RegistrationModal({ isOpen, onClose, onSubmit, cities }: RegistrationModalProps) {
  const [form, setForm] = useState<EventFormData>({
    title: '', date: '', city: '', venue: '',
    registration: '', benefits: '', requirements: '', contact: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof EventFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date || !form.city || !form.venue) {
      alert('请填写必填字段（活动主题、时间、城市、场馆）');
      return;
    }
    setSubmitting(true);
    onSubmit(form);
    setSubmitting(false);
    setForm({ title: '', date: '', city: '', venue: '', registration: '', benefits: '', requirements: '', contact: '' });
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
          <form className="registration-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">活动主题 <span className="required">*</span></label>
              <input className="form-input" type="text" placeholder="例如：2026全球人工智能技术大会" value={form.title} onChange={(e) => handleChange('title', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">活动时间 <span className="required">*</span></label>
              <input className="form-input" type="date" value={form.date} onChange={(e) => handleChange('date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">城市 <span className="required">*</span></label>
              <select className="form-select" value={form.city} onChange={(e) => handleChange('city', e.target.value)}>
                <option value="">选择城市</option>
                {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">场馆 <span className="required">*</span></label>
              <input className="form-input" type="text" placeholder="例如：国家会议中心" value={form.venue} onChange={(e) => handleChange('venue', e.target.value)} />
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
