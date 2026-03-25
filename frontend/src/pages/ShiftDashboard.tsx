import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, AlertTriangle, Ticket, CheckCircle, TrendingUp,
  RefreshCw, ChevronDown, ChevronUp, Copy, Check, X,
} from 'lucide-react';
import { shiftApi } from '../services/api';

type ShiftType = 'manha' | 'tarde' | 'noite';

interface ShiftSummary {
  shift: { label: string; start: string; end: string };
  stats: {
    alertsOpened: number;
    ticketsStale: number;
    criticalOpen: number;
    resolved: number;
    escalations: number;
  };
  alertsOpened: Array<{ id: string; trigger_name: string; severity: string; status: string; created_at: string; hostname: string }>;
  ticketsStale: Array<{ id: string; title: string; status: string; priority: string; updated_at: string; assigned_to: string }>;
  criticalOpen: Array<{ id: string; trigger_name: string; severity: string; created_at: string; hostname: string }>;
  resolvedAlerts: Array<{ id: string; trigger_name: string; severity: string; resolved_at: string; hostname: string }>;
  analystActivity: Array<{ full_name: string; role: string; alerts_acked: string; tickets_updated: string; comments_added: string }>;
  pendingEscalations: Array<{ id: string; reason: string; escalated_at: string; trigger_name: string; hostname: string }>;
}

const severityBg: Record<string, string> = {
  disaster: 'bg-red-900/30 text-red-400 border-red-700/50',
  high: 'bg-orange-900/30 text-orange-400 border-orange-700/50',
  average: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50',
  warning: 'bg-yellow-800/20 text-yellow-300 border-yellow-700/30',
  info: 'bg-blue-900/20 text-blue-400 border-blue-700/30',
};

const priorityBg: Record<string, string> = {
  critical: 'bg-red-900/30 text-red-400',
  high: 'bg-orange-900/30 text-orange-400',
  medium: 'bg-yellow-900/30 text-yellow-400',
  low: 'bg-gray-800 text-gray-400',
};

