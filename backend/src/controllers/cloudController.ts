import { Request, Response } from 'express';
import { env } from '../config/env';

const generateTimeseries = (hours = 24) => {
  const data = [];
  const now = Date.now();
  for (let i = hours; i >= 0; i--) {
    const ts = new Date(now - i * 60 * 60 * 1000).toISOString();
    data.push({
      timestamp: ts,
      cpu: Math.round(20 + Math.random() * 60),
      memory: Math.round(30 + Math.random() * 50),
      network_in: Math.round(Math.random() * 500),
      network_out: Math.round(Math.random() * 300),
    });
  }
  return data;
};

export const getCloudStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!env.MOCK_INTEGRATIONS) {
      res.status(503).json({
        error: 'Painel de nuvem indisponível neste ambiente. Ative o modo de demonstração local ou conecte um provedor real.',
      });
      return;
    }

    const status = {
      aws: {
        available: true,
        region: 'sa-east-1',
        instances: [
          { id: 'i-0abc123', name: 'web-prod-01', type: 't3.medium', state: 'running', cpu: 45, uptime: '15d 3h' },
          { id: 'i-0def456', name: 'db-prod-01', type: 't3.large', state: 'running', cpu: 78, uptime: '30d 1h' },
          { id: 'i-0ghi789', name: 'worker-01', type: 't3.small', state: 'stopped', cpu: 0, uptime: '0' },
        ],
        alerts: 2,
        cost_month: 847.50,
        last_updated: new Date().toISOString(),
      },
      azure: {
        available: true,
        region: 'brazilsouth',
        vms: [
          { id: 'vm-app-01', name: 'app-server-azure', size: 'Standard_B2s', state: 'running', cpu: 32 },
          { id: 'vm-sql-01', name: 'sql-server-azure', size: 'Standard_D2s_v3', state: 'running', cpu: 55 },
        ],
        alerts: 0,
        cost_month: 423.20,
        last_updated: new Date().toISOString(),
      },
      is_demo: true,
    };
    res.json(status);
  } catch (err) {
    console.error('[Cloud] Erro ao buscar status:', err);
    res.status(500).json({ error: 'Erro ao buscar status da nuvem' });
  }
};

export const getCloudMetrics = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!env.MOCK_INTEGRATIONS) {
      res.status(503).json({
        error: 'Métricas de cloud indisponíveis neste ambiente.',
      });
      return;
    }

    const metrics = {
      aws: {
        'web-prod-01': generateTimeseries(24),
        'db-prod-01': generateTimeseries(24),
      },
      azure: {
        'app-server-azure': generateTimeseries(24),
        'sql-server-azure': generateTimeseries(24),
      },
      is_demo: true,
    };
    res.json(metrics);
  } catch (err) {
    console.error('[Cloud] Erro ao buscar métricas:', err);
    res.status(500).json({ error: 'Erro ao buscar métricas da nuvem' });
  }
};

export const getCloudAlerts = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!env.MOCK_INTEGRATIONS) {
      res.status(503).json({
        error: 'Alertas de cloud indisponíveis neste ambiente.',
      });
      return;
    }

    const alerts = {
      aws_cloudwatch: [
        {
          id: 'cw-001',
          name: 'Alta utilização de CPU — db-prod-01',
          severity: 'high',
          instance: 'db-prod-01',
          metric: 'CPUUtilization',
          threshold: '80%',
          current: '78%',
          state: 'ALARM',
          triggered_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        },
        {
          id: 'cw-002',
          name: 'StatusCheckFailed — web-prod-01',
          severity: 'critical',
          instance: 'web-prod-01',
          metric: 'StatusCheckFailed',
          threshold: '1',
          current: '1',
          state: 'ALARM',
          triggered_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        },
      ],
      azure_monitor: [],
      is_demo: true,
    };
    res.json(alerts);
  } catch (err) {
    console.error('[Cloud] Erro ao buscar alertas:', err);
    res.status(500).json({ error: 'Erro ao buscar alertas da nuvem' });
  }
};
