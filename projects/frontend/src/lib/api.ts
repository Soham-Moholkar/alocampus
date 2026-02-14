import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, { hasToken: !!token });
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (res) => {
    console.log(`API Response: ${res.config.method?.toUpperCase()} ${res.config.url}`, res.status);
    return res;
  },
  (err) => {
    console.error('API Error:', err.response?.status, err.message, err.config?.url);
    if (err.response?.status === 401) {
      console.warn('401 Unauthorized - Logging out');
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ── Auth API ────────────────────────────────────────────

export const authApi = {
  getNonce: (address: string) =>
    api.post<{ nonce: string }>('/auth/nonce', { address }),

  verify: (address: string, nonce: string, signature: string) =>
    api.post<{ jwt: string }>('/auth/verify', { address, nonce, signature }),

  me: () => api.get<{ address: string; role: string }>('/auth/me'),
};

// ── Polls API ───────────────────────────────────────────

export interface Poll {
  poll_id: number;
  question: string;
  options: string[];
  start_round: number;
  end_round: number;
  creator: string;
  app_id: number;
  tx_id: string | null;
  created: number | null;
}

export interface PollListResponse {
  polls: Poll[];
  count: number;
}

export interface CreatePollPayload {
  question: string;
  options: string[];
  start_round: number;
  end_round: number;
}

export const pollsApi = {
  list: () => api.get<PollListResponse>('/polls'),
  get: (id: number) => api.get<Poll>(`/polls/${id}`),
  create: (data: CreatePollPayload) => api.post<Poll>('/faculty/polls', data),
};

// ── Attendance API ──────────────────────────────────────

export interface Session {
  session_id: number;
  course_code: string;
  session_ts: number;
  open_round: number;
  close_round: number;
  creator: string;
  app_id: number;
  tx_id: string | null;
  created: number | null;
}

export interface SessionListResponse {
  sessions: Session[];
  count: number;
}

export interface CreateSessionPayload {
  course_code: string;
  session_ts: number;
  open_round: number;
  close_round: number;
}

export const sessionsApi = {
  list: () => api.get<SessionListResponse>('/attendance/sessions'),
  get: (id: number) => api.get<Session>(`/attendance/sessions/${id}`),
  create: (data: CreateSessionPayload) =>
    api.post<Session>('/faculty/sessions', data),
};

// ── Certificates API ────────────────────────────────────

export interface CertListItem {
  cert_hash: string;
  recipient: string;
  asset_id: number | null;
  created: number | null;
}

export interface CertListResponse {
  certs: CertListItem[];
  count: number;
}

export interface IssueCertPayload {
  recipient_address: string;
  recipient_name: string;
  course_code: string;
  title: string;
  description?: string;
}

export interface IssueCertResponse {
  cert_hash: string;
  asset_id: number;
  metadata_url: string;
  tx_id: string;
}

export interface CertVerifyResponse {
  valid: boolean;
  cert_hash: string;
  recipient: string | null;
  asset_id: number | null;
  issued_ts: number | null;
  metadata_url: string | null;
  message: string;
}

export const certsApi = {
  list: () => api.get<CertListResponse>('/certs'),
  verify: (certHash: string) =>
    api.get<CertVerifyResponse>('/certs/verify', { params: { cert_hash: certHash } }),
  issue: (data: IssueCertPayload) =>
    api.post<IssueCertResponse>('/faculty/cert/issue', data),
};

// ── Admin API ───────────────────────────────────────────

export interface SetRolePayload {
  address: string;
  role: 'admin' | 'faculty' | 'student';
}

export const adminApi = {
  setRole: (data: SetRolePayload) =>
    api.post<{ ok: boolean; message: string }>('/admin/role', data),
};

// ── Analytics API ───────────────────────────────────────

export interface AnalyticsSummary {
  total_polls: number;
  total_votes: number;
  total_sessions: number;
  total_checkins: number;
  total_certs: number;
}

export const analyticsApi = {
  summary: () => api.get<AnalyticsSummary>('/analytics/summary'),
};

// ── Transaction Tracking API ────────────────────────────

export interface TxStatus {
  tx_id: string;
  kind: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmed_round: number | null;
}

export const txApi = {
  track: (txId: string, kind: string) =>
    api.post<TxStatus>('/tx/track', { tx_id: txId, kind }),
  status: (txId: string) => api.get<TxStatus>(`/tx/track/${txId}`),
};

// ── Health API ──────────────────────────────────────────

export const healthApi = {
  simple: () => api.get<{ status: string }>('/health'),
  detailed: () => api.get<{ status: string; checks: Record<string, { status: string }> }>('/health/detailed'),
};
