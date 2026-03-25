import React, { useEffect, useState, useCallback } from 'react';
import {
  Search, RefreshCw, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle, Eye, Plus, Bell,
} from 'lucide-react';
import { alertsApi, ticketsApi } from '../services/api';
import { Alert } from '../types';
import Badge, { severityVariant, severityLabel, statusVariant, statusLabel } from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertsApi.getAlerts({
        page,
        limit,
        ...(search && { search }),
        ...(severityFilter && { severity: severityFilter }),
        ...(statusFilter && { status: statusFilter }),
      });
      setAlerts(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      showToast('Erro ao carregar alertas', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, severityFilter, statusFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await alertsApi.syncFromZabbix();
      showToast(`Sincronizado: ${res.data.created} criados, ${res.data.updated} atualizados`);
      fetchAlerts();
    } catch {
      showToast('Erro ao sincronizar com Zabbix', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await alertsApi.acknowledgeAlert(alertId, 'Reconhecido pelo analista');
      showToast('Alerta reconhecido');
      fetchAlerts();
    } catch {
      showToast('Erro ao reconhecer alerta', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (alertId: string) => {
    setActionLoading(alertId + '_resolve');
    try {
      await alertsApi.resolveAlert(alertId);
      showToast('Alerta resolvido');
      fetchAlerts();
    } catch {
      showToast('Erro ao resolver alerta', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateTicket = async (alertId: string) => {
    setActionLoading(alertId + '_ticket');
    try {
      await ticketsApi.createFromAlert(alertId);
      showToast('Chamado criado com sucesso');
      fetchAlerts();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; ticketId?: string } } };
      if (error.response?.data?.ticketId) {
        showToast('Este alerta já possui um chamado vinculado', 'error');
      } else {
        showToast('Erro ao criar chamado', 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5 relative">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg border text-sm font-medium shadow-lg ${
              toast.type === 'success'
                ? 'bg-emerald-600/20 border-emerald-600/40 text-emerald-400'
                : 'bg-red-600/20 border-red-600/40 text-red-400'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <Bell size={20} className="text-emerald-400" />
            Alertas
          </h2>
          <p className="text-gray-500 text-sm">{total} alertas encontrados</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<RefreshCw size={14} />}
          loading={syncing}
          onClick={handleSync}
        >
          Sincronizar Zabbix
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por host, trigger..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todas severidades</option>
          <option value="disaster">Desastre</option>
          <option value="high">Alto</option>
          <option value="average">Médio</option>
          <option value="warning">Aviso</option>
          <option value="info">Info</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todos status</option>
          <option value="open">Aberto</option>
          <option value="acknowledged">Reconhecido</option>
          <option value="resolved">Resolvido</option>
        </select>
        <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setSeverityFilter(''); setStatusFilter(''); setPage(1); }}>
          Limpar
        </Button>
      </div>

      {/* Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <AlertTriangle size={40} className="mb-3 opacity-30" />
            <p className="text-sm">Nenhum alerta encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/80">
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Severidade</th>
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Host</th>
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Trigger</th>
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3 hidden lg:table-cell">Mensagem</th>
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Data/Hora</th>
                  <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Status</th>
                  <th className="text-right text-gray-400 text-xs font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant={severityVariant(alert.severity)}>
                        {severityLabel(alert.severity)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-200 font-mono text-xs">
                      {alert.hostname || alert.asset?.hostname || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs max-w-[200px]">
                      <span className="line-clamp-2">
                        {alert.trigger_name || alert.triggerName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] hidden lg:table-cell">
                      <span className="line-clamp-1">{alert.message}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(alert.created_at || alert.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(alert.status)}>
                        {statusLabel(alert.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {alert.status === 'open' && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            disabled={actionLoading === alert.id}
                            title="Reconhecer"
                            className="p-1.5 text-blue-400 hover:bg-blue-600/20 rounded transition-colors disabled:opacity-50"
                          >
                            {actionLoading === alert.id ? <LoadingSpinner size="sm" /> : <Eye size={14} />}
                          </button>
                        )}
                        {alert.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            disabled={actionLoading === alert.id + '_resolve'}
                            title="Resolver"
                            className="p-1.5 text-emerald-400 hover:bg-emerald-600/20 rounded transition-colors disabled:opacity-50"
                          >
                            {actionLoading === alert.id + '_resolve' ? <LoadingSpinner size="sm" /> : <CheckCircle size={14} />}
                          </button>
                        )}
                        {!alert.ticket_id && !alert.ticketId && alert.status !== 'resolved' && (
                          <button
                            onClick={() => handleCreateTicket(alert.id)}
                            disabled={actionLoading === alert.id + '_ticket'}
                            title="Criar Chamado"
                            className="p-1.5 text-orange-400 hover:bg-orange-600/20 rounded transition-colors disabled:opacity-50"
                          >
                            {actionLoading === alert.id + '_ticket' ? <LoadingSpinner size="sm" /> : <Plus size={14} />}
                          </button>
                        )}
                        {(alert.ticket_id || alert.ticketId) && (
                          <span className="text-xs text-gray-500 px-1">
                            #Chamado
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Mostrando {Math.min((page - 1) * limit + 1, total)}-{Math.min(page * limit, total)} de {total}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-white">Pág. {page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
