import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, Ticket, CheckCircle, Clock, Activity, Server,
  RefreshCw, TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { dashboardApi } from '../services/api';
import { DashboardMetrics, Alert, Ticket as TicketType } from '../types';
import Card from '../components/ui/Card';
import Badge, { severityVariant, severityLabel, statusVariant, statusLabel, priorityVariant, priorityLabel } from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const SEVERITY_COLORS: Record<string, string> = {
  disaster: '#dc2626',
  high: '#ea580c',
  average: '#ca8a04',
  warning: '#2563eb',
  info: '#6b7280',
};

const STATUS_COLORS: Record<string, string> = {
  open: '#dc2626',
  in_progress: '#ca8a04',
  resolved: '#16a34a',
  closed: '#6b7280',
};

const formatTime = (dateStr?: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, subtitle }) => (
  <div className={`bg-gray-800 border border-gray-700 rounded-xl p-5 flex items-start gap-4`}>
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">{title}</p>
      <p className="text-white text-2xl font-bold mt-0.5">{value}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const MOCK_METRICS: DashboardMetrics = {
  totalAlerts: 15,
  openAlerts: 9,
  criticalAlerts: 4,
  openTickets: 5,
  inProgressTickets: 3,
  resolvedToday: 2,
  avgResolutionTime: 127,
  topIncidentHosts: [
    { hostname: 'web-server-01', count: 3 },
    { hostname: 'db-server-01', count: 3 },
    { hostname: 'vpn-gateway-01', count: 2 },
    { hostname: 'dc-01', count: 2 },
    { hostname: 'switch-core-01', count: 1 },
  ],
  alertsBySeverity: [
    { severity: 'disaster', count: 3 },
    { severity: 'high', count: 4 },
    { severity: 'average', count: 4 },
    { severity: 'warning', count: 2 },
    { severity: 'info', count: 2 },
  ],
  ticketsByStatus: [
    { status: 'open', count: 5 },
    { status: 'in_progress', count: 3 },
    { status: 'resolved', count: 2 },
  ],
  recentAlerts: [],
  recentTickets: [],
};

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await dashboardApi.getMetrics();
      setMetrics(res.data);
      setLastUpdated(new Date());
    } catch {
      setMetrics(MOCK_METRICS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const m = metrics || MOCK_METRICS;

  const severityChartData = m.alertsBySeverity.map(item => ({
    name: severityLabel(item.severity),
    value: Number(item.count),
    fill: SEVERITY_COLORS[item.severity] || '#6b7280',
  }));

  const statusPieData = m.ticketsByStatus.map(item => ({
    name: statusLabel(item.status),
    value: Number(item.count),
    fill: STATUS_COLORS[item.status] || '#6b7280',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Dashboard Operacional</h2>
          <p className="text-gray-500 text-sm">Visão geral do ambiente em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-gray-500 text-xs">
            Atualizado: {lastUpdated.toLocaleTimeString('pt-BR')}
          </p>
          <button
            onClick={fetchMetrics}
            className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Alertas Críticos"
          value={m.criticalAlerts}
          icon={<AlertTriangle size={18} className="text-white" />}
          color="bg-red-600"
          subtitle="disaster + high"
        />
        <StatCard
          title="Chamados Abertos"
          value={m.openTickets}
          icon={<Ticket size={18} className="text-white" />}
          color="bg-orange-600"
          subtitle="aguardando ação"
        />
        <StatCard
          title="Em Andamento"
          value={m.inProgressTickets}
          icon={<Activity size={18} className="text-white" />}
          color="bg-yellow-600"
          subtitle="em progresso"
        />
        <StatCard
          title="Resolvidos Hoje"
          value={m.resolvedToday}
          icon={<CheckCircle size={18} className="text-white" />}
          color="bg-emerald-600"
          subtitle="neste dia"
        />
        <StatCard
          title="MTTR"
          value={`${m.avgResolutionTime}min`}
          icon={<Clock size={18} className="text-white" />}
          color="bg-blue-600"
          subtitle="tempo médio"
        />
        <StatCard
          title="Hosts c/ Incidentes"
          value={m.topIncidentHosts.length}
          icon={<Server size={18} className="text-white" />}
          color="bg-purple-600"
          subtitle="com alertas abertos"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Alertas por Severidade">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={severityChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {severityChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Status dos Chamados">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusPieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {statusPieData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb' }}
              />
              <Legend
                formatter={(value) => <span style={{ color: '#9ca3af', fontSize: '12px' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <Card title="Alertas Recentes" action={
          <TrendingUp size={14} className="text-gray-500" />
        } padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">Sev.</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-3 py-3">Host</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-3 py-3">Trigger</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {(m.recentAlerts as Alert[]).slice(0, 5).map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-3">
                      <Badge variant={severityVariant(alert.severity)} size="sm">
                        {severityLabel(alert.severity)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-gray-300 font-mono text-xs">
                      {alert.hostname || alert.asset?.hostname || '-'}
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs max-w-[160px] truncate">
                      {alert.trigger_name || alert.triggerName}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={statusVariant(alert.status)} size="sm">
                        {statusLabel(alert.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {m.recentAlerts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-500 text-sm">
                      Nenhum alerta recente
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Tickets */}
        <Card title="Chamados Recentes" padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">Título</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-3 py-3">Prior.</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-3 py-3">Status</th>
                  <th className="text-left text-gray-500 text-xs font-medium px-3 py-3">Resp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {(m.recentTickets as TicketType[]).slice(0, 5).map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-3 text-gray-300 text-xs max-w-[160px] truncate">
                      {ticket.title}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={priorityVariant(ticket.priority)} size="sm">
                        {priorityLabel(ticket.priority)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={statusVariant(ticket.status)} size="sm">
                        {statusLabel(ticket.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">
                      {ticket.assigned_user_name || ticket.assignedUser?.fullName || 'N/A'}
                    </td>
                  </tr>
                ))}
                {m.recentTickets.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-500 text-sm">
                      Nenhum chamado recente
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Top incident hosts */}
      {m.topIncidentHosts.length > 0 && (
        <Card title="Top Hosts com Incidentes">
          <div className="space-y-3">
            {m.topIncidentHosts.map((host, index) => (
              <div key={host.hostname} className="flex items-center gap-3">
                <span className="text-gray-600 text-xs w-4">{index + 1}</span>
                <span className="text-gray-300 font-mono text-sm flex-1">{host.hostname}</span>
                <div className="flex-1 max-w-[120px] bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (Number(host.count) / (m.topIncidentHosts[0]?.count || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-red-400 text-sm font-semibold w-8 text-right">{host.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
