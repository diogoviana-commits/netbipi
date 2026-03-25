import { Request, Response } from 'express';
import { query } from '../config/database';

const DEFAULT_RULES = [
  {
    id: 'rule-001',
    name: 'Alerta Crítico sem Reconhecimento',
    condition_type: 'alert_unacked',
    condition_value: '10',
    action: 'notify_all',
    description: 'Escalar alertas disaster/high sem reconhecimento após 10 minutos',
    is_active: true,
  },
  {
    id: 'rule-002',
    name: 'Chamado sem Atualização',
    condition_type: 'ticket_stale',
    condition_value: '240',
    action: 'escalate_priority',
    description: 'Elevar prioridade de chamados abertos sem atualização em 4 horas',
    is_active: true,
  },
  {
    id: 'rule-003',
    name: 'Múltiplos Alertas no Mesmo Host',
    condition_type: 'alert_flood',
    condition_value: '5',
    action: 'create_incident',
    description: 'Criar incidente se mais de 5 alertas no mesmo host em 30 minutos',
    is_active: false,
  },
];

export const getEscalations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT e.id, e.reason, e.escalated_at, e.resolved_at,
             a.trigger_name, a.severity, a.status AS alert_status,
             ast.hostname,
             t.title AS ticket_title,
             u.full_name AS escalated_to_name
      FROM escalations e
      LEFT JOIN alerts a ON e.alert_id = a.id
      LEFT JOIN assets ast ON a.asset_id = ast.id
      LEFT JOIN tickets t ON e.ticket_id = t.id
      LEFT JOIN users u ON e.escalated_to = u.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let idx = 1;

    if (status === 'open') {
      sql += ` AND e.resolved_at IS NULL`;
    } else if (status === 'resolved') {
      sql += ` AND e.resolved_at IS NOT NULL`;
    }

    sql += ` ORDER BY e.escalated_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit), offset);

    const result = await query(sql, params);
    const countResult = await query(`SELECT COUNT(*) FROM escalations`);

    res.json({
      escalations: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0]?.count || '0'),
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (err) {
    console.error('[Escalation] Erro ao listar escaladas:', err);
    res.status(500).json({ error: 'Erro ao listar escaladas' });
  }
};

export const getEscalationRules = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Try from DB first, fallback to defaults
    try {
      const result = await query(`SELECT * FROM escalation_rules ORDER BY created_at`);
      if (result.rows.length > 0) {
        res.json({ rules: result.rows });
        return;
      }
    } catch {
      // table might not exist yet
    }
    res.json({ rules: DEFAULT_RULES });
  } catch (err) {
    console.error('[Escalation] Erro ao buscar regras:', err);
    res.status(500).json({ error: 'Erro ao buscar regras de escalada' });
  }
};

export const getRules = async (_req: Request, res: Response): Promise<void> => {
  try {
    try {
      const result = await query(`SELECT * FROM escalation_rules WHERE is_active = true ORDER BY created_at`);
      if (result.rows.length > 0) {
        res.json({ rules: result.rows });
        return;
      }
    } catch {
      // table might not exist yet
    }
    res.json({ rules: DEFAULT_RULES.filter(r => r.is_active) });
  } catch (err) {
    console.error('[Escalation] Erro ao buscar regras:', err);
    res.status(500).json({ error: 'Erro ao buscar regras' });
  }
};

export const updateRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as unknown as Record<string, unknown>).user as { role: string };
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Apenas administradores podem alterar regras de escalada' });
      return;
    }
    const { rules } = req.body;
    if (!Array.isArray(rules)) {
      res.status(400).json({ error: 'rules deve ser um array' });
      return;
    }

    // Upsert rules
    for (const rule of rules) {
      if (rule.id) {
        await query(
          `UPDATE escalation_rules SET name=$1, condition_type=$2, condition_value=$3, action=$4, is_active=$5
           WHERE id=$6`,
          [rule.name, rule.condition_type, rule.condition_value, rule.action, rule.is_active, rule.id]
        );
      } else {
        await query(
          `INSERT INTO escalation_rules (name, condition_type, condition_value, action, is_active)
           VALUES ($1,$2,$3,$4,$5)`,
          [rule.name, rule.condition_type, rule.condition_value, rule.action, rule.is_active ?? true]
        );
      }
    }

    res.json({ message: 'Regras atualizadas com sucesso', rules });
  } catch (err) {
    console.error('[Escalation] Erro ao atualizar regras:', err);
    res.status(500).json({ error: 'Erro ao atualizar regras' });
  }
};
