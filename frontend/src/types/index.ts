export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'n1' | 'n2' | 'admin';
  isActive: boolean;
  createdAt?: string;
}

export interface Asset {
  id: string;
  hostname: string;
  ipAddress: string;
  ip_address?: string;
  osType: 'linux' | 'windows' | 'network';
  os_type?: string;
  osVersion: string;
  os_version?: string;
  environment: string;
  site: string;
  client: string;
  services: string[];
  zabbixHostId?: string;
  isActive: boolean;
  is_active?: boolean;
  createdAt?: string;
  openAlerts?: number;
  open_alerts?: number;
  openTickets?: number;
  open_tickets?: number;
}

export interface Alert {
  id: string;
  zabbixEventId?: string;
  zabbix_event_id?: string;
  assetId?: string;
  asset_id?: string;
  asset?: Asset;
  hostname?: string;
  triggerName?: string;
  trigger_name?: string;
  severity: 'info' | 'warning' | 'average' | 'high' | 'disaster';
  status: 'open' | 'acknowledged' | 'resolved';
  message: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  ticketId?: string;
  ticket_id?: string;
  createdAt?: string;
  created_at?: string;
}

export interface Ticket {
  id: string;
  glpiTicketId?: number;
  glpi_ticket_id?: number;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  assetId?: string;
  asset_id?: string;
  asset?: Asset;
  assetHostname?: string;
  asset_hostname?: string;
  alertId?: string;
  alert_id?: string;
  assignedTo?: string;
  assigned_to?: string;
  assignedUser?: User;
  assignedUserName?: string;
  assigned_user_name?: string;
  createdBy?: string;
  created_by?: string;
  createdByUser?: User;
  createdByName?: string;
  created_by_name?: string;
  resolvedAt?: string;
  resolved_at?: string;
  createdAt?: string;
  created_at?: string;
  comments?: TicketComment[];
}

export interface TicketComment {
  id: string;
  ticketId: string;
  ticket_id?: string;
  userId: string;
  user_id?: string;
  user?: User;
  userName?: string;
  user_name?: string;
  username?: string;
  role?: string;
  content: string;
  isInternal: boolean;
  is_internal?: boolean;
  createdAt?: string;
  created_at?: string;
}

export interface LogEntry {
  id: string;
  assetId?: string;
  asset_id?: string;
  asset?: Asset;
  hostname?: string;
  ipAddress?: string;
  ip_address?: string;
  source: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  rawLog?: string;
  raw_log?: string;
  pattern?: string;
  occurredAt?: string;
  occurred_at?: string;
  createdAt?: string;
  created_at?: string;
}

export interface NetworkDiagnostic {
  id: string;
  executedBy?: string;
  executed_by?: string;
  executedByName?: string;
  executed_by_name?: string;
  asset?: Asset;
  assetHostname?: string;
  asset_hostname?: string;
  type: 'ping' | 'dns' | 'port' | 'traceroute';
  target: string;
  result: string;
  status: 'success' | 'failed' | 'timeout';
  executedAt?: string;
  executed_at?: string;
}

export interface DashboardMetrics {
  totalAlerts: number;
  openAlerts: number;
  criticalAlerts: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedToday: number;
  avgResolutionTime: number;
  topIncidentHosts: Array<{ hostname: string; count: number }>;
  alertsBySeverity: Array<{ severity: string; count: string | number }>;
  ticketsByStatus: Array<{ status: string; count: string | number }>;
  recentAlerts: Alert[];
  recentTickets: Ticket[];
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthPayload {
  user: User;
  token: string;
}
