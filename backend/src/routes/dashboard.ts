import { Router } from 'express';
import { getMetrics } from '../controllers/dashboardController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.get('/', authenticate, getMetrics);

export default router;
