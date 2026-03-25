import cron from 'node-cron';
import { query } from '../config/database';
import { emitEscalation } from '../socket';

export const startEscalationService = (): void => {
  // Every 5 minutes: check unacknowledged critical/disaster alerts
  cron.schedule('*/5 * * * *', async () => {
    try {
      // Find disaster/high alerts open for > 10 minutes without ack
      const unacked = await query(`
        SELECT a.id, a.trigger_name, a.severity, a.created_at, ast.hostname
        FROM alerts a
        LEFT JOIN assets ast ON a.asset_id = ast.id
        WHERE a.status = 'open'
          AND a.severity IN ('disaster', 'high')
          AND a.acknowledged_at IS NULL
          AND a.created_at < NOW() - INTERVAL '10 minutes'
      `);

      for (const alert of unacked.rows) {
        const existing = await query(
          `SELECT id FROM escalations WHERE alert_id = $1 AND escalated_at > NOW() - INTERVAL '30 minutes'`,
          [alert.id]
        );
        if (existing.rows.length === 0) {
          await query(
            `INSERT INTO escalations (alert_id, reason, escalated_at) VALUES ($1, $2, NOW())`,
            [alert.id, `Alerta ${alert.severity} sem reconhecimento após 10 minutos`]
          );
          emitEscalation({
            alertId: alert.id,
            hostname: alert.hostname,
            triggerName: alert.trigger_name,
            severity: alert.severity,
            message: `Escalada: ${alert.trigger_name} em ${alert.hostname || 'host desconhecido'} sem reconhecimento por 10 minutos`,
          });
          console.log(`[Escalation] Alertada: ${alert.trigger_name}`);
        }
      }

      // Find tickets open > 4h without update — change to high priority
      await query(`
        UPDATE tickets
        SET priority = 'high', updated_at = NOW()
        WHERE status IN ('open', 'in_progress')
          AND priority IN ('low', 'medium')
          AND updated_at < NOW() - INTERVAL '4 hours'
      `);

    } catch (err) {
      console.error('[Escalation] Erro no serviço de escalada:', err);
    }
  });

  console.log('[Escalation] Serviço de escalada iniciado (verificação a cada 5 min)');
};
