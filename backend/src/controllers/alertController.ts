import { Request, Response } from 'express';
import { query } from '../config/database';
import { logAudit } from '../services/auditService';
import { getAlerts as fetchZabbixAlerts, acknowledgeEvent } from '../integrations/zabbix';

const SEVERITY_MAP: Record<string, string> = {
  '0': 'info',
  '1': 'info',
  '2': 'warning',
  '3': 'average',
  '4': 'high',
  '5': 'disaster',
};

export const getAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { severity, status, search, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (severity) {
      conditions.push(`a.severity = $${paramIndex++}`);
      params.push(severity);
    }
    if (status) {
      conditions.push(`a.status = $${paramIndex++}`);
      params.push(status);
    }
    if (search) {
      conditions.push(`(a.trigger_name ILIKE $${paramIndex} OR a.message ILIKE $${paramIndex} OR ast.hostname ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM alerts a LEFT JOIN assets ast ON a.asset_id = ast.id ${whereClause}`,
      params
    );

    params.push(parseInt(limit as string), offset);
    const result = await query(
      `SELECT a.*, ast.hostname, ast.ip_address, ast.os_type, ast.environment
       FROM alerts a
       LEFT JOIN assets ast ON a.asset_id = ast.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (err) {
    console.error('[Alerts] getAlerts error:', err);
    res.status(500).json({ error: 'Erro ao buscar alertas' });
  }
};

export const getAlertById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT a.*, ast.hostname, ast.ip_address, ast.os_type, ast.environment, ast.site, ast.client
       FROM alerts a
       LEFT JOIN assets ast ON a.asset_id = ast.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Alerta não encontrado' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Alerts] getAlertById error:', err);
    res.status(500).json({ error: 'Erro ao buscar alerta' });
  }
};

export const acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { id } = req.params;
    const { message = 'Alerta reconhecido' } = req.body;

    const existing = await query('SELECT * FROM alerts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Alerta não encontrado' });
      return;
    }

    const alert = existing.rows[0];

    if (alert.zabbix_event_id) {
      await acknowledgeEvent(alert.zabbix_event_id, message);
    }

    const result = await query(
      `UPDATE alerts
       SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.userId, id]
    );

    await logAudit(req.user.userId, 'ACKNOWLEDGE_ALERT', 'alert', id, { message }, req.ip);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Alerts] acknowledgeAlert error:', err);
    res.status(500).json({ error: 'Erro ao reconhecer alerta' });
  }
};

export const resolveAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { id } = req.params;

    const existing = await query('SELECT * FROM alerts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Alerta não encontrado' });
      return;
    }

    const result = await query(
      `UPDATE alerts
       SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await logAudit(req.user.userId, 'RESOLVE_ALERT', 'alert', id, {}, req.ip);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Alerts] resolveAlert error:', err);
    res.status(500).json({ error: 'Erro ao resolver alerta' });
  }
};

export const syncFromZabbix = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const zabbixAlerts = await fetchZabbixAlerts(50);
    let created = 0;
    let updated = 0;

    for (const za of zabbixAlerts) {
      const hostname = za.hosts?.[0]?.host;
      let assetId: string | null = null;

      if (hostname) {
        const assetResult = await query('SELECT id FROM assets WHERE hostname = $1', [hostname]);
        if (assetResult.rows.length > 0) {
          assetId = assetResult.rows[0].id;
        }
      }

      const severity = SEVERITY_MAP[za.severity] || 'info';
      const existing = await query('SELECT id FROM alerts WHERE zabbix_event_id = $1', [za.eventid]);

      if (existing.rows.length > 0) {
        await query(
          `UPDATE alerts SET trigger_name = $1, severity = $2, updated_at = NOW() WHERE zabbix_event_id = $3`,
          [za.name, severity, za.eventid]
        );
        updated++;
      } else {
        await query(
          `INSERT INTO alerts (zabbix_event_id, asset_id, trigger_name, severity, status, message)
           VALUES ($1, $2, $3, $4, 'open', $5)`,
          [za.eventid, assetId, za.name, severity, za.name]
        );
        created++;
      }
    }

    await logAudit(req.user.userId, 'SYNC_ZABBIX', 'alert', undefined, { created, updated }, req.ip);

    res.json({ message: 'Sincronização concluída', created, updated });
  } catch (err) {
    console.error('[Alerts] syncFromZabbix error:', err);
    res.status(500).json({ error: 'Erro ao sincronizar com Zabbix' });
  }
};

export const getAlertStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const bySeverity = await query(
      `SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity ORDER BY count DESC`
    );
    const byStatus = await query(
      `SELECT status, COUNT(*) as count FROM alerts GROUP BY status ORDER BY count DESC`
    );
    const totalOpen = await query(`SELECT COUNT(*) FROM alerts WHERE status = 'open'`);
    const totalCritical = await query(
      `SELECT COUNT(*) FROM alerts WHERE severity IN ('disaster', 'high') AND status != 'resolved'`
    );

    res.json({
      bySeverity: bySeverity.rows,
      byStatus: byStatus.rows,
      totalOpen: parseInt(totalOpen.rows[0].count),
      totalCritical: parseInt(totalCritical.rows[0].count),
    });
  } catch (err) {
    console.error('[Alerts] getAlertStats error:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
};
