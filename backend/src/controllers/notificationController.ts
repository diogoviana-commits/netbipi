import { Request, Response } from 'express';
import { query } from '../config/database';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as unknown as Record<string, unknown>).user as { userId: string };
    const result = await query(
      `SELECT id, title, message, type, entity_type, entity_id, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.userId]
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('[Notifications] Erro ao listar notificações:', err);
    res.status(500).json({ error: 'Erro ao listar notificações' });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as unknown as Record<string, unknown>).user as { userId: string };
    const { id } = req.params;
    await query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [id, user.userId]
    );
    res.json({ message: 'Notificação marcada como lida' });
  } catch (err) {
    console.error('[Notifications] Erro ao marcar notificação:', err);
    res.status(500).json({ error: 'Erro ao marcar notificação' });
  }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as unknown as Record<string, unknown>).user as { userId: string };
    await query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [user.userId]
    );
    res.json({ message: 'Todas as notificações marcadas como lidas' });
  } catch (err) {
    console.error('[Notifications] Erro ao marcar todas:', err);
    res.status(500).json({ error: 'Erro ao marcar notificações' });
  }
};

export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as unknown as Record<string, unknown>).user as { userId: string };
    const result = await query(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [user.userId]
    );
    res.json({ count: parseInt(result.rows[0]?.count || '0') });
  } catch (err) {
    console.error('[Notifications] Erro ao contar não lidas:', err);
    res.status(500).json({ error: 'Erro ao contar notificações' });
  }
};
