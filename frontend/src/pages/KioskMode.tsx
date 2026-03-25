import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Ticket, CheckCircle, Activity, X } from 'lucide-react';
import { alertsApi, ticketsApi, dashboardApi } from '../services/api';

interface Alert {
  id: string;
  trigger_name: string;
  severity: string;
  status: string;
  created_at: string;
  hostname?: string;
}

interface TicketItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  assigned_to?: string;
}

interface DashboardMetrics {
  openAlerts: number;
  criticalAlerts: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedToday: number;
  topIncidentHosts?: Array<{ hostname: string; count: number }>;
}

const severityStyles: Record<string, { bg: string; text: string; border: string; pulse?: boolean }> = {
  disaster: { bg: 'bg-red-950/80', text: 'text-red-300', border: 'border-red-500', pulse: true },
  high: { bg: 'bg-orange-950/60', text: 'text-orange-300', border: 'border-orange-500' },
  average: { bg: 'bg-yellow-950/40', text: 'text-yellow-300', border: 'border-yellow-600' },
  warning: { bg: 'bg-yellow-950/30', text: 'text-yellow-400', border: 'border-yellow-700' },
  info: { bg: 'bg-blue-950/30', text: 'text-blue-400', border: 'border-blue-700' },
};

const timeAgo = (date: string) => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}min`;
};

const Clock: React.FC = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right">
      <p className="text-white font-mono text-4xl font-bold tracking-wider">
        {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-gray-400 text-sm capitalize">
        {time.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
};

const KioskMode: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [alertsRes, ticketsRes, metricsRes] = await Promise.all([
        alertsApi.getAlerts({ status: 'open', limit: 20, sort: 'severity' }),
        ticketsApi.getTickets({ status: 'open,in_progress', limit: 10 }),
        dashboardApi.getMetrics(),
      ]);
      setAlerts(alertsRes.data.alerts || []);
      setTickets(ticketsRes.data.tickets || []);
      setMetrics(metricsRes.data);
      setLastRefresh(new Date());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const criticalAlerts = alerts.filter((a) => a.severity === 'disaster' || a.severity === 'high');
  const otherAlerts = alerts.filter((a) => a.severity !== 'disaster' && a.severity !== 'high');
  const displayAlerts = [...criticalAlerts, ...otherAlerts];

  const openTickets = tickets.filter((t) => t.status === 'open');
  const inProgressTickets = tickets.filter((t) => t.status === 'in_progress');

  const availability = metrics
    ? Math.round(((metrics.openAlerts > 0 ? 1 : 0) === 0 ? 100 : 100 - (metrics.criticalAlerts / Math.max(metrics.openAlerts, 1)) * 10))
    : 99.9;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold tracking-tight">Centro de Operações</h1>
            <p className="text-gray-500 text-sm">
              NetBIPI NOC Dashboard · Atualizado: {lastRefresh.toLocaleTimeString('pt-BR')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {/* Stats quick */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-red-400 text-2xl font-bold">{criticalAlerts.length}</p>
              <p className="text-gray-500 text-xs">Críticos</p>
            </div>
            <div className="text-center">
              <p className="text-yellow-400 text-2xl font-bold">{metrics?.openAlerts || 0}</p>
              <p className="text-gray-500 text-xs">Alertas</p>
            </div>
            <div className="text-center">
              <p className="text-blue-400 text-2xl font-bold">{metrics?.openTickets || 0}</p>
              <p className="text-gray-500 text-xs">Chamados</p>
            </div>
          </div>
          <Clock />
          <a
            href="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-400 text-xs transition-colors border border-gray-800 rounded-lg px-3 py-2"
          >
            <X size={12} />
            Sair do Modo Quiosque
          </a>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex-1 grid grid-cols-3 gap-0 divide-x divide-gray-800 min-h-0">
        {/* Left: Alerts */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/50">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400" />
              Alertas Ativos
              {displayAlerts.length > 0 && (
                <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">{displayAlerts.length}</span>
              )}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {displayAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <CheckCircle size={48} className="text-emerald-600 mb-4" />
                <p className="text-emerald-400 text-lg font-semibold">Sem alertas ativos</p>
                <p className="text-gray-600 text-sm mt-1">Todos os sistemas operacionais</p>
              </div>
            ) : (
              displayAlerts.map((alert) => {
                const styles = severityStyles[alert.severity] || severityStyles.info;
                return (
                  <div
                    key={alert.id}
                    className={`rounded-xl border p-4 ${styles.bg} ${styles.border} ${
                      styles.pulse ? 'animate-pulse' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm leading-snug ${styles.text}`}>
                          {alert.trigger_name}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          {(alert as unknown as Record<string, unknown>).hostname as string || 'Host desconhecido'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-xs font-bold uppercase ${styles.text}`}>
                          {alert.severity}
                        </span>
                        <span className="text-gray-600 text-xs">{timeAgo(alert.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center: Tickets */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/50">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Ticket size={18} className="text-blue-400" />
              Chamados
              {tickets.length > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{tickets.length}</span>
              )}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-blue-950/40 border border-blue-800/30 rounded-xl p-4 text-center">
                <p className="text-blue-400 text-3xl font-bold">{openTickets.length}</p>
                <p className="text-gray-500 text-xs mt-1">Abertos</p>
              </div>
              <div className="bg-yellow-950/30 border border-yellow-800/30 rounded-xl p-4 text-center">
                <p className="text-yellow-400 text-3xl font-bold">{inProgressTickets.length}</p>
                <p className="text-gray-500 text-xs mt-1">Em andamento</p>
              </div>
            </div>

            {tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle size={48} className="text-emerald-600 mb-4" />
                <p className="text-emerald-400 text-lg font-semibold">Nenhum chamado aberto</p>
              </div>
            ) : (
              tickets.map((ticket) => (
                <div key={ticket.id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                  <p className="text-white text-sm font-medium leading-snug line-clamp-2">{ticket.title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      ticket.status === 'in_progress' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-blue-900/40 text-blue-400'
                    }`}>
                      {ticket.status === 'in_progress' ? 'Em andamento' : 'Aberto'}
                    </span>
                    <span className="text-gray-500 text-xs">{timeAgo(ticket.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Status */}
        <div className="flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/50">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Activity size={18} className="text-emerald-400" />
              Status do Sistema
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Availability */}
            <div className={`rounded-xl border p-6 text-center ${
              availability >= 99 ? 'bg-emerald-950/40 border-emerald-700/30' :
              availability >= 95 ? 'bg-yellow-950/30 border-yellow-700/30' :
              'bg-red-950/30 border-red-700/30'
            }`}>
              <p className={`text-5xl font-bold font-mono ${
                availability >= 99 ? 'text-emerald-400' : availability >= 95 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {availability.toFixed(1)}%
              </p>
              <p className="text-gray-400 text-sm mt-2">Disponibilidade estimada</p>
            </div>

            {/* Resolved today */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle size={16} className="text-emerald-400" />
                <span className="text-gray-400 text-sm">Resolvidos hoje</span>
              </div>
              <p className="text-emerald-400 text-3xl font-bold">{metrics?.resolvedToday || 0}</p>
            </div>

            {/* Top hosts */}
            {metrics?.topIncidentHosts && metrics.topIncidentHosts.length > 0 && (
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                <h3 className="text-gray-400 text-sm font-semibold mb-3">Top hosts monitorados</h3>
                <div className="space-y-2">
                  {metrics.topIncidentHosts.slice(0, 5).map((host, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-gray-600 text-xs w-4 text-right">{i + 1}</span>
                      <span className="text-gray-300 text-xs flex-1 truncate font-mono">{host.hostname}</span>
                      <span className={`text-xs font-mono ${host.count > 5 ? 'text-red-400' : host.count > 2 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {host.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metrics */}
            {metrics && (
              <div className="space-y-3">
                {[
                  { label: 'Alertas abertos', value: metrics.openAlerts, color: 'text-yellow-400' },
                  { label: 'Alertas críticos', value: metrics.criticalAlerts, color: 'text-red-400' },
                  { label: 'Chamados em andamento', value: metrics.inProgressTickets, color: 'text-blue-400' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-3">
                    <span className="text-gray-400 text-sm">{item.label}</span>
                    <span className={`font-bold text-lg font-mono ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-2 border-t border-gray-800 bg-gray-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-gray-600 text-xs">Sistema em monitoramento contínuo · NetBIPI Hub Operacional</span>
        </div>
        <span className="text-gray-700 text-xs">Atualização automática a cada 15 segundos</span>
      </div>
    </div>
  );
};

export default KioskMode;
