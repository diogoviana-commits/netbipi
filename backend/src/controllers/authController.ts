import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { env } from '../config/env';
import { createError } from '../middlewares/errorHandler';
import { logAudit } from '../services/auditService';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email e senha são obrigatórios' });
      return;
    }

    const result = await query(
      `SELECT id, username, email, full_name, role, password_hash, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const user = result.rows[0];

    if (!user.is_active) {
      res.status(401).json({ error: 'Conta desativada. Contate o administrador.' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Credenciais inválidas' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
    );

    await logAudit(user.id, 'LOGIN', 'user', user.id, { email }, req.ip);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active,
      },
      token,
    });
  } catch (err) {
    console.error('[Auth] login error:', err);
    const error = createError('Erro ao realizar login', 500);
    res.status(500).json({ error: error.message });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const result = await query(
      `SELECT id, username, email, full_name, role, is_active, created_at
       FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
    });
  } catch (err) {
    console.error('[Auth] getMe error:', err);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
      return;
    }

    const result = await query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(oldPassword, user.password_hash);

    if (!validPassword) {
      res.status(400).json({ error: 'Senha atual incorreta' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, req.user.userId]
    );

    await logAudit(req.user.userId, 'CHANGE_PASSWORD', 'user', req.user.userId, {}, req.ip);

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    console.error('[Auth] changePassword error:', err);
    res.status(500).json({ error: 'Erro ao alterar senha' });
  }
};
