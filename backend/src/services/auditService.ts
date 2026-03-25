import { query } from '../config/database';

export const logAudit = async (
  userId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: object,
  ipAddress?: string
): Promise<void> => {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, details ? JSON.stringify(details) : null, ipAddress]
    );
  } catch (err) {
    console.error('Erro ao registrar auditoria:', err);
  }
};
