import { Request, Response } from 'express';
import { query } from '../config/database';

const PATTERNS = [
  { regex: /authentication failure|failed password|invalid user|login fail/i, label: 'auth_failure' },
  { regex: /timeout|timed out|connection reset|connection refused/i, label: 'timeout' },
  { regex: /disk.*full|no space left|disk usage/i, label: 'disk_issue' },
  { regex: /out of memory|oom|memory.*exhausted|cannot allocate/i, label: 'memory_issue' },
  { regex: /service.*down|service.*stopped|failed to start|unit.*failed/i, label: 'service_down' },
  { regex: /error|exception|fatal|critical/i, label: 'error' },
];

const detectPattern = (message: string): string => {
  for (const pattern of PATTERNS) {
    if (pattern.regex.test(message)) {
      return pattern.label;
    }
  }
  return 'general';
};

export const getLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { host, source, level, startDate, endDate, search, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (host) {
      conditions.push(`ast.hostname = $${paramIndex++}`);
      params.push(host);
    }
    if (source) {
      conditions.push(`l.source ILIKE $${paramIndex++}`);
      params.push(`%${source}%`);
    }
    if (level) {
      conditions.push(`l.level = $${paramIndex++}`);
      params.push(level);
    }
    if (startDate) {
      conditions.push(`l.occurred_at >= $${paramIndex++}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`l.occurred_at <= $${paramIndex++}`);
      params.push(endDate);
    }
    if (search) {
      conditions.push(`(l.message ILIKE $${paramIndex} OR l.raw_log ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM log_entries l LEFT JOIN assets ast ON l.asset_id = ast.id ${whereClause}`,
      params
    );

    params.push(parseInt(limit as string), offset);
    const result = await query(
      `SELECT l.*, ast.hostname, ast.ip_address
       FROM log_entries l
       LEFT JOIN assets ast ON l.asset_id = ast.id
       ${whereClause}
       ORDER BY l.occurred_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    const logsWithPattern = result.rows.map(row => ({
      ...row,
      pattern: detectPattern(row.message),
    }));

    res.json({
      data: logsWithPattern,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (err) {
    console.error('[Logs] getLogs error:', err);
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
};

export const createLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { assetId, source, level, message, rawLog, occurredAt } = req.body;

    if (!source || !level || !message) {
      res.status(400).json({ error: 'Source, level e message são obrigatórios' });
      return;
    }

    const result = await query(
      `INSERT INTO log_entries (asset_id, source, level, message, raw_log, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [assetId || null, source, level, message, rawLog || null, occurredAt || new Date()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Logs] createLog error:', err);
    res.status(500).json({ error: 'Erro ao criar log' });
  }
};

export const getLogStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { hours = '24' } = req.query;

    const byLevel = await query(
      `SELECT level, COUNT(*) as count
       FROM log_entries
       WHERE occurred_at >= NOW() - INTERVAL '${parseInt(hours as string)} hours'
       GROUP BY level ORDER BY count DESC`
    );

    const bySource = await query(
      `SELECT source, COUNT(*) as count
       FROM log_entries
       WHERE occurred_at >= NOW() - INTERVAL '${parseInt(hours as string)} hours'
       GROUP BY source ORDER BY count DESC LIMIT 10`
    );

    const byHour = await query(
      `SELECT DATE_TRUNC('hour', occurred_at) as hour, level, COUNT(*) as count
       FROM log_entries
       WHERE occurred_at >= NOW() - INTERVAL '${parseInt(hours as string)} hours'
       GROUP BY hour, level ORDER BY hour ASC`
    );

    const topPatterns = await query(
      `SELECT message, COUNT(*) as count
       FROM log_entries
       WHERE occurred_at >= NOW() - INTERVAL '${parseInt(hours as string)} hours'
         AND level IN ('error', 'critical')
       GROUP BY message ORDER BY count DESC LIMIT 10`
    );

    res.json({
      byLevel: byLevel.rows,
      bySource: bySource.rows,
      byHour: byHour.rows,
      topErrorPatterns: topPatterns.rows.map(r => ({
        ...r,
        pattern: detectPattern(r.message),
      })),
    });
  } catch (err) {
    console.error('[Logs] getLogStats error:', err);
    res.status(500).json({ error: 'Erro ao buscar estatísticas de logs' });
  }
};
