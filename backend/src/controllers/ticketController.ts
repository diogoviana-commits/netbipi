import { Request, Response } from 'express';
import { query } from '../config/database';
import { logAudit } from '../services/auditService';
import { createTicket as glpiCreateTicket, addFollowup } from '../integrations/glpi';

export const getTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, priority, search, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`t.status = $${paramIndex++}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`t.priority = $${paramIndex++}`);
      params.push(priority);
    }
    if (search) {
      conditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM tickets t ${whereClause}`,
      params
    );

    params.push(parseInt(limit as string), offset);
    const result = await query(
      `SELECT t.*,
              ast.hostname as asset_hostname, ast.ip_address as asset_ip,
              u1.full_name as assigned_user_name, u1.username as assigned_username,
              u2.full_name as created_by_name, u2.username as created_by_username
       FROM tickets t
       LEFT JOIN assets ast ON t.asset_id = ast.id
       LEFT JOIN users u1 ON t.assigned_to = u1.id
       LEFT JOIN users u2 ON t.created_by = u2.id
       ${whereClause}
       ORDER BY t.created_at DESC
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
    console.error('[Tickets] getTickets error:', err);
    res.status(500).json({ error: 'Erro ao buscar chamados' });
  }
};

export const getTicketById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT t.*,
              ast.hostname as asset_hostname, ast.ip_address as asset_ip, ast.os_type,
              u1.full_name as assigned_user_name, u1.email as assigned_user_email,
              u2.full_name as created_by_name
       FROM tickets t
       LEFT JOIN assets ast ON t.asset_id = ast.id
       LEFT JOIN users u1 ON t.assigned_to = u1.id
       LEFT JOIN users u2 ON t.created_by = u2.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    const comments = await query(
      `SELECT tc.*, u.full_name as user_name, u.username, u.role
       FROM ticket_comments tc
       LEFT JOIN users u ON tc.user_id = u.id
       WHERE tc.ticket_id = $1
       ORDER BY tc.created_at ASC`,
      [id]
    );

    res.json({
      ...result.rows[0],
      comments: comments.rows,
    });
  } catch (err) {
    console.error('[Tickets] getTicketById error:', err);
    res.status(500).json({ error: 'Erro ao buscar chamado' });
  }
};

export const createTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { title, description, priority = 'medium', category = 'incident', assetId, alertId, assignedTo } = req.body;

    if (!title || !description) {
      res.status(400).json({ error: 'Título e descrição são obrigatórios' });
      return;
    }

    let glpiTicketId: number | null = null;
    try {
      const glpiResult = await glpiCreateTicket(title, description, priority, assetId);
      glpiTicketId = glpiResult.id;
    } catch (err) {
      console.error('[Tickets] GLPI createTicket failed:', err);
    }

    const result = await query(
      `INSERT INTO tickets (glpi_ticket_id, title, description, status, priority, category, asset_id, alert_id, assigned_to, created_by)
       VALUES ($1, $2, $3, 'open', $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [glpiTicketId, title, description, priority, category, assetId || null, alertId || null, assignedTo || null, req.user.userId]
    );

    if (alertId) {
      await query(
        `UPDATE alerts SET ticket_id = $1, updated_at = NOW() WHERE id = $2`,
        [result.rows[0].id, alertId]
      );
    }

    await logAudit(req.user.userId, 'CREATE_TICKET', 'ticket', result.rows[0].id, { title, priority }, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Tickets] createTicket error:', err);
    res.status(500).json({ error: 'Erro ao criar chamado' });
  }
};

export const updateTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { id } = req.params;
    const { status, priority, assignedTo, category } = req.body;

    const existing = await query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
      if (status === 'resolved' || status === 'closed') {
        updates.push(`resolved_at = NOW()`);
      }
    }
    if (priority) {
      updates.push(`priority = $${paramIndex++}`);
      params.push(priority);
    }
    if (assignedTo !== undefined) {
      updates.push(`assigned_to = $${paramIndex++}`);
      params.push(assignedTo || null);
    }
    if (category) {
      updates.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'Nenhum campo para atualizar' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await query(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    await logAudit(req.user.userId, 'UPDATE_TICKET', 'ticket', id, req.body, req.ip);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Tickets] updateTicket error:', err);
    res.status(500).json({ error: 'Erro ao atualizar chamado' });
  }
};

