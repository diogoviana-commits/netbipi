import React, { useState, useEffect } from 'react';
import {
  Network as NetworkIcon, Activity, Globe, Wifi, Route,
  CheckCircle, XCircle, Clock, Play, History,
} from 'lucide-react';
import { networkApi } from '../services/api';
import { NetworkDiagnostic } from '../types';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import Button from '../components/ui/Button';

interface DiagResult {
  target: string;
  result: string;
  status: 'success' | 'failed' | 'timeout';
  type: string;
  port?: number;
}

const StatusIcon: React.FC<{ status?: string }> = ({ status }) => {
  if (status === 'success') return <CheckCircle size={16} className="text-emerald-400" />;
  if (status === 'failed') return <XCircle size={16} className="text-red-400" />;
  if (status === 'timeout') return <Clock size={16} className="text-yellow-400" />;
  return null;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

const COMMON_PORTS = [
  { port: 22, name: 'SSH' }, { port: 80, name: 'HTTP' }, { port: 443, name: 'HTTPS' },
  { port: 3306, name: 'MySQL' }, { port: 5432, name: 'PostgreSQL' }, { port: 6379, name: 'Redis' },
  { port: 389, name: 'LDAP' }, { port: 636, name: 'LDAPS' }, { port: 25, name: 'SMTP' },
  { port: 53, name: 'DNS' }, { port: 161, name: 'SNMP' }, { port: 3389, name: 'RDP' },
];

const Network: React.FC = () => {
  const [history, setHistory] = useState<NetworkDiagnostic[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Ping
  const [pingTarget, setPingTarget] = useState('');
  const [pingResult, setPingResult] = useState<DiagResult | null>(null);
  const [pingLoading, setPingLoading] = useState(false);

  // DNS
  const [dnsTarget, setDnsTarget] = useState('');
  const [dnsResult, setDnsResult] = useState<DiagResult | null>(null);
  const [dnsLoading, setDnsLoading] = useState(false);

  // Port
  const [portHost, setPortHost] = useState('');
  const [portNum, setPortNum] = useState('');
  const [portResult, setPortResult] = useState<DiagResult | null>(null);
  const [portLoading, setPortLoading] = useState(false);

  // Traceroute
  const [traceTarget, setTraceTarget] = useState('');
  const [traceResult, setTraceResult] = useState<DiagResult | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await networkApi.getDiagnosticHistory(20);
      setHistory(res.data || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const runPing = async () => {
    if (!pingTarget.trim()) return;
    setPingLoading(true);
    setPingResult(null);
    try {
      const res = await networkApi.runPing(pingTarget);
      setPingResult(res.data);
      fetchHistory();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setPingResult({ target: pingTarget, result: e.response?.data?.error || 'Erro ao executar ping', status: 'failed', type: 'ping' });
    } finally {
      setPingLoading(false);
    }
  };

  const runDns = async () => {
    if (!dnsTarget.trim()) return;
    setDnsLoading(true);
    setDnsResult(null);
    try {
      const res = await networkApi.runDnsLookup(dnsTarget);
      setDnsResult(res.data);
      fetchHistory();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setDnsResult({ target: dnsTarget, result: e.response?.data?.error || 'Erro ao executar DNS lookup', status: 'failed', type: 'dns' });
    } finally {
      setDnsLoading(false);
    }
  };

  const runPort = async () => {
    if (!portHost.trim() || !portNum) return;
    setPortLoading(true);
    setPortResult(null);
    try {
      const res = await networkApi.runPortCheck(portHost, parseInt(portNum));
      setPortResult(res.data);
      fetchHistory();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setPortResult({ target: portHost, result: e.response?.data?.error || 'Erro', status: 'failed', type: 'port' });
    } finally {
      setPortLoading(false);
    }
  };

  const runTrace = async () => {
    if (!traceTarget.trim()) return;
    setTraceLoading(true);
    setTraceResult(null);
    try {
      const res = await networkApi.runTraceroute(traceTarget);
      setTraceResult(res.data);
      fetchHistory();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setTraceResult({ target: traceTarget, result: e.response?.data?.error || 'Erro', status: 'failed', type: 'traceroute' });
    } finally {
      setTraceLoading(false);
    }
  };

  const ResultBlock: React.FC<{ result: DiagResult | null; loading: boolean }> = ({ result, loading }) => {
    if (loading) return <div className="flex items-center gap-2 text-gray-500 text-sm mt-2"><LoadingSpinner size="sm" /> Executando...</div>;
    if (!result) return null;
    return (
      <div className={`mt-3 rounded-lg border p-3 ${result.status === 'success' ? 'border-emerald-600/30 bg-emerald-600/5' : result.status === 'timeout' ? 'border-yellow-600/30 bg-yellow-600/5' : 'border-red-600/30 bg-red-600/5'}`}>
        <div className="flex items-center gap-2 mb-2">
          <StatusIcon status={result.status} />
          <span className={`text-xs font-medium ${result.status === 'success' ? 'text-emerald-400' : result.status === 'timeout' ? 'text-yellow-400' : 'text-red-400'}`}>
            {result.status === 'success' ? 'Sucesso' : result.status === 'timeout' ? 'Timeout' : 'Falhou'}
          </span>
          <span className="text-gray-500 text-xs ml-auto">{result.target}</span>
        </div>
        <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
          {result.result}
        </pre>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-white font-bold text-xl flex items-center gap-2">
          <NetworkIcon size={20} className="text-emerald-400" />
          Diagnósticos de Rede
        </h2>
        <p className="text-gray-500 text-sm">Ferramentas de diagnóstico e troubleshooting</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Tools */}
        <div className="xl:col-span-2 space-y-4">
          {/* Ping */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-emerald-400" />
              <h3 className="text-white font-semibold text-sm">Ping</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="IP ou hostname (ex: 8.8.8.8)"
                value={pingTarget}
                onChange={(e) => setPingTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runPing()}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
              <Button variant="primary" size="sm" icon={<Play size={12} />} loading={pingLoading} onClick={runPing}>
                Executar
              </Button>
            </div>
            <ResultBlock result={pingResult} loading={pingLoading} />
          </div>

          {/* DNS Lookup */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe size={16} className="text-blue-400" />
              <h3 className="text-white font-semibold text-sm">DNS Lookup</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Domínio (ex: google.com)"
                value={dnsTarget}
                onChange={(e) => setDnsTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runDns()}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
              <Button variant="primary" size="sm" icon={<Play size={12} />} loading={dnsLoading} onClick={runDns}>
                Resolver
              </Button>
            </div>
            <ResultBlock result={dnsResult} loading={dnsLoading} />
          </div>

          {/* Port Check */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wifi size={16} className="text-yellow-400" />
              <h3 className="text-white font-semibold text-sm">Verificação de Porta TCP</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Host ou IP"
                value={portHost}
                onChange={(e) => setPortHost(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
              <input
                type="number"
                placeholder="Porta"
                value={portNum}
                onChange={(e) => setPortNum(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runPort()}
                className="w-24 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
              <Button variant="primary" size="sm" icon={<Play size={12} />} loading={portLoading} onClick={runPort}>
                Verificar
              </Button>
            </div>
            {/* Quick port buttons */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {COMMON_PORTS.slice(0, 8).map(p => (
                <button
                  key={p.port}
                  onClick={() => { setPortNum(String(p.port)); }}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${portNum === String(p.port) ? 'bg-yellow-600/20 border-yellow-600/40 text-yellow-400' : 'border-gray-600 text-gray-500 hover:border-gray-500 hover:text-gray-300'}`}
                >
                  {p.port}/{p.name}
                </button>
              ))}
            </div>
            <ResultBlock result={portResult} loading={portLoading} />
          </div>

          {/* Traceroute */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Route size={16} className="text-purple-400" />
              <h3 className="text-white font-semibold text-sm">Traceroute</h3>
              <span className="text-gray-600 text-xs">(pode ser lento)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="IP ou hostname de destino"
                value={traceTarget}
                onChange={(e) => setTraceTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runTrace()}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
              <Button variant="primary" size="sm" icon={<Play size={12} />} loading={traceLoading} onClick={runTrace}>
                Rastrear
              </Button>
            </div>
            <ResultBlock result={traceResult} loading={traceLoading} />
          </div>

          {/* Quick reference */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-3">Referência Rápida</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-xs font-medium mb-2">Portas Comuns</p>
                <div className="space-y-1">
                  {COMMON_PORTS.map(p => (
                    <div key={p.port} className="flex justify-between text-xs">
                      <span className="text-gray-400 font-mono">{p.port}</span>
                      <span className="text-gray-600">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs font-medium mb-2">DNS Públicos</p>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between"><span className="text-gray-400">8.8.8.8</span><span className="text-gray-600">Google</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">1.1.1.1</span><span className="text-gray-600">Cloudflare</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">208.67.222.222</span><span className="text-gray-600">OpenDNS</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">9.9.9.9</span><span className="text-gray-600">Quad9</span></div>
                </div>
                <p className="text-gray-500 text-xs font-medium mb-2 mt-3">Troubleshooting</p>
                <div className="space-y-1 text-xs text-gray-500">
                  <p>1. Verificar conectividade (ping gateway)</p>
                  <p>2. Testar resolução DNS</p>
                  <p>3. Checar portas de serviços</p>
                  <p>4. Traceroute para mapa de rota</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: History */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden h-fit sticky top-0">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-700">
            <History size={16} className="text-gray-400" />
            <h3 className="text-white font-semibold text-sm">Histórico</h3>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
            ) : history.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Nenhum diagnóstico executado</p>
            ) : (
              <div className="divide-y divide-gray-700/50">
                {history.map((diag) => (
                  <div key={diag.id} className="px-4 py-3 hover:bg-gray-700/20 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={diag.status} />
                        <span className="text-gray-300 text-xs font-mono">{diag.target}</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        diag.type === 'ping' ? 'text-emerald-400 bg-emerald-600/10' :
                        diag.type === 'dns' ? 'text-blue-400 bg-blue-600/10' :
                        diag.type === 'port' ? 'text-yellow-400 bg-yellow-600/10' :
                        'text-purple-400 bg-purple-600/10'
                      }`}>
                        {diag.type}
                      </span>
                    </div>
                    <p className="text-gray-600 text-xs">{formatDate(diag.executed_at || diag.executedAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Network;
