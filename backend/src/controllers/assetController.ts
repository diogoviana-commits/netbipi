import { Request, Response } from 'express';
import { query } from '../config/database';
import { logAudit } from '../services/auditService';

export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { environment, osType, search, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = ['a.is_active = true'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (environment) {
      conditions.push(`a.environment = $${paramIndex++}`);
      params.push(environment);
    }
    if (osType) {
      conditions.push(`a.os_type = $${paramIndex++}`);
      params.push(osType);
    }
    if (search) {
      conditions.push(`(a.hostname ILIKE $${paramIndex} OR a.ip_address ILIKE $${paramIndex} OR a.client ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*) FROM assets a ${whereClause}`,
      params
    );

    params.push(parseInt(limit as string), offset);
    const result = await query(
      `SELECT a.*,
              COUNT(DISTINCT al.id) FILTER (WHERE al.status != 'resolved') as open_alerts,
              COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('open', 'in_progress')) as open_tickets
       FROM assets a
       LEFT JOIN alerts al ON al.asset_id = a.id
       LEFT JOIN tickets t ON t.asset_id = a.id
       ${whereClause}
       GROUP BY a.id
       ORDER BY a.hostname ASC
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
    console.error('[Assets] getAssets error:', err);
    res.status(500).json({ error: 'Erro ao buscar ativos' });
  }
};

export const getAssetById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM assets WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Ativo não encontrado' });
      return;
    }

    const alerts = await query(
      `SELECT * FROM alerts WHERE asset_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    const tickets = await query(
      `SELECT t.*, u.full_name as assigned_user_name
       FROM tickets t
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.asset_id = $1
       ORDER BY t.created_at DESC LIMIT 10`,
      [id]
    );

    res.json({
      ...result.rows[0],
      recentAlerts: alerts.rows,
      recentTickets: tickets.rows,
    });
  } catch (err) {
    console.error('[Assets] getAssetById error:', err);
    res.status(500).json({ error: 'Erro ao buscar ativo' });
  }
};

export const createAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { hostname, ipAddress, osType, osVersion, environment, site, client, services, zabbixHostId } = req.body;

    if (!hostname || !ipAddress || !osType) {
      res.status(400).json({ error: 'Hostname, IP e tipo de SO são obrigatórios' });
      return;
    }

    const existing = await query('SELECT id FROM assets WHERE hostname = $1 OR ip_address = $2', [hostname, ipAddress]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Já existe um ativo com este hostname ou IP' });
      return;
    }

    const result = await query(
      `INSERT INTO assets (hostname, ip_address, os_type, os_version, environment, site, client, services, zabbix_host_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [hostname, ipAddress, osType, osVersion || '', environment || 'production', site || '', client || '', services || [], zabbixHostId || null]
    );

    await logAudit(req.user.userId, 'CREATE_ASSET', 'asset', result.rows[0].id, { hostname, ipAddress }, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Assets] createAsset error:', err);
    res.status(500).json({ error: 'Erro ao criar ativo' });
  }
};

export const updateAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { id } = req.params;
    const { hostname, ipAddress, osType, osVersion, environment, site, client, services, zabbixHostId } = req.body;

    const existing = await query('SELECT * FROM assets WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Ativo não encontrado' });
      return;
    }

    const result = await query(
      `UPDATE assets SET
        hostname = COALESCE($1, hostname),
        ip_address = COALESCE($2, ip_address),
        os_type = COALESCE($3, os_type),
        os_version = COALESCE($4, os_version),
        environment = COALESCE($5, environment),
        site = COALESCE($6, site),
        client = COALESCE($7, client),
        services = COALESCE($8, services),
        zabbix_host_id = COALESCE($9, zabbix_host_id),
        updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [hostname, ipAddress, osType, osVersion, environment, site, client, services, zabbixHostId, id]
    );

    await logAudit(req.user.userId, 'UPDATE_ASSET', 'asset', id, req.body, req.ip);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Assets] updateAsset error:', err);
    res.status(500).json({ error: 'Erro ao atualizar ativo' });
  }
};

export const deleteAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { id } = req.params;

    const existing = await query('SELECT * FROM assets WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Ativo não encontrado' });
      return;
    }

    await query('UPDATE assets SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);

    await logAudit(req.user.userId, 'DELETE_ASSET', 'asset', id, {}, req.ip);

    res.json({ message: 'Ativo desativado com sucesso' });
  } catch (err) {
    console.error('[Assets] deleteAsset error:', err);
    res.status(500).json({ error: 'Erro ao desativar ativo' });
  }
};

export const getAssetStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const byType = await query(
      `SELECT os_type, COUNT(*) as count FROM assets WHERE is_active = true GROUP BY os_type`
    );
    const byEnvironment = await query(
      `SELECT environment, COUNT(*) as count FROM assets WHERE is_active = true GROUP BY environment ORDER BY count DESC`
    );
    const total = await query(`SELECT COUNT(*) FROM assets WHERE is_active = true`);

    res.json({
      byType: byType.rows,
      byEnvironment: byEnvironment.rows,
      total: parseInt(total.rows[0].count),
    });
  } catch (err) {
    console.error('[Assets] getAssetStats error:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas de ativos' });
  }
};
