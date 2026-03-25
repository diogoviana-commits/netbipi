import { Router } from 'express';
import {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  searchArticles,
  getCategories,
  relateToAlert,
} from '../controllers/knowledgeController';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

router.get('/', getArticles);
router.get('/categories', getCategories);
router.get('/search', searchArticles);
router.get('/:id', getArticleById);
router.post('/', createArticle);
router.put('/:id', updateArticle);
router.put('/:id/relate', relateToAlert);
router.delete('/:id', deleteArticle);

export default router;
