import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2, Download, FileText, Calendar, Loader2,
  AlertTriangle, Ticket, Clock, TrendingUp,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { reportApi } from '../services/api';

interface ReportData {
  period: { start: string; end: string };
  summary: { total: string; critical_count: string; resolved_count: string; open_count: string };
  topHosts: Array<{ hostname: string; incident_count: string }>;
  alertsBySeverity: Array<{ severity: string; count: string }>;
  alertsOverTime: Array<{ day: string; count: string }>;
  ticketsByStatus: Array<{ status: string; count: string }>;
  mttrMinutes: number;
}

const severityColor: Record<string, string> = {
  disaster: '#dc2626',
  high: '#ea580c',
  average: '#d97706',
  warning: '#ca8a04',
  info: '#2563eb',
};

const statusLabel: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

const QuickPeriod: React.FC<{
  label: string;
  onClick: () => void;
  active: boolean;
}> = ({ label, onClick, active }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
      active
        ? 'bg-emerald-600 text-white'
        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
    }`}
  >
    {label}
  </button>
);

const Reports: React.FC = () => {
  const today = new Date();
  const [startDate, setStartDate] = useState(
    new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null);
  const [activePeriod, setActivePeriod] = useState<string>('7dias');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportApi.getIncidentReport({ start: startDate, end: endDate });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const setQuickPeriod = (days: number, label: string) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setActivePeriod(label);
  };

  const setThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
    setActivePeriod('mes');
  };

  const downloadFile = async (type: 'pdf' | 'excel') => {
    setDownloading(type);
    try {
      const params = { start: startDate, end: endDate };
      const res = type === 'pdf'
        ? await reportApi.downloadPDF(params)
        : await reportApi.downloadExcel(params);

      const blob = new Blob([res.data], {
        type: type === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-netbipi-${new Date().toISOString().split('T')[0]}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setDownloading(null);
    }
  };

  const chartData = data?.alertsOverTime.map((d) => ({
    dia: new Date(d.day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    alertas: parseInt(d.count),
  })) || [];

  const severityData = data?.alertsBySeverity.map((d) => ({
    severidade: d.severity,
    count: parseInt(d.count),
    fill: severityColor[d.severity] || '#6b7280',
  })) || [];

  const formatMttr = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}min`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart2 size={24} className="text-emerald-400" />
            Relatórios
          </h1>
          <p className="text-gray-400 text-sm mt-1">Análise de incidentes e desempenho operacional</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadFile('pdf')}
            disabled={!!downloading}
            className="flex items-center gap-2 bg-red-700/30 hover:bg-red-700/50 text-red-400 border border-red-700/50 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {downloading === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Exportar PDF
          </button>
          <button
            onClick={() => downloadFile('excel')}
            disabled={!!downloading}
            className="flex items-center gap-2 bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-400 border border-emerald-700/50 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {downloading === 'excel' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Date filter */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <span className="text-gray-400 text-sm">Período:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setActivePeriod(''); }}
              className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
            />
            <span className="text-gray-600">até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setActivePeriod(''); }}
              className="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 text-xs">Período rápido:</span>
            <QuickPeriod label="Hoje" onClick={() => setQuickPeriod(0, 'hoje')} active={activePeriod === 'hoje'} />
            <QuickPeriod label="7 dias" onClick={() => setQuickPeriod(7, '7dias')} active={activePeriod === '7dias'} />
            <QuickPeriod label="30 dias" onClick={() => setQuickPeriod(30, '30dias')} active={activePeriod === '30dias'} />
            <QuickPeriod label="Este mês" onClick={setThisMonth} active={activePeriod === 'mes'} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-emerald-400" />
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle size={48} className="text-gray-700 mb-4" />
          <p className="text-gray-400">Erro ao carregar dados do relatório</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-yellow-400" />
                <span className="text-gray-400 text-xs">Total de Alertas</span>
              </div>
              <p className="text-3xl font-bold text-white">{data.summary?.total || 0}</p>
            </div>
            <div className="bg-gray-800/60 border border-red-900/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-red-400" />
                <span className="text-gray-400 text-xs">Alertas Críticos</span>
              </div>
              <p className="text-3xl font-bold text-red-400">{data.summary?.critical_count || 0}</p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Ticket size={16} className="text-blue-400" />
                <span className="text-gray-400 text-xs">Chamados Abertos</span>
              </div>
              <p className="text-3xl font-bold text-white">
                {data.ticketsByStatus?.find((t) => t.status === 'open')?.count || 0}
              </p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-emerald-400" />
                <span className="text-gray-400 text-xs">MTTR Médio</span>
              </div>
              <p className="text-3xl font-bold text-emerald-400">{formatMttr(data.mttrMinutes)}</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alerts over time */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-emerald-400" />
                <h3 className="text-white font-semibold text-sm">Alertas ao Longo do Tempo</h3>
              </div>
              {chartData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-600">Sem dados no período</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="dia" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#fff', borderRadius: 8 }}
                    />
                    <Line type="monotone" dataKey="alertas" stroke="#059669" strokeWidth={2} dot={{ fill: '#059669', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* By severity */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={16} className="text-emerald-400" />
                <h3 className="text-white font-semibold text-sm">Alertas por Severidade</h3>
              </div>
              {severityData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-600">Sem dados no período</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={severityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="severidade" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#1f2937', border: '1px solid #374151', color: '#fff', borderRadius: 8 }}
                    />
                    <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]}>
                      {severityData.map((entry, index) => (
                        <rect key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top hosts */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Top 10 Hosts com Mais Incidentes</h3>
              {data.topHosts.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {data.topHosts.map((host, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-gray-600 text-xs w-5 text-right">{idx + 1}</span>
                      <span className="text-gray-300 text-sm flex-1 truncate">{host.hostname || 'Desconhecido'}</span>
                      <span className="bg-red-900/30 text-red-400 text-xs px-2 py-0.5 rounded font-mono">
                        {host.incident_count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tickets by status */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Chamados por Status no Período</h3>
              {data.ticketsByStatus.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">Sem dados</p>
              ) : (
                <div className="space-y-3">
                  {data.ticketsByStatus.map((item) => {
                    const total = data.ticketsByStatus.reduce((s, t) => s + parseInt(t.count), 0);
                    const pct = total > 0 ? Math.round((parseInt(item.count) / total) * 100) : 0;
                    return (
                      <div key={item.status}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-300 text-sm">{statusLabel[item.status] || item.status}</span>
                          <span className="text-gray-400 text-xs">{item.count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-emerald-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Reports;
