import axios from 'axios';
import { env } from '../config/env';

// ============================================================
// Types
// ============================================================
export interface ZabbixProblem {
  eventid: string;
  objectid: string;
  clock: string;
  name: string;
  severity: string;
  acknowledged: string;
  hosts?: Array<{ hostid: string; host: string; name: string }>;
  tags?: Array<{ tag: string; value: string }>;
  r_eventid?: string; // recovery event id, present if resolved
}

export interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
  interfaces: Array<{ ip: string; port: string; type: string }>;
  status: string; // '0' = enabled, '1' = disabled
  groups?: Array<{ groupid: string; name: string }>;
  available: string; // '0' = unknown, '1' = available, '2' = unavailable
}

export interface ZabbixTrigger {
  triggerid: string;
  description: string;
  priority: string;
  status: string;
  value: string; // '0' = OK, '1' = PROBLEM
  lastchange: string;
  hosts: Array<{ hostid: string; host: string; name: string }>;
}

// ============================================================
// Severity mapping (Zabbix numeric -> NetBIPI string)
// ============================================================
export const ZABBIX_SEVERITY_MAP: Record<string, string> = {
  '0': 'info',        // Not classified
  '1': 'info',        // Information
  '2': 'warning',     // Warning
  '3': 'average',     // Average
  '4': 'high',        // High
  '5': 'disaster',    // Disaster
};

// ============================================================
// Demo Data
// ============================================================
const DEMO_PROBLEMS: ZabbixProblem[] = [
  {
    eventid: 'zbx-10001',
    objectid: 'trigger-001',
    clock: String(Math.floor(Date.now() / 1000) - 300),
    name: 'Nginx está fora no servidor web-server-01',
    severity: '5',
    acknowledged: '0',
    hosts: [{ hostid: 'h001', host: 'web-server-01', name: 'Web Server 01' }],
    tags: [{ tag: 'service', value: 'nginx' }],
  },
  {
    eventid: 'zbx-10002',
    objectid: 'trigger-002',
    clock: String(Math.floor(Date.now() / 1000) - 900),
    name: 'Uso de disco acima de 90% em /var/lib/postgresql — db-server-01',
    severity: '4',
    acknowledged: '0',
    hosts: [{ hostid: 'h002', host: 'db-server-01', name: 'Database Server 01' }],
    tags: [{ tag: 'component', value: 'storage' }],
  },
  {
    eventid: 'zbx-10003',
    objectid: 'trigger-003',
    clock: String(Math.floor(Date.now() / 1000) - 1800),
    name: 'CPU acima de 95% por 5 minutos — dc-01',
    severity: '4',
    acknowledged: '1',
    hosts: [{ hostid: 'h005', host: 'dc-01', name: 'Domain Controller 01' }],
    tags: [{ tag: 'component', value: 'cpu' }],
  },
  {
    eventid: 'zbx-10004',
    objectid: 'trigger-004',
    clock: String(Math.floor(Date.now() / 1000) - 3600),
    name: 'Túnel VPN para filial-SP está DOWN — vpn-gateway-01',
    severity: '5',
    acknowledged: '0',
    hosts: [{ hostid: 'h004', host: 'vpn-gateway-01', name: 'VPN Gateway 01' }],
    tags: [{ tag: 'service', value: 'vpn' }],
  },
  {
    eventid: 'zbx-10005',
    objectid: 'trigger-005',
    clock: String(Math.floor(Date.now() / 1000) - 7200),
    name: 'Resolução DNS falhou para internal.empresa.com — monitoring-01',
    severity: '3',
    acknowledged: '0',
    hosts: [{ hostid: 'h003', host: 'monitoring-01', name: 'Monitoring Server 01' }],
    tags: [{ tag: 'service', value: 'dns' }],
  },
  {
    eventid: 'zbx-10006',
    objectid: 'trigger-006',
    clock: String(Math.floor(Date.now() / 1000) - 14400),
    name: 'Memória disponível abaixo de 10% — fileserver-01',
    severity: '3',
    acknowledged: '0',
    hosts: [{ hostid: 'h006', host: 'fileserver-01', name: 'File Server 01' }],
    tags: [{ tag: 'component', value: 'memory' }],
  },
];

