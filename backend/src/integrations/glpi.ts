import axios, { AxiosError } from 'axios';
import { env } from '../config/env';

// ============================================================
// Types
// ============================================================
export interface GLPITicket {
  id: number;
  name: string;
  content: string;
  status: number;    // 1=new, 2=processing(assigned), 3=processing(planned), 4=pending, 5=solved, 6=closed
  priority: number;  // 1=very low, 2=low, 3=medium, 4=high, 5=very high, 6=major
  urgency: number;
  impact: number;
  date_creation: string;
  date_mod: string;
  solvedate?: string;
  closedate?: string;
  itilcategories_id?: number;
  users_id_lastupdater?: number;
}

export interface GLPICreateResponse {
  id: number;
  message: string;
}

export interface GLPIFollowupResponse {
  id: number;
  message: string;
}

// ============================================================
// Status / Priority maps
// ============================================================
export const GLPI_STATUS_MAP: Record<number, string> = {
  1: 'open',
  2: 'in_progress',
  3: 'in_progress',
  4: 'open',        // pending
  5: 'resolved',
  6: 'closed',
};

export const GLPI_STATUS_REVERSE: Record<string, number> = {
  open: 1,
  in_progress: 2,
  resolved: 5,
  closed: 6,
};

export const GLPI_PRIORITY_MAP: Record<string, number> = {
  low: 2,
  medium: 3,
  high: 4,
  critical: 6,
};

// ============================================================
// Demo data
// ============================================================
const DEMO_TICKETS: GLPITicket[] = [
  {
    id: 1001, name: '[AUTO] Nginx fora no web-server-01',
    content: 'Chamado criado automaticamente. Serviço nginx não responde.',
    status: 2, priority: 5, urgency: 4, impact: 4,
    date_creation: new Date(Date.now() - 3600000).toISOString(),
    date_mod: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 1002, name: 'Usuário sem acesso à VPN após atualização',
    content: 'Usuário João relata que não consegue conectar à VPN desde ontem.',
    status: 1, priority: 3, urgency: 3, impact: 2,
    date_creation: new Date(Date.now() - 7200000).toISOString(),
    date_mod: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 1003, name: 'Disco cheio no servidor de banco de dados',
    content: 'Alerta de 90% de uso em /var/lib/postgresql. Necessário limpeza urgente.',
    status: 5, priority: 4, urgency: 5, impact: 4,
    date_creation: new Date(Date.now() - 86400000).toISOString(),
    date_mod: new Date(Date.now() - 3600000).toISOString(),
    solvedate: new Date(Date.now() - 3600000).toISOString(),
  },
];

// ============================================================
// Session management
// ============================================================
let sessionToken: string | null = null;

const getSession = async (): Promise<string> => {
  if (env.MOCK_INTEGRATIONS) return 'demo-glpi-session-token';

  if (sessionToken) return sessionToken;

  try {
    const response = await axios.get(`${env.GLPI_URL}/initSession`, {
      headers: {
        'App-Token': env.GLPI_APP_TOKEN,
        Authorization: `user_token ${env.GLPI_USER_TOKEN}`,
      },
      timeout: 10000,
    });
    sessionToken = response.data.session_token;
    console.log('[GLPI] Sessão iniciada com sucesso');
    return sessionToken as string;
  } catch (err) {
    console.error('[GLPI] initSession falhou:', (err as AxiosError).message);
    sessionToken = null;
    throw err;
  }
};

const killSession = async (): Promise<void> => {
  if (!sessionToken || env.MOCK_INTEGRATIONS) return;
  try {
    await axios.get(`${env.GLPI_URL}/killSession`, {
      headers: {
        'App-Token': env.GLPI_APP_TOKEN,
        'Session-Token': sessionToken,
      },
    });
  } catch {}
  sessionToken = null;
};

// Helper to perform API calls with automatic session refresh on 401
const glpiCall = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  endpoint: string,
  data?: unknown,
  retried = false,
): Promise<T> => {
  if (env.MOCK_INTEGRATIONS) throw new Error('DEMO_MODE');

  const token = await getSession();

  try {
    const response = await axios.request<T>({
      method,
      url: `${env.GLPI_URL}/${endpoint}`,
      headers: {
        'App-Token': env.GLPI_APP_TOKEN,
        'Session-Token': token,
        'Content-Type': 'application/json',
      },
      data,
      timeout: 10000,
    });
    return response.data;
  } catch (err) {
    const axiosErr = err as AxiosError;
    // Session expired — refresh once
    if (axiosErr.response?.status === 401 && !retried) {
      sessionToken = null;
      return glpiCall<T>(method, endpoint, data, true);
    }
    throw err;
  }
};

// ============================================================
// Create ticket
// ============================================================
export const createTicket = async (
  title: string,
  description: string,
  priority: string,
  assetHostname?: string,
): Promise<GLPICreateResponse> => {
  if (env.MOCK_INTEGRATIONS) {
    const demoId = Math.floor(Math.random() * 9000) + 1000;
    console.log(`[GLPI Demo] Chamado #${demoId} criado: ${title}`);
    return { id: demoId, message: `Chamado #${demoId} criado com sucesso (demo)` };
  }

  try {
    const response = await glpiCall<GLPICreateResponse>('POST', 'Ticket', {
      input: {
        name: title,
        content: description,
        priority: GLPI_PRIORITY_MAP[priority] ?? 3,
        urgency: GLPI_PRIORITY_MAP[priority] ?? 3,
        impact: GLPI_PRIORITY_MAP[priority] ?? 3,
        type: 1, // Incident
        ...(assetHostname && { comment: `Host: ${assetHostname}` }),
      },
    });
    console.log(`[GLPI] Chamado criado: #${response.id}`);
    return response;
  } catch (err) {
    console.error('[GLPI] createTicket falhou:', (err as Error).message);
    throw err;
  }
};

