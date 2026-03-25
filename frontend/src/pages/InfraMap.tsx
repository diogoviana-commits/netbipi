import React, { useState, useEffect, useCallback } from 'react';
import { Map as MapIcon, AlertTriangle, Server, Monitor, Wifi, RefreshCw, X, Info } from 'lucide-react';
import { assetsApi } from '../services/api';

interface Asset {
  id: string;
  hostname: string;
  ip_address: string;
  os_type: string;
  environment: string;
  site: string;
  client: string;
  is_active: boolean;
  services?: string[];
}

interface NodePosition {
  x: number;
  y: number;
}

const ENV_COLORS: Record<string, { border: string; bg: string; badge: string }> = {
  production: { border: 'border-blue-500', bg: 'bg-blue-950/40', badge: 'bg-blue-500/20 text-blue-400' },
  staging: { border: 'border-yellow-500', bg: 'bg-yellow-950/20', badge: 'bg-yellow-500/20 text-yellow-400' },
  development: { border: 'border-gray-600', bg: 'bg-gray-800/40', badge: 'bg-gray-500/20 text-gray-400' },
  homologacao: { border: 'border-purple-500', bg: 'bg-purple-950/20', badge: 'bg-purple-500/20 text-purple-400' },
};

const getEnvColors = (env: string) => ENV_COLORS[env?.toLowerCase()] || ENV_COLORS.development;

const getOsIcon = (osType: string) => {
  switch (osType?.toLowerCase()) {
    case 'linux': return <Server size={20} className="text-orange-400" />;
    case 'windows': return <Monitor size={20} className="text-blue-400" />;
    case 'network': return <Wifi size={20} className="text-cyan-400" />;
    default: return <Server size={20} className="text-gray-400" />;
  }
};

const computePositions = (assets: Asset[]): Map<string, NodePosition> => {
  const positions = new Map<string, NodePosition>();
  const groupedBySite: Record<string, Asset[]> = {};

  assets.forEach((a) => {
    const key = a.site || a.client || 'default';
    if (!groupedBySite[key]) groupedBySite[key] = [];
    groupedBySite[key].push(a);
  });

  const groups = Object.entries(groupedBySite);
  const colsPerRow = Math.ceil(Math.sqrt(groups.length));
  const NODE_W = 160;
  const NODE_H = 100;
  const H_GAP = 200;
  const V_GAP = 150;
  const GROUP_PAD = 60;

  groups.forEach(([, groupAssets], gi) => {
    const groupCol = gi % colsPerRow;
    const groupRow = Math.floor(gi / colsPerRow);
    const maxPerRow = 4;

    groupAssets.forEach((asset, ai) => {
      const col = ai % maxPerRow;
      const row = Math.floor(ai / maxPerRow);
      const x = groupCol * (maxPerRow * NODE_W + H_GAP) + col * (NODE_W + 20) + GROUP_PAD;
      const y = groupRow * (3 * NODE_H + V_GAP) + row * (NODE_H + 20) + GROUP_PAD;
      positions.set(asset.id, { x, y });
    });
  });

  return positions;
};

const FILTERS = ['Todos', 'production', 'staging', 'development'];

