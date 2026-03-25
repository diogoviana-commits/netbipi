import React, { useEffect, useState, useCallback } from 'react';
import { Search, ScrollText, Download, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { logsApi } from '../services/api';
import { LogEntry } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Badge from '../components/ui/Badge';

const LEVEL_STYLES: Record<string, string> = {
  critical: 'bg-red-600/20 text-red-400 border-red-600/30',
  error: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
  warning: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  info: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
};

const LEVEL_ROW_BG: Record<string, string> = {
  critical: 'border-l-2 border-red-600',
  error: 'border-l-2 border-orange-600',
  warning: 'border-l-2 border-yellow-600',
  info: '',
};

const levelVariant = (level: string): 'danger' | 'orange' | 'warning' | 'info' | 'default' => {
  switch (level) {
    case 'critical': return 'danger';
    case 'error': return 'orange';
    case 'warning': return 'warning';
    case 'info': return 'info';
    default: return 'default';
  }
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

const exportCSV = (logs: LogEntry[]) => {
  const headers = ['Data/Hora', 'Host', 'Source', 'Level', 'Mensagem'];
  const rows = logs.map(log => [
    formatDate(log.occurred_at || log.occurredAt),
    log.hostname || '',
    log.source,
    log.level,
    `"${(log.message || '').replace(/"/g, '""')}"`,
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `netbipi-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await logsApi.getLogs({
        page, limit,
        ...(search && { search }),
        ...(levelFilter && { level: levelFilter }),
        ...(sourceFilter && { source: sourceFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });
      setLogs(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, levelFilter, sourceFilter, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <ScrollText size={20} className="text-emerald-400" />
            Logs do Sistema
          </h2>
          <p className="text-gray-500 text-sm">{total} entradas encontradas</p>
        </div>
        <button
          onClick={() => exportCSV(logs)}
          className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-emerald-400 hover:bg-gray-800 border border-gray-700 rounded-lg text-sm transition-colors"
        >
          <Download size={14} />
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar na mensagem..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={levelFilter}
          onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todos níveis</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <input
          type="text"
          placeholder="Source..."
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm w-28 focus:outline-none focus:border-emerald-500"
        />
        <input
          type="datetime-local"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        />
        <input
          type="datetime-local"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        />
        <button
          onClick={() => { setSearch(''); setLevelFilter(''); setSourceFilter(''); setStartDate(''); setEndDate(''); setPage(1); }}
          className="text-gray-400 hover:text-white text-sm px-3 py-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          Limpar
        </button>
      </div>

      {/* Log Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-900/50">
                  <th className="text-left text-gray-400 font-semibold px-4 py-3 whitespace-nowrap">Data/Hora</th>
                  <th className="text-left text-gray-400 font-semibold px-4 py-3">Host</th>
                  <th className="text-left text-gray-400 font-semibold px-4 py-3">Source</th>
                  <th className="text-left text-gray-400 font-semibold px-4 py-3">Level</th>
                  <th className="text-left text-gray-400 font-semibold px-4 py-3">Mensagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className={`hover:bg-gray-700/20 cursor-pointer transition-colors ${LEVEL_ROW_BG[log.level] || ''}`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-2.5 font-mono text-gray-400 whitespace-nowrap">
                      {formatDate(log.occurred_at || log.occurredAt)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-300">
                      {log.hostname || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">
                      {log.source}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium border ${LEVEL_STYLES[log.level] || ''}`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-300 max-w-md">
                      <span className="line-clamp-1">{log.message}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <ScrollText size={40} className="mb-3 opacity-30" />
                <p className="text-sm">Nenhum log encontrado</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Mostrando {Math.min((page - 1) * limit + 1, total)}-{Math.min(page * limit, total)} de {total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <span className="text-white px-2">Pág. {page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelectedLog(null)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-3">
                <Badge variant={levelVariant(selectedLog.level)}>{selectedLog.level}</Badge>
                <span className="text-gray-400 text-sm">{selectedLog.source}</span>
                <span className="text-gray-600 text-xs">{formatDate(selectedLog.occurred_at || selectedLog.occurredAt)}</span>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500 text-xs">Host</p><p className="text-white font-mono">{selectedLog.hostname || '-'}</p></div>
                <div><p className="text-gray-500 text-xs">IP</p><p className="text-white font-mono">{selectedLog.ip_address || '-'}</p></div>
                <div><p className="text-gray-500 text-xs">Padrão Detectado</p><p className="text-emerald-400 text-xs">{selectedLog.pattern || 'general'}</p></div>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1.5">Mensagem</p>
                <p className="text-gray-200 text-sm">{selectedLog.message}</p>
              </div>
              {(selectedLog.raw_log || selectedLog.rawLog) && (
                <div>
                  <p className="text-gray-500 text-xs mb-1.5">Log Bruto</p>
                  <pre className="text-gray-300 text-xs bg-gray-800 border border-gray-700 rounded-lg p-3 whitespace-pre-wrap font-mono overflow-x-auto">
                    {selectedLog.raw_log || selectedLog.rawLog}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Logs;
