import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { createTicket } from '../integrations/glpi';

const router = Router();

const SEVERITY_MAP: Record<string, string> = {
  '0': 'info',
  '1': 'info',
  '2': 'warning',
  '3': 'average',
  '4': 'high',
  '5': 'disaster',
};

router.post('/zabbix', async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body;
    console.log('[Webhook] Received Zabbix webhook:', JSON.stringify(payload).substring(0, 200));

    const {
      eventid,
      hostname,
      trigger_name,
      severity,
      status,
      message,
    } = payload;

    if (!trigger_name) {
      res.status(400).json({ error: 'Dados insuficientes no webhook' });
      return;
    }

    let assetId: string | null = null;
    if (hostname) {
      const assetResult = await query('SELECT id FROM assets WHERE hostname = $1', [hostname]);
      if (assetResult.rows.length > 0) {
        assetId = assetResult.rows[0].id;
      }
    }

    const mappedSeverity = SEVERITY_MAP[String(severity)] || severity || 'info';
    const isResolved = status === 'RESOLVED' || status === '0';

    if (eventid) {
      const existing = await query('SELECT id, status FROM alerts WHERE zabbix_event_id = $1', [eventid]);

      if (existing.rows.length > 0) {
        await query(
          `UPDATE alerts
           SET severity = $1, status = $2, ${isResolved ? "resolved_at = NOW()," : ''} updated_at = NOW()
           WHERE zabbix_event_id = $3`,
          [mappedSeverity, isResolved ? 'resolved' : 'open', eventid]
        );
        res.json({ message: 'Alerta atualizado', eventid });
        return;
      }
    }

    const insertResult = await query(
      `INSERT INTO alerts (zabbix_event_id, asset_id, trigger_name, severity, status, message)
       VALUES ($1, $2, $3, $4, 'open', $5)
       RETURNING id`,
      [eventid || null, assetId, trigger_name, mappedSeverity, message || trigger_name]
    );

    const newAlertId = insertResult.rows[0].id;
    console.log(`[Webhook] Created alert ${newAlertId} from Zabbix webhook`);

    if (mappedSeverity === 'disaster' || mappedSeverity === 'high') {
      const ticketTitle = `[AUTO] ${trigger_name}`;
      const ticketDesc = `Chamado criado automaticamente via webhook Zabbix.\n\nHost: ${hostname || 'N/A'}\nTrigger: ${trigger_name}\nSeveridade: ${mappedSeverity}\nMensagem: ${message || trigger_name}`;
      let glpiTicketId: number | null = null;

      try {
        const glpiResult = await createTicket(
          ticketTitle,
          ticketDesc,
          mappedSeverity === 'disaster' ? 'critical' : 'high',
          assetId || undefined
        );
        glpiTicketId = glpiResult.id;
      } catch (ticketErr) {
        console.error('[Webhook] Failed to create ticket in GLPI:', ticketErr);
      }

      await query(
        `INSERT INTO tickets (glpi_ticket_id, title, description, status, priority, category, asset_id, alert_id, created_by)
         SELECT $1, $2, $3, 'open', $4, 'incident', $5, $6, id FROM users WHERE role = 'admin' LIMIT 1`,
        [glpiTicketId, ticketTitle, ticketDesc, mappedSeverity === 'disaster' ? 'critical' : 'high', assetId, newAlertId]
      );

      console.log(`[Webhook] Auto-created ticket for ${mappedSeverity} alert ${newAlertId}`);
    }

    res.json({ message: 'Webhook processado com sucesso', alertId: newAlertId });
  } catch (err) {
    console.error('[Webhook] Error processing Zabbix webhook:', err);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
});

router.post('/generic', async (req: Request, res: Response): Promise<void> => {
  try {
    const { source, level, message, hostname, rawLog } = req.body;

    if (!source || !message) {
      res.status(400).json({ error: 'source e message são obrigatórios' });
      return;
    }

    let assetId: string | null = null;
    if (hostname) {
      const assetResult = await query('SELECT id FROM assets WHERE hostname = $1', [hostname]);
      if (assetResult.rows.length > 0) {
        assetId = assetResult.rows[0].id;
      }
    }

    await query(
      `INSERT INTO log_entries (asset_id, source, level, message, raw_log, occurred_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [assetId, source, level || 'info', message, rawLog || null]
    );

    res.json({ message: 'Log recebido com sucesso' });
  } catch (err) {
    console.error('[Webhook] Error processing generic webhook:', err);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
});

export default router;
