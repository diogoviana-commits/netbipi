import React, { useState, useEffect, useCallback } from 'react';
import { Cloud, RefreshCw, AlertTriangle, DollarSign, Server, Monitor } from 'lucide-react';
import { cloudApi } from '../services/api';

interface AWSInstance {
  id: string;
  name: string;
  type: string;
  state: string;
  cpu: number;
  uptime: string;
}

interface AzureVM {
  id: string;
  name: string;
  size: string;
  state: string;
  cpu: number;
}

interface CloudAlert {
  id: string;
  name: string;
  severity: string;
  instance: string;
  metric: string;
  threshold: string;
  current: string;
  state: string;
  triggered_at: string;
}

interface CloudStatus {
  aws: {
    available: boolean;
    region: string;
    instances: AWSInstance[];
    alerts: number;
    cost_month: number;
    last_updated: string;
  };
  azure: {
    available: boolean;
    region: string;
    vms: AzureVM[];
    alerts: number;
    cost_month: number;
    last_updated: string;
  };
  is_demo: boolean;
}

const StateBadge: React.FC<{ state: string }> = ({ state }) => {
  const styles: Record<string, string> = {
    running: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    stopped: 'bg-red-500/20 text-red-400 border-red-500/30',
    starting: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    stopping: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };
  const labels: Record<string, string> = {
    running: 'Ativo', stopped: 'Parado', starting: 'Iniciando', stopping: 'Parando',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${styles[state] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
      {labels[state] || state}
    </span>
  );
};

const CpuBar: React.FC<{ cpu: number }> = ({ cpu }) => {
  const color = cpu >= 80 ? 'bg-red-500' : cpu >= 60 ? 'bg-yellow-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-1.5 w-20">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${cpu}%` }} />
      </div>
      <span className={`text-xs font-mono ${cpu >= 80 ? 'text-red-400' : cpu >= 60 ? 'text-yellow-400' : 'text-emerald-400'}`}>
        {cpu}%
      </span>
    </div>
  );
};

const CloudPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'aws' | 'azure'>('aws');
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [cloudAlerts, setCloudAlerts] = useState<{ aws_cloudwatch: CloudAlert[]; azure_monitor: CloudAlert[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, alertsRes] = await Promise.all([
        cloudApi.getStatus(),
        cloudApi.getAlerts(),
      ]);
      setStatus(statusRes.data);
      setCloudAlerts(alertsRes.data);
      setLastUpdated(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const awsAlerts = cloudAlerts?.aws_cloudwatch || [];
  const azureAlerts = cloudAlerts?.azure_monitor || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cloud size={24} className="text-emerald-400" />
            Painel Cloud
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Monitoramento de infraestrutura em nuvem
            {lastUpdated && (
              <span className="ml-2 text-gray-600">
                · Atualizado: {lastUpdated.toLocaleTimeString('pt-BR')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status?.is_demo && (
            <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs px-3 py-1 rounded-full font-medium">
              Ambiente de demonstração
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['aws', 'azure'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {tab === 'aws' ? 'Amazon AWS' : 'Microsoft Azure'}
          </button>
        ))}
      </div>

      {loading && !status ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={32} className="animate-spin text-emerald-400" />
        </div>
      ) : !status ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-400">Painel de nuvem indisponível neste ambiente</p>
        </div>
      ) : activeTab === 'aws' ? (
        <div className="space-y-6">
          {/* AWS Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Server size={14} className="text-orange-400" />
                <span className="text-gray-400 text-xs">Região</span>
              </div>
              <p className="text-white font-bold">{status.aws.region}</p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Monitor size={14} className="text-emerald-400" />
                <span className="text-gray-400 text-xs">Instâncias</span>
              </div>
              <p className="text-white font-bold">{status.aws.instances.length}</p>
            </div>
            <div className="bg-gray-800/60 border border-red-900/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-gray-400 text-xs">Alertas CloudWatch</span>
              </div>
              <p className="text-red-400 font-bold">{awsAlerts.length}</p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={14} className="text-yellow-400" />
                <span className="text-gray-400 text-xs">Custo (mês)</span>
              </div>
              <p className="text-yellow-400 font-bold">
                R$ {status.aws.cost_month.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* AWS Instances table */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-700">
              <h3 className="text-white font-semibold text-sm">Instâncias EC2</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-900/40">
                    <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">ID</th>
                    <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">Nome</th>
                    <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">Tipo</th>
                    <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">Estado</th>
                    <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">CPU</th>
                    <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">Uptime</th>
                  </tr>
                </thead>
                <tbody>
                  {status.aws.instances.map((inst) => (
                    <tr key={inst.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{inst.id}</td>
                      <td className="px-5 py-3 text-white text-sm font-medium">{inst.name}</td>
                      <td className="px-5 py-3 text-gray-400 text-sm font-mono">{inst.type}</td>
                      <td className="px-5 py-3"><StateBadge state={inst.state} /></td>
                      <td className="px-5 py-3"><CpuBar cpu={inst.cpu} /></td>
                      <td className="px-5 py-3 text-gray-400 text-sm">{inst.uptime || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CloudWatch Alerts */}
          {awsAlerts.length > 0 && (
            <div className="bg-gray-800/60 border border-red-900/30 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-400" />
                <h3 className="text-white font-semibold text-sm">Alertas CloudWatch</h3>
              </div>
              <div className="divide-y divide-gray-800">
                {awsAlerts.map((alert) => (
                  <div key={alert.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{alert.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {alert.metric}: {alert.current} / limite: {alert.threshold} · {alert.instance}
                      </p>
                    </div>
                    <span className="bg-red-900/40 text-red-400 border border-red-700/50 text-xs px-2 py-0.5 rounded flex-shrink-0">
                      {alert.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Azure Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Server size={14} className="text-blue-400" />
                <span className="text-gray-400 text-xs">Região</span>
              </div>
              <p className="text-white font-bold">{status.azure.region}</p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Monitor size={14} className="text-emerald-400" />
                <span className="text-gray-400 text-xs">VMs</span>
              </div>
              <p className="text-white font-bold">{status.azure.vms.length}</p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-emerald-400" />
                <span className="text-gray-400 text-xs">Alertas Azure Monitor</span>
              </div>
              <p className="text-emerald-400 font-bold">{azureAlerts.length}</p>
            </div>
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={14} className="text-yellow-400" />
                <span className="text-gray-400 text-xs">Custo (mês)</span>
              </div>
              <p className="text-yellow-400 font-bold">
                R$ {status.azure.cost_month.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Azure VMs table */}
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-700">
              <h3 className="text-white font-semibold text-sm">Máquinas Virtuais</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-900/40">
                    <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">ID</th>
                    <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">Nome</th>
                    <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">Tamanho</th>
                    <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">Estado</th>
                    <th className="text-left text-gray-500 text-xs font-medium px-5 py-3">CPU</th>
                  </tr>
                </thead>
                <tbody>
                  {status.azure.vms.map((vm) => (
                    <tr key={vm.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{vm.id}</td>
                      <td className="px-5 py-3 text-white text-sm font-medium">{vm.name}</td>
                      <td className="px-5 py-3 text-gray-400 text-sm font-mono">{vm.size}</td>
                      <td className="px-5 py-3"><StateBadge state={vm.state} /></td>
                      <td className="px-5 py-3"><CpuBar cpu={vm.cpu} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {azureAlerts.length === 0 && (
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle size={16} className="text-emerald-400" />
              <p className="text-emerald-400 text-sm">Nenhum alerta ativo no Azure Monitor</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CloudPanel;