// ============================================================
// Update ticket
// ============================================================
export const updateTicket = async (
  id: string | number,
  updates: { status?: string; priority?: string; assigneeUserId?: number },
): Promise<boolean> => {
  if (env.MOCK_INTEGRATIONS) {
    console.log(`[GLPI Demo] Chamado #${id} atualizado:`, updates);
    return true;
  }

  try {
    const input: Record<string, unknown> = {};
    if (updates.status) input.status = GLPI_STATUS_REVERSE[updates.status] ?? 2;
    if (updates.priority) input.priority = GLPI_PRIORITY_MAP[updates.priority] ?? 3;
    if (updates.assigneeUserId) input.users_id_assign = updates.assigneeUserId;

    await glpiCall('PUT', `Ticket/${id}`, { input });
    return true;
  } catch (err) {
    console.error('[GLPI] updateTicket falhou:', (err as Error).message);
    return false;
  }
};

// ============================================================
// Close ticket
// ============================================================
export const closeTicket = async (id: string | number, solution: string): Promise<boolean> => {
  if (env.MOCK_INTEGRATIONS) {
    console.log(`[GLPI Demo] Chamado #${id} encerrado`);
    return true;
  }

  try {
    // Add solution first
    await glpiCall('POST', `Ticket/${id}/ITILSolution`, {
      input: { itemtype: 'Ticket', items_id: id, content: solution },
    });
    // Then close
    await glpiCall('PUT', `Ticket/${id}`, { input: { status: 6 } });
    return true;
  } catch (err) {
    console.error('[GLPI] closeTicket falhou:', (err as Error).message);
    return false;
  }
};

// ============================================================
// Get single ticket
// ============================================================
export const getTicket = async (id: string | number): Promise<GLPITicket | null> => {
  if (env.MOCK_INTEGRATIONS) {
    const found = DEMO_TICKETS.find((t) => t.id === Number(id));
    return found ?? { id: Number(id), name: `Chamado GLPI #${id}`, content: 'Conteúdo do chamado', status: 2, priority: 3, urgency: 3, impact: 3, date_creation: new Date().toISOString(), date_mod: new Date().toISOString() };
  }

  try {
    return await glpiCall<GLPITicket>('GET', `Ticket/${id}`);
  } catch (err) {
    console.error('[GLPI] getTicket falhou:', (err as Error).message);
    return null;
  }
};

// ============================================================
// List tickets from GLPI (for sync)
// ============================================================
export const listTickets = async (limit = 50, onlyOpen = false): Promise<GLPITicket[]> => {
  if (env.MOCK_INTEGRATIONS) return DEMO_TICKETS;

  try {
    const params = new URLSearchParams({
      'range': `0-${limit - 1}`,
      'sort': 'date_mod',
      'order': 'DESC',
      ...(onlyOpen && { 'searchText[status]': '1,2,3,4' }),
    });

    const response = await glpiCall<GLPITicket[] | { data: GLPITicket[] }>(
      'GET',
      `Ticket?${params.toString()}`,
    );

    return Array.isArray(response) ? response : (response as { data: GLPITicket[] }).data ?? [];
  } catch (err) {
    console.error('[GLPI] listTickets falhou:', (err as Error).message);
    return [];
  }
};

// ============================================================
// Add followup (comment)
// ============================================================
export const addFollowup = async (
  ticketId: string | number,
  content: string,
  isPrivate = true,
): Promise<boolean> => {
  if (env.MOCK_INTEGRATIONS) {
    console.log(`[GLPI Demo] Acompanhamento adicionado ao chamado #${ticketId}`);
    return true;
  }

  try {
    await glpiCall('POST', `Ticket/${ticketId}/ITILFollowup`, {
      input: {
        items_id: ticketId,
        itemtype: 'Ticket',
        content,
        is_private: isPrivate ? 1 : 0,
      },
    });
    return true;
  } catch (err) {
    console.error('[GLPI] addFollowup falhou:', (err as Error).message);
    return false;
  }
};

// ============================================================
// Assign ticket to user
// ============================================================
export const assignTicket = async (
  ticketId: string | number,
  glpiUserId: number,
): Promise<boolean> => {
  if (env.MOCK_INTEGRATIONS) {
    console.log(`[GLPI Demo] Chamado #${ticketId} atribuído ao usuário #${glpiUserId}`);
    return true;
  }

  try {
    await glpiCall('POST', `Ticket/${ticketId}/Ticket_User`, {
      input: { tickets_id: ticketId, users_id: glpiUserId, type: 2 }, // type 2 = assigned
    });
    return true;
  } catch (err) {
    console.error('[GLPI] assignTicket falhou:', (err as Error).message);
    return false;
  }
};

// ============================================================
// Get GLPI API version / health
// ============================================================
export const getApiStatus = async (): Promise<{ version: string; available: boolean }> => {
  if (env.MOCK_INTEGRATIONS) return { version: '10.x (demo)', available: true };

  try {
    const response = await axios.get(`${env.GLPI_URL}/`, {
      headers: { 'App-Token': env.GLPI_APP_TOKEN },
      timeout: 5000,
    });
    return { version: response.data?.api_version ?? 'unknown', available: true };
  } catch {
    return { version: 'unavailable', available: false };
  }
};

// Cleanup on process exit
process.on('exit', killSession);

export const getDemoTickets = (): GLPITicket[] => DEMO_TICKETS;