const InfraMap: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [envFilter, setEnvFilter] = useState('Todos');
  const [positions, setPositions] = useState<Map<string, NodePosition>>(new Map());
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await assetsApi.getAssets({ limit: '200' });
      const list: Asset[] = res.data.assets || res.data || [];
      setAssets(list);
      setPositions(computePositions(list));
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const filtered = envFilter === 'Todos' ? assets : assets.filter((a) => a.environment?.toLowerCase() === envFilter);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).closest('.node')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setTranslate({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(0.3, Math.min(2, s - e.deltaY * 0.001)));
  };

  const fitView = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-[calc(100vh-200px)]">
        <RefreshCw size={32} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-3">
          <MapIcon size={20} className="text-emerald-400" />
          <div>
            <h1 className="text-white font-bold">Mapa de Infraestrutura</h1>
            <p className="text-gray-500 text-xs">{assets.length} ativos carregados</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter */}
          <div className="flex items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setEnvFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  envFilter === f
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {f === 'Todos' ? 'Todos' : f}
              </button>
            ))}
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg border border-gray-700">
            <button onClick={() => setScale((s) => Math.min(2, s + 0.1))} className="px-3 py-1.5 text-gray-400 hover:text-white text-sm">+</button>
            <span className="text-gray-500 text-xs px-2">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale((s) => Math.max(0.3, s - 0.1))} className="px-3 py-1.5 text-gray-400 hover:text-white text-sm">−</button>
            <button onClick={fitView} className="px-3 py-1.5 text-gray-400 hover:text-emerald-400 text-xs border-l border-gray-700">Ajustar</button>
          </div>

          <button onClick={fetchAssets} className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg text-xs transition-colors">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Map canvas */}
      <div className="flex-1 relative overflow-hidden bg-gray-950">
        {/* Legend */}
        <div className="absolute top-4 left-4 z-10 bg-gray-900/90 border border-gray-700 rounded-lg p-3 text-xs space-y-2">
          <p className="text-gray-400 font-semibold mb-2">Legenda</p>
          <div className="flex items-center gap-2"><Server size={12} className="text-orange-400" /><span className="text-gray-400">Linux</span></div>
          <div className="flex items-center gap-2"><Monitor size={12} className="text-blue-400" /><span className="text-gray-400">Windows</span></div>
          <div className="flex items-center gap-2"><Wifi size={12} className="text-cyan-400" /><span className="text-gray-400">Rede</span></div>
          <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm border-2 border-blue-500" /><span className="text-gray-400">Produção</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm border-2 border-yellow-500" /><span className="text-gray-400">Staging</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm border-2 border-gray-600" /><span className="text-gray-400">Dev</span></div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MapIcon size={48} className="text-gray-700 mb-4" />
            <p className="text-gray-400">Nenhum ativo para exibir</p>
            <p className="text-gray-600 text-sm mt-1">Adicione ativos no inventário para visualizá-los no mapa</p>
          </div>
        ) : (
          <svg
            className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <g transform={`translate(${translate.x},${translate.y}) scale(${scale})`}>
              {/* Edges: connect assets in same site */}
              {filtered.map((a1, i) =>
                filtered.slice(i + 1).map((a2) => {
                  if (!a1.site || a1.site !== a2.site) return null;
                  const p1 = positions.get(a1.id);
                  const p2 = positions.get(a2.id);
                  if (!p1 || !p2) return null;
                  return (
                    <line
                      key={`edge-${a1.id}-${a2.id}`}
                      x1={p1.x + 70}
                      y1={p1.y + 40}
                      x2={p2.x + 70}
                      y2={p2.y + 40}
                      stroke="#374151"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                  );
                })
              )}

              {/* Nodes */}
              {filtered.map((asset) => {
                const pos = positions.get(asset.id) || { x: 0, y: 0 };
                const colors = getEnvColors(asset.environment);
                const isSelected = selectedAsset?.id === asset.id;

                return (
                  <g
                    key={asset.id}
                    className="node"
                    transform={`translate(${pos.x},${pos.y})`}
                    onClick={() => setSelectedAsset(isSelected ? null : asset)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect
                      width={140}
                      height={80}
                      rx={8}
                      fill={isSelected ? '#064e3b' : '#1f2937'}
                      stroke={isSelected ? '#059669' : (colors.border.replace('border-', '').includes('blue') ? '#3b82f6' : colors.border.includes('yellow') ? '#eab308' : '#4b5563')}
                      strokeWidth={isSelected ? 2 : 1.5}
                    />
                    {/* Icon + hostname */}
                    <foreignObject x={10} y={10} width={120} height={60}>
                      <div className="flex flex-col items-center justify-center h-full gap-1">
                        <div className="flex items-center gap-1.5">
                          {getOsIcon(asset.os_type)}
                        </div>
                        <span className="text-white text-xs font-medium text-center leading-tight px-1 truncate w-full text-center">
                          {asset.hostname}
                        </span>
                        <span className="text-gray-500 text-[10px] font-mono">{asset.ip_address}</span>
                      </div>
                    </foreignObject>
                    {/* Status dot */}
                    <circle
                      cx={125}
                      cy={12}
                      r={5}
                      fill={asset.is_active ? '#059669' : '#dc2626'}
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      {/* Side panel for selected asset */}
      {selectedAsset && (
        <div className="absolute top-[120px] right-4 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-20 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              {getOsIcon(selectedAsset.os_type)}
              <div>
                <p className="text-white font-semibold text-sm">{selectedAsset.hostname}</p>
                <p className="text-gray-500 text-xs font-mono">{selectedAsset.ip_address}</p>
              </div>
            </div>
            <button onClick={() => setSelectedAsset(null)} className="text-gray-500 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-gray-600 text-xs">Ambiente</p>
                <span className={`text-xs px-2 py-0.5 rounded ${getEnvColors(selectedAsset.environment).badge}`}>
                  {selectedAsset.environment || 'N/A'}
                </span>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Sistema</p>
                <p className="text-gray-300 text-xs">{selectedAsset.os_type}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Site</p>
                <p className="text-gray-300 text-xs">{selectedAsset.site || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Cliente</p>
                <p className="text-gray-300 text-xs">{selectedAsset.client || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs">Status</p>
                <span className={`text-xs flex items-center gap-1 ${selectedAsset.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${selectedAsset.is_active ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {selectedAsset.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
            {selectedAsset.services && selectedAsset.services.length > 0 && (
              <div>
                <p className="text-gray-600 text-xs mb-1">Serviços</p>
                <div className="flex flex-wrap gap-1">
                  {selectedAsset.services.map((s) => (
                    <span key={s} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="pt-2 border-t border-gray-800 flex items-center gap-1 text-gray-600">
              <Info size={11} />
              <span className="text-xs">Clique em outro nó para selecionar</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfraMap;
