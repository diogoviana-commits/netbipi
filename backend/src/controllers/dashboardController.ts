import { Request, Response } from 'express';
import { query } from '../config/database';

export const getMetrics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalAlertsResult,
      openAlertsResult,
      criticalAlertsResult,
      openTicketsResult,
      inProgressResult,
      resolvedTodayResult,
      avgResolutionResult,
      topHostsResult,
      alertsBySeverityResult,
      ticketsByStatusResult,
      recentAlertsResult,
      recentTicketsResult,
    ] = await Promise.all([
      query('SELECT COUNT(*) FROM alerts'),
      query("SELECT COUNT(*) FROM alerts WHERE status = 'open'"),
      query("SELECT COUNT(*) FROM alerts WHERE severity IN ('disaster', 'high') AND status != 'resolved'"),
      query("SELECT COUNT(*) FROM tickets WHERE status = 'open'"),
      query("SELECT COUNT(*) FROM tickets WHERE status = 'in_progress'"),
      query("SELECT COUNT(*) FROM tickets WHERE resolved_at >= CURRENT_DATE AND status IN ('resolved', 'closed')"),
      query("SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) as avg FROM tickets WHERE resolved_at IS NOT NULL"),
      query(`
        SELECT ast.hostname, COUNT(a.id) as count
        FROM alerts a
        JOIN assets ast ON a.asset_id = ast.id
        WHERE a.status != 'resolved'
        GROUP BY ast.hostname
        ORDER BY count DESC
        LIMIT 5
      `),
      query("SELECT severity, COUNT(*) as count FROM alerts GROUP BY severity ORDER BY count DESC"),
      query("SELECT status, COUNT(*) as count FROM tickets GROUP BY status ORDER BY count DESC"),
      query(`
        SELECT a.*, ast.hostname, ast.ip_address
        FROM alerts a
        LEFT JOIN assets ast ON a.asset_id = ast.id
        ORDER BY a.created_at DESC
        LIMIT 5
      `),
      query(`
        SELECT t.*, ast.hostname as asset_hostname, u.full_name as assigned_user_name
        FROM tickets t
        LEFT JOIN assets ast ON t.asset_id = ast.id
        LEFT JOIN users u ON t.assigned_to = u.id
        ORDER BY t.created_at DESC
        LIMIT 5
      `),
    ]);

    res.json({
      totalAlerts: parseInt(totalAlertsResult.rows[0].count),
      openAlerts: parseInt(openAlertsResult.rows[0].count),
      criticalAlerts: parseInt(criticalAlertsResult.rows[0].count),
      openTickets: parseInt(openTicketsResult.rows[0].count),
      inProgressTickets: parseInt(inProgressResult.rows[0].count),
      resolvedToday: parseInt(resolvedTodayResult.rows[0].count),
      avgResolutionTime: Math.round(parseFloat(avgResolutionResult.rows[0].avg) || 0),
      topIncidentHosts: topHostsResult.rows,
      alertsBySeverity: alertsBySeverityResult.rows,
      ticketsByStatus: ticketsByStatusResult.rows,
      recentAlerts: recentAlertsResult.rows,
      recentTickets: recentTicketsResult.rows,
    });
  } catch (err) {
    console.error('[Dashboard] getMetrics error:', err);
    res.status(500).json({ error: 'Erro ao buscar métricas do dashboard' });
  }
};
