import React, { useEffect, useState, useCallback } from 'react';
import { Search, Server, Plus, X, LayoutGrid, List, Monitor, Network, ChevronRight } from 'lucide-react';
import { assetsApi } from '../services/api';
import { Asset } from '../types';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusDot from '../components/ui/StatusDot';

const OsIcon: React.FC<{ osType: string; className?: string }> = ({ osType, className = '' }) => {
  if (osType === 'windows') return <Monitor size={16} className={`text-blue-400 ${className}`} />;
  if (osType === 'network') return <Network size={16} className={`text-yellow-400 ${className}`} />;
  return <Server size={16} className={`text-emerald-400 ${className}`} />;
};

const envVariant = (env: string): 'success' | 'warning' | 'info' | 'default' => {
  switch (env) {
    case 'production': return 'success';
    case 'staging': return 'warning';
    case 'development': return 'info';
    default: return 'default';
  }
};

const envLabel = (env: string): string => {
  const labels: Record<string, string> = {
    production: 'Produção',
    staging: 'Homolog',
    development: 'Dev',
  };
  return labels[env] || env;
};

const Assets: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState('');
  const [osFilter, setOsFilter] = useState('');

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    hostname: '', ipAddress: '', osType: 'linux', osVersion: '',
    environment: 'production', site: '', client: '', services: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assetsApi.getAssets({
        ...(search && { search }),
        ...(envFilter && { environment: envFilter }),
        ...(osFilter && { osType: osFilter }),
        limit: 50,
      });
      setAssets(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch {
      showMsg('Erro ao carregar ativos');
    } finally {
      setLoading(false);
    }
  }, [search, envFilter, osFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const openDetail = async (asset: Asset) => {
    try {
      const res = await assetsApi.getAssetById(asset.id);
      setSelectedAsset(res.data);
    } catch {
      setSelectedAsset(asset);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const services = createForm.services.split(',').map(s => s.trim()).filter(Boolean);
      await assetsApi.createAsset({ ...createForm, services } as unknown as Record<string, unknown>);
      showMsg('Ativo criado com sucesso');
      setShowCreateModal(false);
      fetchAssets();
    } catch {
      showMsg('Erro ao criar ativo');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-5 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 text-sm rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-xl flex items-center gap-2">
            <Server size={20} className="text-emerald-400" />
            Inventário de Ativos
          </h2>
          <p className="text-gray-500 text-sm">{total} ativos registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-emerald-600/20 text-emerald-400' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <List size={16} />
          </button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>
            Novo Ativo
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por hostname, IP, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-4 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todos ambientes</option>
          <option value="production">Produção</option>
          <option value="staging">Homologação</option>
          <option value="development">Desenvolvimento</option>
        </select>
        <select
          value={osFilter}
          onChange={(e) => setOsFilter(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
        >
          <option value="">Todos OS</option>
          <option value="linux">Linux</option>
          <option value="windows">Windows</option>
          <option value="network">Rede</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {assets.map(asset => (
            <div
              key={asset.id}
              className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors cursor-pointer group"
              onClick={() => openDetail(asset)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 bg-gray-700 rounded-lg flex items-center justify-center">
                  <OsIcon osType={asset.os_type || asset.osType} />
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusDot status={asset.is_active || asset.isActive ? 'online' : 'offline'} />
                  {Number(asset.open_alerts || asset.openAlerts || 0) > 0 && (
                    <span className="bg-red-600 text-white text-xs rounded-full px-1.5 py-0.5">
                      {asset.open_alerts || asset.openAlerts}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-white font-medium text-sm font-mono mb-0.5">{asset.hostname}</p>
              <p className="text-gray-500 text-xs font-mono mb-2">{asset.ip_address || asset.ipAddress}</p>
              <p className="text-gray-600 text-xs mb-3 truncate">{asset.os_version || asset.osVersion}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                <Badge variant={envVariant(asset.environment)} size="sm">
                  {envLabel(asset.environment)}
                </Badge>
                {asset.site && <span className="text-gray-600 text-xs">{asset.site}</span>}
              </div>
              {(asset.services || []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(asset.services || []).slice(0, 3).map(s => (
                    <span key={s} className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                  {(asset.services || []).length > 3 && (
                    <span className="text-gray-600 text-xs">+{(asset.services || []).length - 3}</span>
                  )}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between text-xs text-gray-600">
                <span>{asset.client || 'N/A'}</span>
                <ChevronRight size={12} className="group-hover:text-emerald-400 transition-colors" />
              </div>
            </div>
          ))}
          {assets.length === 0 && (
            <div className="col-span-4 flex flex-col items-center justify-center py-16 text-gray-500">
              <Server size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Nenhum ativo encontrado</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Hostname</th>
                <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">IP</th>
                <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">OS</th>
                <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Ambiente</th>
                <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Cliente</th>
                <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Serviços</th>
                <th className="text-left text-gray-400 text-xs font-semibold px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {assets.map(asset => (
                <tr
                  key={asset.id}
                  className="hover:bg-gray-700/20 cursor-pointer transition-colors"
                  onClick={() => openDetail(asset)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <OsIcon osType={asset.os_type || asset.osType} />
                      <span className="text-gray-200 font-mono text-sm">{asset.hostname}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{asset.ip_address || asset.ipAddress}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{asset.os_version || asset.osVersion}</td>
                  <td className="px-4 py-3">
                    <Badge variant={envVariant(asset.environment)} size="sm">{envLabel(asset.environment)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{asset.client || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(asset.services || []).slice(0, 2).map(s => (
                        <span key={s} className="bg-gray-700 text-gray-300 text-xs px-1.5 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusDot status={asset.is_active || asset.isActive ? 'online' : 'offline'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Asset Detail Panel */}
      {selectedAsset && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/50" onClick={() => setSelectedAsset(null)} />
          <div className="w-full max-w-lg bg-gray-900 border-l border-gray-700 overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 sticky top-0 bg-gray-900">
              <div className="flex items-center gap-3">
                <OsIcon osType={(selectedAsset.os_type || selectedAsset.osType) as string} />
                <div>
                  <h3 className="text-white font-semibold font-mono">{selectedAsset.hostname}</h3>
                  <p className="text-gray-500 text-xs">{selectedAsset.ip_address || selectedAsset.ipAddress}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-gray-500 text-xs">Sistema Operacional</p><p className="text-white">{selectedAsset.os_version || selectedAsset.osVersion}</p></div>
                <div><p className="text-gray-500 text-xs">Ambiente</p><Badge variant={envVariant(selectedAsset.environment)} size="sm">{envLabel(selectedAsset.environment)}</Badge></div>
                <div><p className="text-gray-500 text-xs">Site</p><p className="text-white">{selectedAsset.site || '-'}</p></div>
                <div><p className="text-gray-500 text-xs">Cliente</p><p className="text-white">{selectedAsset.client || '-'}</p></div>
                <div><p className="text-gray-500 text-xs">Status</p><StatusDot status={selectedAsset.is_active || selectedAsset.isActive ? 'online' : 'offline'} label={selectedAsset.is_active || selectedAsset.isActive ? 'Ativo' : 'Inativo'} /></div>
                <div><p className="text-gray-500 text-xs">Zabbix ID</p><p className="text-gray-400 font-mono text-xs">{selectedAsset.zabbixHostId || '-'}</p></div>
              </div>

              <div>
                <p className="text-gray-500 text-xs mb-2">Serviços</p>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedAsset.services || []).map(s => (
                    <span key={s} className="bg-gray-700 border border-gray-600 text-gray-200 text-xs px-2 py-1 rounded">{s}</span>
                  ))}
                  {(!selectedAsset.services || selectedAsset.services.length === 0) && (
                    <span className="text-gray-600 text-sm">Nenhum serviço registrado</span>
                  )}
                </div>
              </div>

              {/* Recent alerts on asset */}
              {(selectedAsset as Asset & { recentAlerts?: Array<{ id: string; trigger_name?: string; severity: string; status: string }> }).recentAlerts && (
                <div>
                  <p className="text-gray-400 text-xs font-medium mb-2">Alertas Recentes</p>
                  <div className="space-y-1.5">
                    {((selectedAsset as Asset & { recentAlerts?: Array<{ id: string; trigger_name?: string; severity: string; status: string }> }).recentAlerts || []).slice(0, 5).map((alert) => (
                      <div key={alert.id} className="flex items-center gap-2 text-xs">
                        <Badge variant={alert.severity === 'disaster' || alert.severity === 'high' ? 'danger' : 'warning'} size="sm">
                          {alert.severity}
                        </Badge>
                        <span className="text-gray-400 flex-1 truncate">{alert.trigger_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 sticky top-0 bg-gray-900">
              <h3 className="text-white font-semibold">Novo Ativo</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Hostname *</label>
                  <input required type="text" value={createForm.hostname}
                    onChange={e => setCreateForm(f => ({ ...f, hostname: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">IP *</label>
                  <input required type="text" value={createForm.ipAddress}
                    onChange={e => setCreateForm(f => ({ ...f, ipAddress: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Tipo de OS *</label>
                  <select value={createForm.osType} onChange={e => setCreateForm(f => ({ ...f, osType: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="linux">Linux</option>
                    <option value="windows">Windows</option>
                    <option value="network">Rede</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Versão OS</label>
                  <input type="text" value={createForm.osVersion}
                    onChange={e => setCreateForm(f => ({ ...f, osVersion: e.target.value }))}
                    placeholder="Ubuntu 22.04"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Ambiente</label>
                  <select value={createForm.environment} onChange={e => setCreateForm(f => ({ ...f, environment: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="production">Produção</option>
                    <option value="staging">Homologação</option>
                    <option value="development">Desenvolvimento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Site</label>
                  <input type="text" value={createForm.site} onChange={e => setCreateForm(f => ({ ...f, site: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Cliente</label>
                <input type="text" value={createForm.client} onChange={e => setCreateForm(f => ({ ...f, client: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Serviços (separados por vírgula)</label>
                <input type="text" value={createForm.services} onChange={e => setCreateForm(f => ({ ...f, services: e.target.value }))}
                  placeholder="nginx, postgresql, redis"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
                <Button variant="primary" size="sm" type="submit" loading={createLoading}>Criar Ativo</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assets;