const DEMO_HOSTS: ZabbixHost[] = [
  {
    hostid: 'h001', host: 'web-server-01', name: 'Web Server 01',
    interfaces: [{ ip: '10.0.1.10', port: '10050', type: '1' }],
    status: '0', available: '1',
    groups: [{ groupid: 'g1', name: 'Linux servers' }],
  },
  {
    hostid: 'h002', host: 'db-server-01', name: 'Database Server 01',
    interfaces: [{ ip: '10.0.1.20', port: '10050', type: '1' }],
    status: '0', available: '1',
    groups: [{ groupid: 'g1', name: 'Linux servers' }],
  },
  {
    hostid: 'h003', host: 'monitoring-01', name: 'Monitoring Server 01',
    interfaces: [{ ip: '10.0.1.30', port: '10050', type: '1' }],
    status: '0', available: '1',
    groups: [{ groupid: 'g1', name: 'Linux servers' }],
  },
  {
    hostid: 'h004', host: 'vpn-gateway-01', name: 'VPN Gateway 01',
    interfaces: [{ ip: '10.0.1.1', port: '10050', type: '1' }],
    status: '0', available: '1',
    groups: [{ groupid: 'g2', name: 'Network' }],
  },
  {
    hostid: 'h005', host: 'dc-01', name: 'Domain Controller 01',
    interfaces: [{ ip: '10.0.1.5', port: '10050', type: '1' }],
    status: '0', available: '1',
    groups: [{ groupid: 'g3', name: 'Windows servers' }],
  },
  {
    hostid: 'h006', host: 'fileserver-01', name: 'File Server 01',
    interfaces: [{ ip: '10.0.1.15', port: '10050', type: '1' }],
    status: '0', available: '2',
    groups: [{ groupid: 'g3', name: 'Windows servers' }],
  },
];

// ============================================================
// Token management
// ============================================================
let authToken: string | null = null;
let tokenExpiresAt: number = 0;

const isTokenValid = (): boolean => {
  return !!authToken && Date.now() < tokenExpiresAt;
};

