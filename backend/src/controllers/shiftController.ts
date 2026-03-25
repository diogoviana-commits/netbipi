import { Request, Response } from 'express';
import { query } from '../config/database';

const getShiftInterval = (shift?: string): { label: string; hours: number; start: string; end: string } => {
  const now = new Date();
  const hour = now.getHours();

  let shiftName = shift;
  if (!shiftName) {
    if (hour >= 6 && hour < 14) shiftName = 'manha';
    else if (hour >= 14 && hour < 22) shiftName = 'tarde';
    else shiftName = 'noite';
  }

  const labels: Record<string, { label: string; start: string; end: string }> = {
    manha: { label: 'Manhã (06:00 - 14:00)', start: '06:00', end: '14:00' },
    tarde: { label: 'Tarde (14:00 - 22:00)', start: '14:00', end: '22:00' },
    noite: { label: 'Noite (22:00 - 06:00)', start: '22:00', end: '06:00' },
  };

  return { ...labels[shiftName] || labels['manha'], hours: 8 };
};

export const getShiftSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shift } = req.query as { shift?: string };
    const { label, start, end } = getShiftInterval(shift);

    const [
      alertsOpened,
      ticketsStale,
      criticalOpen,
      resolvedAlerts,
      analystActivity,
      pendingEscalations,
    ] = await Promise.all([
      query(`
        SELECT a.id, a.trigger_name, a.severity, a.status, a.created_at, ast.hostname
        FROM alerts a
        LEFT JOIN assets ast ON a.asset_id = ast.id
        WHERE a.created_at > NOW() - INTERVAL '8 hours'
        ORDER BY a.created_at DESC
      `),
      query(`
        SELECT t.id, t.title, t.status, t.priority, t.updated_at, t.created_at,
               u.full_name AS assigned_to
        FROM tickets t
        LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.status IN ('open', 'in_progress')
          AND t.created_at > NOW() - INTERVAL '8 hours'
          AND t.updated_at < NOW() - INTERVAL '2 hours'
        ORDER BY t.updated_at ASC
      `),
      query(`
        SELECT a.id, a.trigger_name, a.severity, a.created_at, ast.hostname
        FROM alerts a
        LEFT JOIN assets ast ON a.asset_id = ast.id
        WHERE a.status = 'open'
          AND a.severity IN ('disaster', 'high')
        ORDER BY a.created_at DESC
      `),
      query(`
        SELECT a.id, a.trigger_name, a.severity, a.resolved_at, ast.hostname
        FROM alerts a
        LEFT JOIN assets ast ON a.asset_id = ast.id
        WHERE a.status = 'resolved'
          AND a.resolved_at > NOW() - INTERVAL '8 hours'
        ORDER BY a.resolved_at DESC
      `),
      query(`
        SELECT u.full_name, u.role,
               COUNT(DISTINCT a.id) AS alerts_acked,
               COUNT(DISTINCT t.id) AS tickets_updated,
               COUNT(DISTINCT tc.id) AS comments_added
        FROM users u
        LEFT JOIN alerts a ON a.acknowledged_by = u.id AND a.acknowledged_at > NOW() - INTERVAL '8 hours'
        LEFT JOIN tickets t ON t.assigned_to = u.id AND t.updated_at > NOW() - INTERVAL '8 hours'
        LEFT JOIN ticket_comments tc ON tc.user_id = u.id AND tc.created_at > NOW() - INTERVAL '8 hours'
        WHERE u.is_active = true
        GROUP BY u.id, u.full_name, u.role
        HAVING COUNT(DISTINCT a.id) + COUNT(DISTINCT t.id) + COUNT(DISTINCT tc.id) > 0
        ORDER BY alerts_acked + tickets_updated DESC
      `),
      query(`
        SELECT e.id, e.reason, e.escalated_at, a.trigger_name, ast.hostname
        FROM escalations e
        LEFT JOIN alerts a ON e.alert_id = a.id
        LEFT JOIN assets ast ON a.asset_id = ast.id
        WHERE e.resolved_at IS NULL
          AND e.escalated_at > NOW() - INTERVAL '8 hours'
        ORDER BY e.escalated_at DESC
      `),
    ]);

    res.json({
      shift: { label, start, end },
      stats: {
        alertsOpened: alertsOpened.rows.length,
        ticketsStale: ticketsStale.rows.length,
        criticalOpen: criticalOpen.rows.length,
        resolved: resolvedAlerts.rows.length,
        escalations: pendingEscalations.rows.length,
      },
      alertsOpened: alertsOpened.rows,
      ticketsStale: ticketsStale.rows,
      criticalOpen: criticalOpen.rows,
      resolvedAlerts: resolvedAlerts.rows,
      analystActivity: analystActivity.rows,
      pendingEscalations: pendingEscalations.rows,
    });
  } catch (err) {
    console.error('[Shift] Erro ao buscar resumo do turno:', err);
    res.status(500).json({ error: 'Erro ao buscar resumo do turno' });
  }
};