const HandoffModal: React.FC<{ report: string; shift: string; onClose: () => void }> = ({ report, shift, onClose }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold text-lg">Relatório de Passagem de Plantão</h2>
            <p className="text-gray-400 text-sm">{shift}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <pre className="text-gray-300 text-xs whitespace-pre-wrap font-mono bg-gray-950 rounded-lg p-4 border border-gray-800 leading-relaxed">
            {report}
          </pre>
        </div>
        <div className="p-4 border-t border-gray-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
            Fechar
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado!' : 'Copiar Relatório'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  count: number;
  colorClass: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, count, colorClass, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={colorClass}>{icon}</span>
          <span className="text-white font-semibold text-sm">{title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${colorClass} bg-current/10`}>
            {count}
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>
      {open && <div className="border-t border-gray-800">{children}</div>}
    </div>
  );
};

const ShiftDashboard: React.FC = () => {
  const [activeShift, setActiveShift] = useState<ShiftType>('manha');
  const [data, setData] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [handoffReport, setHandoffReport] = useState<string | null>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);

  // Determine current shift
  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 6 && h < 14) setActiveShift('manha');
    else if (h >= 14 && h < 22) setActiveShift('tarde');
    else setActiveShift('noite');
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shiftApi.getSummary(activeShift);
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeShift]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleHandoff = async () => {
    setHandoffLoading(true);
    try {
      const res = await shiftApi.getHandoffReport(activeShift);
      setHandoffReport(res.data.report);
    } catch {
      // ignore
    } finally {
      setHandoffLoading(false);
    }
  };

  const shiftButtons: Array<{ key: ShiftType; label: string }> = [
    { key: 'manha', label: 'Manhã (06-14h)' },
    { key: 'tarde', label: 'Tarde (14-22h)' },
    { key: 'noite', label: 'Noite (22-06h)' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock size={24} className="text-emerald-400" />
            Turno Atual
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {data?.shift.label || 'Carregando turno...'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {shiftButtons.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveShift(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeShift === s.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 px-3 py-1.5 rounded-lg text-xs transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            onClick={handleHandoff}
            disabled={handoffLoading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {handoffLoading ? <RefreshCw size={12} className="animate-spin" /> : <Copy size={12} />}
            Gerar Relatório de Plantão
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={32} className="animate-spin text-emerald-400" />
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-400">Erro ao carregar dados do turno</p>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-yellow-400" />
                <span className="text-gray-500 text-xs">Alertas no Turno</span>
              </div>
              <p className="text-2xl font-bold text-white">{data.stats.alertsOpened}</p>
            </div>
            <div className="bg-gray-800/60 border border-orange-900/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Ticket size={14} className="text-orange-400" />
                <span className="text-gray-500 text-xs">Sem atualização (+2h)</span>
              </div>
              <p className="text-2xl font-bold text-orange-400">{data.stats.ticketsStale}</p>
            </div>
            <div className="bg-gray-800/60 border border-red-900/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-gray-500 text-xs">Críticos em Aberto</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{data.stats.criticalOpen}</p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-gray-500 text-xs">Resolvidos</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{data.stats.resolved}</p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-purple-400" />
                <span className="text-gray-500 text-xs">Escaladas</span>
              </div>
              <p className="text-2xl font-bold text-purple-400">{data.stats.escalations}</p>
            </div>
          </div>

          {/* Stale tickets */}
          <CollapsibleSection
            title="Atenção — Chamados sem atualização há mais de 2h"
            icon={<Ticket size={16} />}
            count={data.ticketsStale.length}
            colorClass="text-orange-400"
          >
            {data.ticketsStale.length === 0 ? (
              <p className="text-gray-500 text-sm p-5">Todos os chamados estão atualizados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/30">
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Chamado</th>
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Prioridade</th>
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Responsável</th>
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Última atualização</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ticketsStale.map((t) => (
                      <tr key={t.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="px-5 py-3 text-white text-sm">{t.title}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${priorityBg[t.priority]}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-sm">{t.assigned_to || 'Não atribuído'}</td>
                        <td className="px-5 py-3 text-orange-400 text-xs font-mono">
                          {new Date(t.updated_at).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          {/* Critical alerts open */}
          <CollapsibleSection
            title="Alertas críticos em aberto"
            icon={<AlertTriangle size={16} />}
            count={data.criticalOpen.length}
            colorClass="text-red-400"
          >
            {data.criticalOpen.length === 0 ? (
              <p className="text-gray-500 text-sm p-5">Nenhum alerta crítico em aberto.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/30">
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Trigger</th>
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Host</th>
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Severidade</th>
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.criticalOpen.map((a) => (
                      <tr key={a.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="px-5 py-3 text-white text-sm">{a.trigger_name}</td>
                        <td className="px-5 py-3 text-gray-400 text-sm font-mono">{a.hostname || 'N/A'}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded border ${severityBg[a.severity]}`}>
                            {a.severity}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {new Date(a.created_at).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CollapsibleSection>

          {/* Resolved this shift */}
          <CollapsibleSection
            title="Resolvidos neste turno"
            icon={<CheckCircle size={16} />}
            count={data.resolvedAlerts.length}
            colorClass="text-emerald-400"
            defaultOpen={false}
          >
            {data.resolvedAlerts.length === 0 ? (
              <p className="text-gray-500 text-sm p-5">Nenhum incidente resolvido neste turno.</p>
            ) : (
              <div className="divide-y divide-gray-800">
                {data.resolvedAlerts.map((a) => (
                  <div key={a.id} className="px-5 py-3 flex items-center gap-4">
                    <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{a.trigger_name}</p>
                      <p className="text-gray-500 text-xs">{a.hostname || 'N/A'}</p>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {new Date(a.resolved_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Analyst activity */}
          {data.analystActivity.length > 0 && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-400" />
                  Atividade dos Analistas neste Turno
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/30">
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Analista</th>
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Nível</th>
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Alertas reconhecidos</th>
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Chamados atualizados</th>
                      <th className="text-left text-gray-500 text-xs px-5 py-2">Comentários</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.analystActivity.map((a, i) => (
                      <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="px-5 py-3 text-white text-sm font-medium">{a.full_name}</td>
                        <td className="px-5 py-3 text-gray-400 text-xs">{a.role.toUpperCase()}</td>
                        <td className="px-5 py-3 text-center text-emerald-400 font-mono text-sm">{a.alerts_acked}</td>
                        <td className="px-5 py-3 text-center text-blue-400 font-mono text-sm">{a.tickets_updated}</td>
                        <td className="px-5 py-3 text-center text-gray-400 font-mono text-sm">{a.comments_added}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {handoffReport && (
        <HandoffModal
          report={handoffReport}
          shift={data?.shift.label || ''}
          onClose={() => setHandoffReport(null)}
        />
      )}
    </div>
  );
};

export default ShiftDashboard;