// ============================================================
// Core API caller
// ============================================================
const zabbixCall = async <T>(
  method: string,
  params: Record<string, unknown>,
  requireAuth = true,
): Promise<T> => {
  const payload: Record<string, unknown> = {
    jsonrpc: '2.0',
    method,
    params,
    id: Date.now(),
  };

  if (requireAuth) {
    const token = isTokenValid() ? authToken! : await authenticate();
    payload.auth = token;
  }

  const response = await axios.post(env.ZABBIX_URL, payload, {
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.data.error) {
    // Token expired — try once more
    if (response.data.error.data === 'Session terminated, re-login, please.' || response.data.error.code === -32602) {
      authToken = null;
      if (requireAuth) {
        const newToken = await authenticate();
        payload.auth = newToken;
        const retry = await axios.post(env.ZABBIX_URL, payload, { timeout: 10000 });
        if (retry.data.error) throw new Error(`Zabbix API: ${retry.data.error.message}`);
        return retry.data.result as T;
      }
    }
    throw new Error(`Zabbix API Error (${method}): ${response.data.error.message}`);
  }

  return response.data.result as T;
};

// ============================================================
// Authentication
// ============================================================
export const authenticate = async (): Promise<string> => {
  if (env.MOCK_INTEGRATIONS) {
    authToken = 'demo-zabbix-token-12345';
    tokenExpiresAt = Date.now() + 3600 * 1000;
    return authToken;
  }

  try {
    const result = await zabbixCall<string>(
      'user.login',
      { username: env.ZABBIX_USER, password: env.ZABBIX_PASSWORD },
      false,
    );
    authToken = result;
    tokenExpiresAt = Date.now() + 3600 * 1000; // 1 hour
    console.log('[Zabbix] Autenticado com sucesso');
    return authToken;
  } catch (err) {
    console.error('[Zabbix] Falha na autenticação:', (err as Error).message);
    throw err;
  }
};

// ============================================================
// Get active problems (Zabbix 4.0+ — better than trigger.get)
// ============================================================
export const getProblems = async (limit = 50): Promise<ZabbixProblem[]> => {
  if (env.MOCK_INTEGRATIONS) {
    return DEMO_PROBLEMS.slice(0, limit);
  }

  try {
    return await zabbixCall<ZabbixProblem[]>('problem.get', {
      output: 'extend',
      selectAcknowledges: ['userid', 'message', 'clock'],
      selectTags: 'extend',
      selectHosts: ['hostid', 'host', 'name'],
      recent: false,
      sortfield: ['eventid'],
      sortorder: 'DESC',
      limit,
    });
  } catch (err) {
    console.error('[Zabbix] getProblems falhou:', (err as Error).message);
    throw err;
  }
};

// Alias for backwards compatibility
export const getAlerts = getProblems;

// ============================================================
// Get all hosts
// ============================================================
export const getHosts = async (): Promise<ZabbixHost[]> => {
  if (env.MOCK_INTEGRATIONS) return DEMO_HOSTS;

  try {
    return await zabbixCall<ZabbixHost[]>('host.get', {
      output: ['hostid', 'host', 'name', 'status', 'available'],
      selectInterfaces: ['ip', 'port', 'type'],
      selectGroups: ['groupid', 'name'],
    });
  } catch (err) {
    console.error('[Zabbix] getHosts falhou:', (err as Error).message);
    throw err;
  }
};

// ============================================================
// Get triggers for a specific host
// ============================================================
export const getHostTriggers = async (hostId: string): Promise<ZabbixTrigger[]> => {
  if (env.MOCK_INTEGRATIONS) {
    return [
      { triggerid: 't001', description: 'CPU alto', priority: '4', status: '0', value: '0', lastchange: String(Date.now() / 1000), hosts: [] },
      { triggerid: 't002', description: 'Memória baixa', priority: '3', status: '0', value: '0', lastchange: String(Date.now() / 1000), hosts: [] },
    ];
  }

  try {
    return await zabbixCall<ZabbixTrigger[]>('trigger.get', {
      output: ['triggerid', 'description', 'priority', 'status', 'value', 'lastchange'],
      selectHosts: ['hostid', 'host', 'name'],
      hostids: [hostId],
      only_true: 0,
      sortfield: 'priority',
      sortorder: 'DESC',
    });
  } catch (err) {
    console.error('[Zabbix] getHostTriggers falhou:', (err as Error).message);
    return [];
  }
};

// ============================================================
// Acknowledge event
// ============================================================
export const acknowledgeEvent = async (
  eventId: string,
  message: string,
): Promise<boolean> => {
  if (env.MOCK_INTEGRATIONS) {
    console.log(`[Zabbix Demo] Evento ${eventId} reconhecido: ${message}`);
    return true;
  }

  try {
    await zabbixCall('event.acknowledge', {
      eventids: [eventId],
      action: 6, // 2=acknowledge + 4=add message
      message,
    });
    return true;
  } catch (err) {
    console.error('[Zabbix] acknowledgeEvent falhou:', (err as Error).message);
    return false;
  }
};

// ============================================================
// Get API version
// ============================================================
export const getApiVersion = async (): Promise<string> => {
  if (env.MOCK_INTEGRATIONS) return '7.0.0 (demo)';
  try {
    return await zabbixCall<string>('apiinfo.version', {}, false);
  } catch {
    return 'unavailable';
  }
};

// ============================================================
// Get host groups
// ============================================================
export const getHostGroups = async () => {
  if (env.MOCK_INTEGRATIONS) {
    return [
      { groupid: 'g1', name: 'Linux servers' },
      { groupid: 'g2', name: 'Network' },
      { groupid: 'g3', name: 'Windows servers' },
    ];
  }
  try {
    return await zabbixCall<Array<{ groupid: string; name: string }>>('hostgroup.get', {
      output: ['groupid', 'name'],
      sortfield: 'name',
    });
  } catch (err) {
    console.error('[Zabbix] getHostGroups falhou:', (err as Error).message);
    return [];
  }
};

export const getDemoProblems = (): ZabbixProblem[] => DEMO_PROBLEMS;
export const getDemoHosts = (): ZabbixHost[] => DEMO_HOSTS;
