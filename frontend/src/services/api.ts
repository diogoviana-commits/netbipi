import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Auth interceptor: attach Bearer token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('netbipi_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 interceptor: redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('netbipi_token');
      localStorage.removeItem('netbipi_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// AUTH
// ============================================================
export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me'),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    api.put('/auth/change-password', data),
};

// ============================================================
// ALERTS
// ============================================================
export const alertsApi = {
  getAlerts: (params?: Record<string, unknown>) =>
    api.get('/alerts', { params }),
  getAlertById: (id: string) => api.get(`/alerts/${id}`),
  acknowledgeAlert: (id: string, message?: string) =>
    api.put(`/alerts/${id}/acknowledge`, { message }),
  resolveAlert: (id: string) => api.put(`/alerts/${id}/resolve`),
  syncFromZabbix: () => api.post('/alerts/sync'),
  getAlertStats: () => api.get('/alerts/stats'),
};

// ============================================================
// TICKETS
// ============================================================
export const ticketsApi = {
  getTickets: (params?: Record<string, unknown>) =>
    api.get('/tickets', { params }),
  getTicketById: (id: string) => api.get(`/tickets/${id}`),
  createTicket: (data: Record<string, unknown>) =>
    api.post('/tickets', data),
  updateTicket: (id: string, data: Record<string, unknown>) =>
    api.put(`/tickets/${id}`, data),
  addComment: (id: string, content: string, isInternal = false) =>
    api.post(`/tickets/${id}/comments`, { content, isInternal }),
  createFromAlert: (alertId: string) =>
    api.post(`/tickets/from-alert/${alertId}`),
  getTicketStats: () => api.get('/tickets/stats'),
};

// ============================================================
// ASSETS
// ============================================================
export const assetsApi = {
  getAssets: (params?: Record<string, unknown>) =>
    api.get('/assets', { params }),
  getAssetById: (id: string) => api.get(`/assets/${id}`),
  createAsset: (data: Record<string, unknown>) =>
    api.post('/assets', data),
  updateAsset: (id: string, data: Record<string, unknown>) =>
    api.put(`/assets/${id}`, data),
  deleteAsset: (id: string) => api.delete(`/assets/${id}`),
  getAssetStats: () => api.get('/assets/stats'),
};

// ============================================================
// LOGS
// ============================================================
export const logsApi = {
  getLogs: (params?: Record<string, unknown>) =>
    api.get('/logs', { params }),
  createLog: (data: Record<string, unknown>) =>
    api.post('/logs', data),
  getLogStats: (params?: Record<string, unknown>) =>
    api.get('/logs/stats', { params }),
};

// ============================================================
// NETWORK
// ============================================================
export const networkApi = {
  runPing: (target: string, count?: number) =>
    api.post('/network/ping', { target, count }),
  runDnsLookup: (target: string) =>
    api.post('/network/dns', { target }),
  runPortCheck: (target: string, port: number) =>
    api.post('/network/port', { target, port }),
  runTraceroute: (target: string) =>
    api.post('/network/traceroute', { target }),
  getDiagnosticHistory: (limit?: number) =>
    api.get('/network/history', { params: { limit } }),
};

// ============================================================
// DASHBOARD
// ============================================================
export const dashboardApi = {
  getMetrics: () => api.get('/dashboard'),
};

// ============================================================
// KNOWLEDGE BASE
// ============================================================
export const knowledgeApi = {
  getArticles: (params?: Record<string, string>) => api.get('/knowledge', { params }),
  getArticleById: (id: string) => api.get(`/knowledge/${id}`),
  createArticle: (data: unknown) => api.post('/knowledge', data),
  updateArticle: (id: string, data: unknown) => api.put(`/knowledge/${id}`, data),
  deleteArticle: (id: string) => api.delete(`/knowledge/${id}`),
  getCategories: () => api.get('/knowledge/categories'),
  search: (q: string) => api.get('/knowledge/search', { params: { q } }),
};

// ============================================================
// REPORTS
// ============================================================
export const reportApi = {
  getIncidentReport: (params: Record<string, string>) => api.get('/reports/incidents', { params }),
  downloadPDF: (params: Record<string, string>) => api.get('/reports/pdf', { params, responseType: 'blob' }),
  downloadExcel: (params: Record<string, string>) => api.get('/reports/excel', { params, responseType: 'blob' }),
  getSLAReport: (params: Record<string, string>) => api.get('/reports/sla', { params }),
};

// ============================================================
// CLOUD
// ============================================================
export const cloudApi = {
  getStatus: () => api.get('/cloud/status'),
  getMetrics: (params?: Record<string, string>) => api.get('/cloud/metrics', { params }),
  getAlerts: () => api.get('/cloud/alerts'),
};

// ============================================================
// SHIFT
// ============================================================
export const shiftApi = {
  getSummary: (shift?: string) => api.get('/shift/summary', { params: { shift } }),
  getHandoffReport: (shift?: string) => api.get('/shift/handoff', { params: { shift } }),
};

// ============================================================
// ESCALATION
// ============================================================
export const escalationApi = {
  getEscalations: (params?: Record<string, string>) => api.get('/escalation', { params }),
  getRules: () => api.get('/escalation/rules'),
  updateRules: (data: unknown) => api.put('/escalation/rules', data),
};

// ============================================================
// NOTIFICATIONS
// ============================================================
export const notificationApi = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
};

// ============================================================
// TIMELINE
// ============================================================
export const timelineApi = {
  getTimeline: (params: { alertId?: string; ticketId?: string }) =>
    api.get('/timeline', { params }),
};

export default api;
