import { Request, Response } from 'express';
import { query } from '../config/database';

export const getArticles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, category, page = '1', limit = '20' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT ka.id, ka.title, ka.content, ka.category, ka.tags, ka.trigger_pattern,
             ka.view_count, ka.is_published, ka.created_at, ka.updated_at,
             u.full_name AS author_name
      FROM knowledge_articles ka
      LEFT JOIN users u ON ka.author_id = u.id
      WHERE ka.is_deleted = false AND ka.is_published = true
    `;
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      sql += ` AND (ka.title ILIKE $${paramIdx} OR ka.content ILIKE $${paramIdx} OR $${paramIdx + 1} = ANY(ka.tags))`;
      params.push(`%${search}%`, search);
      paramIdx += 2;
    }

    if (category && category !== 'Todos') {
      sql += ` AND ka.category = $${paramIdx}`;
      params.push(category);
      paramIdx++;
    }

    sql += ` ORDER BY ka.updated_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(parseInt(limit), offset);

    const result = await query(sql, params);

    // Count total
    let countSql = `SELECT COUNT(*) FROM knowledge_articles WHERE is_deleted = false AND is_published = true`;
    const countParams: unknown[] = [];
    let countIdx = 1;
    if (search) {
      countSql += ` AND (title ILIKE $${countIdx} OR content ILIKE $${countIdx} OR $${countIdx + 1} = ANY(tags))`;
      countParams.push(`%${search}%`, search);
      countIdx += 2;
    }
    if (category && category !== 'Todos') {
      countSql += ` AND category = $${countIdx}`;
      countParams.push(category);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0]?.count || '0');

    res.json({
      articles: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[Knowledge] Erro ao listar artigos:', err);
    res.status(500).json({ error: 'Erro ao listar artigos' });
  }
};

export const getArticleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await query(`UPDATE knowledge_articles SET view_count = view_count + 1 WHERE id = $1`, [id]);
    const result = await query(
      `SELECT ka.*, u.full_name AS author_name
       FROM knowledge_articles ka
       LEFT JOIN users u ON ka.author_id = u.id
       WHERE ka.id = $1 AND ka.is_deleted = false`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Artigo não encontrado' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Knowledge] Erro ao buscar artigo:', err);
    res.status(500).json({ error: 'Erro ao buscar artigo' });
  }
};

export const createArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as unknown as Record<string, unknown>).user as { userId: string; role: string };
    if (!user || !['n2', 'admin'].includes(user.role)) {
      res.status(403).json({ error: 'Apenas analistas N2 ou admin podem criar artigos' });
      return;
    }
    const { title, content, category = 'Geral', tags = [], trigger_pattern, is_published = true } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
      return;
    }
    const result = await query(
      `INSERT INTO knowledge_articles (title, content, category, tags, trigger_pattern, author_id, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, content, category, tags, trigger_pattern || null, user.userId, is_published]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Knowledge] Erro ao criar artigo:', err);
    res.status(500).json({ error: 'Erro ao criar artigo' });
  }
};

export const updateArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as unknown as Record<string, unknown>).user as { userId: string; role: string };
    if (!user || !['n2', 'admin'].includes(user.role)) {
      res.status(403).json({ error: 'Sem permissão para editar artigos' });
      return;
    }
    const { id } = req.params;
    const { title, content, category, tags, trigger_pattern, is_published } = req.body;
    const result = await query(
      `UPDATE knowledge_articles
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           category = COALESCE($3, category),
           tags = COALESCE($4, tags),
           trigger_pattern = COALESCE($5, trigger_pattern),
           is_published = COALESCE($6, is_published),
           updated_at = NOW()
       WHERE id = $7 AND is_deleted = false
       RETURNING *`,
      [title, content, category, tags, trigger_pattern, is_published, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Artigo não encontrado' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Knowledge] Erro ao atualizar artigo:', err);
    res.status(500).json({ error: 'Erro ao atualizar artigo' });
  }
};

export const deleteArticle = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as unknown as Record<string, unknown>).user as { userId: string; role: string };
    if (!user || !['n2', 'admin'].includes(user.role)) {
      res.status(403).json({ error: 'Sem permissão para excluir artigos' });
      return;
    }
    const { id } = req.params;
    await query(`UPDATE knowledge_articles SET is_deleted = true, updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ message: 'Artigo excluído com sucesso' });
  } catch (err) {
    console.error('[Knowledge] Erro ao excluir artigo:', err);
    res.status(500).json({ error: 'Erro ao excluir artigo' });
  }
};

export const searchArticles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query as { q: string };
    if (!q) {
      res.json({ articles: [] });
      return;
    }
    const result = await query(
      `SELECT id, title, category, tags, trigger_pattern, view_count, created_at,
              LEFT(content, 200) AS excerpt
       FROM knowledge_articles
       WHERE is_deleted = false AND is_published = true
         AND (title ILIKE $1 OR content ILIKE $1 OR $2 = ANY(tags))
       ORDER BY view_count DESC
       LIMIT 20`,
      [`%${q}%`, q]
    );
    res.json({ articles: result.rows });
  } catch (err) {
    console.error('[Knowledge] Erro na busca:', err);
    res.status(500).json({ error: 'Erro na busca de artigos' });
  }
};

export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT DISTINCT category FROM knowledge_articles WHERE is_deleted = false AND is_published = true ORDER BY category`
    );
    const categories = ['Todos', ...result.rows.map((r: { category: string }) => r.category)];
    res.json({ categories });
  } catch (err) {
    console.error('[Knowledge] Erro ao buscar categorias:', err);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
};

export const relateToAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { trigger_pattern } = req.body;
    if (!trigger_pattern) {
      res.status(400).json({ error: 'trigger_pattern é obrigatório' });
      return;
    }
    const result = await query(
      `UPDATE knowledge_articles SET trigger_pattern = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [trigger_pattern, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Artigo não encontrado' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Knowledge] Erro ao relacionar artigo:', err);
    res.status(500).json({ error: 'Erro ao relacionar artigo ao alerta' });
  }
};