export const addComment = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { id } = req.params;
    const { content, isInternal = false } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Conteúdo do comentário é obrigatório' });
      return;
    }

    const existing = await query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Chamado não encontrado' });
      return;
    }

    const ticket = existing.rows[0];

    if (ticket.glpi_ticket_id && !isInternal) {
      await addFollowup(ticket.glpi_ticket_id, content);
    }

    const result = await query(
      `INSERT INTO ticket_comments (ticket_id, user_id, content, is_internal)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, req.user.userId, content, isInternal]
    );

    await query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [id]);

    const commentWithUser = await query(
      `SELECT tc.*, u.full_name as user_name, u.username, u.role
       FROM ticket_comments tc
       LEFT JOIN users u ON tc.user_id = u.id
       WHERE tc.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(commentWithUser.rows[0]);
  } catch (err) {
    console.error('[Tickets] addComment error:', err);
    res.status(500).json({ error: 'Erro ao adicionar comentário' });
  }
};

export const createFromAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { alertId } = req.params;

    const alertResult = await query(
      `SELECT a.*, ast.hostname FROM alerts a LEFT JOIN assets ast ON a.asset_id = ast.id WHERE a.id = $1`,
      [alertId]
    );

    if (alertResult.rows.length === 0) {
      res.status(404).json({ error: 'Alerta não encontrado' });
      return;
    }

    const alert = alertResult.rows[0];

    if (alert.ticket_id) {
      res.status(400).json({ error: 'Alerta já possui um chamado vinculado', ticketId: alert.ticket_id });
      return;
    }

    const priorityMap: Record<string, string> = {
      disaster: 'critical',
      high: 'high',
      average: 'medium',
      warning: 'low',
      info: 'low',
    };

    const title = `[ALERTA] ${alert.trigger_name}`;
    const description = `Chamado criado automaticamente a partir do alerta.\n\nAlerta: ${alert.trigger_name}\nHost: ${alert.hostname || 'N/A'}\nSeveridade: ${alert.severity}\nMensagem: ${alert.message}`;
    const priority = priorityMap[alert.severity] || 'medium';

    let glpiTicketId: number | null = null;
    try {
      const glpiResult = await glpiCreateTicket(title, description, priority, alert.asset_id);
      glpiTicketId = glpiResult.id;
    } catch (err) {
      console.error('[Tickets] GLPI createTicket failed:', err);
    }

    const result = await query(
      `INSERT INTO tickets (glpi_ticket_id, title, description, status, priority, category, asset_id, alert_id, created_by)
       VALUES ($1, $2, $3, 'open', $4, 'incident', $5, $6, $7)
       RETURNING *`,
      [glpiTicketId, title, description, priority, alert.asset_id || null, alertId, req.user.userId]
    );

    await query(
      `UPDATE alerts SET ticket_id = $1, status = 'acknowledged', acknowledged_by = $2, acknowledged_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [result.rows[0].id, req.user.userId, alertId]
    );

    await logAudit(req.user.userId, 'CREATE_TICKET_FROM_ALERT', 'ticket', result.rows[0].id, { alertId }, req.ip);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Tickets] createFromAlert error:', err);
    res.status(500).json({ error: 'Erro ao criar chamado a partir do alerta' });
  }
};

export const getTicketStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const byStatus = await query(
      `SELECT status, COUNT(*) as count FROM tickets GROUP BY status ORDER BY count DESC`
    );
    const byPriority = await query(
      `SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority ORDER BY count DESC`
    );
    const resolvedToday = await query(
      `SELECT COUNT(*) FROM tickets WHERE resolved_at >= CURRENT_DATE AND status IN ('resolved', 'closed')`
    );
    const avgResolution = await query(
      `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) as avg_minutes
       FROM tickets WHERE resolved_at IS NOT NULL`
    );

    res.json({
      byStatus: byStatus.rows,
      byPriority: byPriority.rows,
      resolvedToday: parseInt(resolvedToday.rows[0].count),
      avgResolutionMinutes: Math.round(parseFloat(avgResolution.rows[0].avg_minutes) || 0),
    });
  } catch (err) {
    console.error('[Tickets] getTicketStats error:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
};
