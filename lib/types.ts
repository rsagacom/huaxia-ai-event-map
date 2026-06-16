// 华夏AI线下活动地图 — 共享类型

export interface AIEvent {
  id: string;
  title: string;
  date: string;
  city: string;
  venue: string;
  registration: string;
  benefits: string;
  requirements: string;
  contact: string;
  status: string;
  reviewReason?: string | null;
  reviewedBy?: string | null;
}

export interface CityNode {
  name: string;
  coord: [number, number];
  level: 'tier1' | 'tier2' | 'tier3';
}

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
