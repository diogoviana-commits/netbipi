import { Request, Response } from 'express';
import { query } from '../config/database';

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  user?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export const getIncidentTimeline = async (req: Request, res: Response): Promise<void> => {
  try {
    const { alertId, ticketId } = req.query as { alertId?: string; ticketId?: string };

    if (!alertId && !ticketId) {
      res.status(400).json({ error: 'alertId ou ticketId é obrigatório' });
      return;
    }

    const events: TimelineEvent[] = [];

    // 1. Alert events
    if (alertId) {
      const alertResult = await query(
        `SELECT a.id, a.trigger_name, a.severity, a.status, a.message,
                a.created_at, a.acknowledged_at, a.resolved_at,
                ack_user.full_name AS acknowledged_by_name,
                ast.hostname
         FROM alerts a
         LEFT JOIN users ack_user ON a.acknowledged_by = ack_user.id
         LEFT JOIN assets ast ON a.asset_id = ast.id
         WHERE a.id = $1`,
        [alertId]
      );

      if (alertResult.rows.length > 0) {
        const alert = alertResult.rows[0];

        events.push({
          id: `alert-created-${alert.id}`,
          type: 'alert_created',
          title: 'Alerta criado',
          description: `${alert.trigger_name} detectado em ${alert.hostname || 'host desconhecido'} — Severidade: ${alert.severity}`,
          timestamp: alert.created_at,
          metadata: { severity: alert.severity, hostname: alert.hostname },
        });

        if (alert.acknowledged_at) {
          events.push({
            id: `alert-ack-${alert.id}`,
            type: 'alert_acknowledged',
            title: 'Alerta reconhecido',
            description: `Reconhecido por ${alert.acknowledged_by_name || 'analista'}`,
            user: alert.acknowledged_by_name,
            timestamp: alert.acknowledged_at,
          });
        }

        if (alert.resolved_at) {
          events.push({
            id: `alert-resolved-${alert.id}`,
            type: 'alert_resolved',
            title: 'Alerta resolvido',
            description: 'Alerta marcado como resolvido',
            timestamp: alert.resolved_at,
          });
        }
      }

      // Network diagnostics for this alert
      const diagResult = await query(
        `SELECT nd.id, nd.type, nd.target, nd.result, nd.status, nd.executed_at,
                u.full_name AS executed_by_name
         FROM network_diagnostics nd
         LEFT JOIN users u ON nd.executed_by = u.id
         WHERE nd.alert_id = $1
         ORDER BY nd.executed_at`,
        [alertId]
      );

      diagResult.rows.forEach((d: { id: string; type: string; target: string; status: string; executed_at: string; executed_by_name: string; result: string }) => {
        events.push({
          id: `diag-${d.id}`,
          type: 'network_diagnostic',
          title: `Diagnóstico de rede: ${d.type.toUpperCase()}`,
          description: `${d.type.toUpperCase()} em ${d.target} — Status: ${d.status}`,
          user: d.executed_by_name,
          timestamp: d.executed_at,
          metadata: { type: d.type, target: d.target, status: d.status, result: d.result },
        });
      });

      // Ticket linked to alert
      const ticketResult = await query(
        `SELECT t.id, t.title, t.status, t.created_at, u.full_name AS created_by_name
         FROM tickets t LEFT JOIN users u ON t.created_by = u.id
         WHERE t.alert_id = $1`,
        [alertId]
      );

      ticketResult.rows.forEach((t: { id: string; title: string; status: string; created_at: string; created_by_name: string }) => {
        events.push({
          id: `ticket-opened-${t.id}`,
          type: 'ticket_opened',
          title: 'Chamado aberto',
          description: `Chamado criado: ${t.title}`,
          user: t.created_by_name,
          timestamp: t.created_at,
          metadata: { ticketId: t.id, ticketTitle: t.title },
        });
      });
    }

    // 2. Ticket events
    if (ticketId) {
      const ticketResult = await query(
        `SELECT t.id, t.title, t.status, t.created_at, t.updated_at,
                u.full_name AS created_by_name
         FROM tickets t LEFT JOIN users u ON t.created_by = u.id
         WHERE t.id = $1`,
        [ticketId]
      );

      if (ticketResult.rows.length > 0) {
        const ticket = ticketResult.rows[0];
        events.push({
          id: `ticket-created-${ticket.id}`,
          type: 'ticket_opened',
          title: 'Chamado criado',
          description: `Chamado "${ticket.title}" criado`,
          user: ticket.created_by_name,
          timestamp: ticket.created_at,
        });
      }

      // Comments
      const commentsResult = await query(
        `SELECT tc.id, tc.content, tc.is_internal, tc.created_at,
                u.full_name AS user_name
         FROM ticket_comments tc LEFT JOIN users u ON tc.user_id = u.id
         WHERE tc.ticket_id = $1 ORDER BY tc.created_at`,
        [ticketId]
      );

      commentsResult.rows.forEach((c: { id: string; content: string; is_internal: boolean; created_at: string; user_name: string }) => {
        events.push({
          id: `comment-${c.id}`,
          type: 'comment_added',
          title: c.is_internal ? 'Nota interna adicionada' : 'Comentário adicionado',
          description: c.content.length > 120 ? c.content.substring(0, 120) + '...' : c.content,
          user: c.user_name,
          timestamp: c.created_at,
          metadata: { isInternal: c.is_internal },
        });
      });
    }

    // 3. Audit log entries related to alert/ticket
    try {
      const auditParams: string[] = [];
      const auditValues: unknown[] = [];
      let auditSql = `
        SELECT id, action, entity_type, entity_id, user_id, details, created_at,
               (SELECT full_name FROM users WHERE id = al.user_id) AS user_name
        FROM audit_log al WHERE 1=1
      `;

      if (alertId) {
        auditParams.push(` AND entity_id = $${auditValues.length + 1} AND entity_type = 'alert'`);
        auditValues.push(alertId);
      }
      if (ticketId) {
        const orClause = auditValues.length > 0 ? ` OR (entity_id = $${auditValues.length + 1} AND entity_type = 'ticket')` : ` AND entity_id = $${auditValues.length + 1} AND entity_type = 'ticket'`;
        auditParams.push(orClause);
        auditValues.push(ticketId);
      }

      auditSql += auditParams.join('') + ' ORDER BY created_at LIMIT 50';

      if (auditValues.length > 0) {
        const auditResult = await query(auditSql, auditValues);
        auditResult.rows.forEach((a: { id: string; action: string; entity_type: string; details: string; created_at: string; user_name: string }) => {
          events.push({
            id: `audit-${a.id}`,
            type: 'audit_log',
            title: `Ação: ${a.action}`,
            description: typeof a.details === 'object' ? JSON.stringify(a.details) : String(a.details || ''),
            user: a.user_name,
            timestamp: a.created_at,
          });
        });
      }
    } catch {
      // audit_log table may not exist
    }

    // Sort all events by timestamp
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.json({ timeline: events, total: events.length });
  } catch (err) {
    console.error('[Timeline] Erro ao buscar timeline:', err);
    res.status(500).json({ error: 'Erro ao buscar timeline do incidente' });
  }
};