export const getHandoffReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shift } = req.query as { shift?: string };
    const { label } = getShiftInterval(shift);
    const now = new Date();

    const [criticalOpen, ticketsStale, resolvedAlerts, pendingEscalations] = await Promise.all([
      query(`
        SELECT a.trigger_name, a.severity, a.status, ast.hostname, a.created_at
        FROM alerts a LEFT JOIN assets ast ON a.asset_id = ast.id
        WHERE a.status = 'open' AND a.severity IN ('disaster','high')
        ORDER BY a.created_at DESC LIMIT 20
      `),
      query(`
        SELECT t.title, t.status, t.priority, t.updated_at, u.full_name AS assigned_to
        FROM tickets t LEFT JOIN users u ON t.assigned_to = u.id
        WHERE t.status IN ('open','in_progress') AND t.updated_at < NOW() - INTERVAL '2 hours'
        ORDER BY t.updated_at ASC LIMIT 10
      `),
      query(`
        SELECT a.trigger_name, a.severity, ast.hostname, a.resolved_at
        FROM alerts a LEFT JOIN assets ast ON a.asset_id = ast.id
        WHERE a.status = 'resolved' AND a.resolved_at > NOW() - INTERVAL '8 hours'
        ORDER BY a.resolved_at DESC LIMIT 10
      `),
      query(`
        SELECT e.reason, e.escalated_at, a.trigger_name, ast.hostname
        FROM escalations e LEFT JOIN alerts a ON e.alert_id = a.id
        LEFT JOIN assets ast ON a.asset_id = ast.id
        WHERE e.resolved_at IS NULL ORDER BY e.escalated_at DESC LIMIT 5
      `),
    ]);

    let report = `=== PASSAGEM DE PLANTÃO — NetBIPI ===\n`;
    report += `Turno: ${label}\n`;
    report += `Data/Hora: ${now.toLocaleString('pt-BR')}\n`;
    report += `\n`;

    report += `--- ALERTAS CRÍTICOS EM ABERTO ---\n`;
    if (criticalOpen.rows.length === 0) {
      report += `Nenhum alerta crítico em aberto.\n`;
    } else {
      criticalOpen.rows.forEach((a: { severity: string; trigger_name: string; hostname: string; created_at: string }) => {
        report += `[${a.severity.toUpperCase()}] ${a.trigger_name} — ${a.hostname || 'N/A'} (desde ${new Date(a.created_at).toLocaleString('pt-BR')})\n`;
      });
    }

    report += `\n--- CHAMADOS SEM ATUALIZAÇÃO (>2h) ---\n`;
    if (ticketsStale.rows.length === 0) {
      report += `Todos os chamados estão atualizados.\n`;
    } else {
      ticketsStale.rows.forEach((t: { priority: string; title: string; assigned_to: string; updated_at: string }) => {
        report += `[${t.priority.toUpperCase()}] ${t.title} — Resp: ${t.assigned_to || 'Não atribuído'} — Última atualização: ${new Date(t.updated_at).toLocaleString('pt-BR')}\n`;
      });
    }

    report += `\n--- RESOLVIDOS NESTE TURNO ---\n`;
    if (resolvedAlerts.rows.length === 0) {
      report += `Nenhum incidente resolvido neste turno.\n`;
    } else {
      resolvedAlerts.rows.forEach((a: { severity: string; trigger_name: string; hostname: string; resolved_at: string }) => {
        report += `[OK] ${a.trigger_name} — ${a.hostname || 'N/A'} — resolvido em ${new Date(a.resolved_at).toLocaleString('pt-BR')}\n`;
      });
    }

    report += `\n--- ESCALADAS PENDENTES ---\n`;
    if (pendingEscalations.rows.length === 0) {
      report += `Nenhuma escalada pendente.\n`;
    } else {
      pendingEscalations.rows.forEach((e: { reason: string; hostname: string; escalated_at: string }) => {
        report += `ATENÇÃO: ${e.reason} — ${e.hostname || 'N/A'} (${new Date(e.escalated_at).toLocaleString('pt-BR')})\n`;
      });
    }

    report += `\n--- OBSERVAÇÕES ---\n`;
    report += `(Preencha observações adicionais aqui)\n`;
    report += `\n==========================================\n`;
    report += `Analista responsável: ___________________________\n`;
    report += `Assinatura digital: _____________________________\n`;

    res.json({ report, shift: label, generatedAt: now.toISOString() });
  } catch (err) {
    console.error('[Shift] Erro ao gerar relatório de passagem:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório de passagem de plantão' });
  }
};
