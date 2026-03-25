export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'n1' | 'n2' | 'admin';
  isActive: boolean;
  createdAt: Date;
}

export interface Asset {
  id: string;
  hostname: string;
  ipAddress: string;
  osType: 'linux' | 'windows' | 'network';
  osVersion: string;
  environment: string;
  site: string;
  client: string;
  services: string[];
  zabbixHostId?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Alert {
  id: string;
  zabbixEventId?: string;
  assetId: string;
  asset?: Asset;
  triggerName: string;
  severity: 'info' | 'warning' | 'average' | 'high' | 'disaster';
  status: 'open' | 'acknowledged' | 'resolved';
  message: string;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  ticketId?: string;
  createdAt: Date;
}

export interface Ticket {
  id: string;
  glpiTicketId?: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  assetId?: string;
  asset?: Asset;
  alertId?: string;
  assignedTo?: string;
  assignedUser?: User;
  createdBy: string;
  createdByUser?: User;
  resolvedAt?: Date;
  createdAt: Date;
  comments?: TicketComment[];
}

export interface TicketComment {
  id: string;
  ticketId: string;
  userId: string;
  user?: User;
  content: string;
  isInternal: boolean;
  createdAt: Date;
}

export interface LogEntry {
  id: string;
  assetId?: string;
  asset?: Asset;
  source: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  rawLog?: string;
  occurredAt: Date;
  createdAt: Date;
}

export interface NetworkDiagnostic {
  id: string;
  executedBy: string;
  asset?: Asset;
  type: 'ping' | 'dns' | 'port' | 'traceroute';
  target: string;
  result: string;
  status: 'success' | 'failed' | 'timeout';
  executedAt: Date;
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
  alertsBySeverity: Array<{ severity: string; count: number }>;
  ticketsByStatus: Array<{ status: string; count: number }>;
  recentAlerts: Alert[];
  recentTickets: Ticket[];
}

export interface AuthPayload {
  user: User;
  token: string;
}

export interface JWTPayload {
  userId: string;
  role: string;
}
